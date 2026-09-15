-- ThinkForge Stage 4: governed decision workspace.
-- Additive/idempotent. Preserves Stage 1-3 and existing decision records.
-- Adds a workflow state machine, live readiness view, transition RPC, and audit events.

create table if not exists public.thinkforge_decision_governance(
  decision_id uuid primary key references public.thinkforge_decisions(id) on delete cascade,
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  workflow_state text not null default 'DRAFT' check(workflow_state in ('DRAFT','INVESTIGATING','READY_FOR_REVIEW','APPROVED','EXECUTING','OBSERVING','LEARNED','ARCHIVED')),
  state_version bigint not null default 1,
  readiness jsonb not null default '{}'::jsonb,
  last_transition_reason text,
  last_transition_at timestamptz,
  last_transition_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_snapshot_id uuid references public.thinkforge_decision_snapshots(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_decision_governance_org_state on public.thinkforge_decision_governance(organization_id,workflow_state,updated_at desc);

alter table public.thinkforge_decision_governance enable row level security;
drop policy if exists tf_decision_governance_org on public.thinkforge_decision_governance;
create policy tf_decision_governance_org on public.thinkforge_decision_governance for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));

create or replace function public.thinkforge_decision_readiness_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype;
ctx public.thinkforge_decision_contexts%rowtype;
required_level text := 'moderate';
minimum_evidence int := 2;
evidence_count int := 0;
assumption_count int := 0;
unresolved_count int := 0;
critical_open int := 0;
contradiction_count int := 0;
critical_contradictions int := 0;
option_count int := 0;
experiment_ready boolean := false;
prediction_count int := 0;
outcome_count int := 0;
learning_count int := 0;
problem_present boolean := false;
blockers jsonb := '[]'::jsonb;
b jsonb;
bd text;
state text;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  select * into ctx from public.thinkforge_decision_contexts where decision_id=d.id and organization_id=p_organization_id;
  required_level := coalesce(ctx.required_evidence_level,'moderate');
  minimum_evidence := case required_level when 'minimal' then 1 when 'moderate' then 2 when 'high' then 3 when 'maximum' then 4 else 2 end;
  problem_present := length(trim(coalesce(d.title,'')))>0 and length(trim(coalesce(d.problem,'')))>0;
  select count(*) into evidence_count from public.thinkforge_evidence e where e.decision_id=d.id and e.organization_id=p_organization_id and e.archived_at is null;
  select count(*) into assumption_count from public.thinkforge_assumptions a where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null;
  select count(*) into unresolved_count from public.thinkforge_assumptions a where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null and coalesce(a.status,'open') not in ('validated','supported');
  select count(*) into critical_open from public.thinkforge_assumptions a where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null and coalesce(a.status,'open') not in ('validated','supported') and (coalesce(a.leap_of_faith,false) or coalesce(a.criticality,0)>=0.75 or coalesce(a.impact,0)*coalesce(a.uncertainty,0)>=16);
  select count(*) into contradiction_count from public.thinkforge_evidence e where e.decision_id=d.id and e.organization_id=p_organization_id and e.archived_at is null and lower(coalesce(e.stance,'')) in ('contradicts','contradicting');
  select count(*) into critical_contradictions from public.thinkforge_contradictions c where c.decision_id=d.id and c.organization_id=p_organization_id and lower(coalesce(c.status,'open')) not in ('resolved','accepted','dismissed') and lower(coalesce(c.severity,'medium')) in ('high','critical');
  select count(*) into option_count from public.thinkforge_alternatives a where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null;
  select exists(select 1 from public.thinkforge_experiments x where x.decision_id=d.id and x.organization_id=p_organization_id and x.archived_at is null and coalesce(x.hypothesis,'')<>'' and coalesce(x.primary_metric,'')<>'') into experiment_ready;
  select count(*) into prediction_count from public.thinkforge_predictions p where p.decision_id=d.id and p.organization_id=p_organization_id and p.archived_at is null;
  select count(*) into outcome_count from public.thinkforge_outcomes o where o.decision_id=d.id and o.organization_id=p_organization_id and o.archived_at is null;
  select count(*) into learning_count from public.thinkforge_learnings l where l.decision_id=d.id and l.organization_id=p_organization_id and l.archived_at is null;
  if not problem_present then blockers := blockers || jsonb_build_array(jsonb_build_object('code','MISSING_PROBLEM','label','Decision problem is not defined')); end if;
  if evidence_count < minimum_evidence then blockers := blockers || jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_EVIDENCE','label',format('At least %s evidence item%s required for %s rigor',minimum_evidence,case when minimum_evidence=1 then '' else 's' end,required_level))); end if;
  if critical_open > 0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','CRITICAL_ASSUMPTIONS_OPEN','label',format('%s critical assumption%s unresolved',critical_open,case when critical_open=1 then '' else 's' end))); end if;
  if critical_contradictions > 0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','HIGH_CONTRADICTION','label',format('%s high-severity contradiction%s unresolved',critical_contradictions,case when critical_contradictions=1 then '' else 's' end))); end if;
  if option_count=0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','NO_OPTION','label','At least one option is required before review')); end if;
  state := coalesce((select workflow_state from public.thinkforge_decision_governance where decision_id=d.id),'DRAFT');
  b := jsonb_build_object(
    'workflowState',state,
    'rigorLevel',required_level,
    'minimumEvidence',minimum_evidence,
    'evidenceCount',evidence_count,
    'assumptionCount',assumption_count,
    'unresolvedAssumptions',unresolved_count,
    'criticalOpenAssumptions',critical_open,
    'contradictions',jsonb_build_object('total',contradiction_count+critical_contradictions,'evidenceCount',contradiction_count,'highSeverityCount',critical_contradictions),
    'optionCount',option_count,
    'hasExperiment',experiment_ready,
    'hasPrediction',prediction_count>0,
    'hasOutcome',outcome_count>0,
    'hasLearning',learning_count>0,
    'blockers',blockers,
    'readyForReview',jsonb_array_length(blockers)=0
  );
  return b;
end $$;

grant execute on function public.thinkforge_decision_readiness_v1(uuid,uuid,uuid) to service_role;

create or replace function public.thinkforge_transition_decision_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid,
  p_to_state text,
  p_expected_state_version bigint default null,
  p_reason text default null,
  p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.thinkforge_decision_governance%rowtype;
d public.thinkforge_decisions%rowtype;
readiness jsonb;
from_state text;
role_ok boolean := false;
new_version bigint;
snapshot jsonb;
snapshot_id uuid;
b jsonb;
bd text;
bp text;
bc text;
bc2 text;
bstate text;
bok boolean := false;
breq text;
bout jsonb;
breason text := left(coalesce(p_reason,''),500);
bto text := upper(trim(p_to_state));
bstate_version bigint;
balready boolean := false;
bapproved boolean := false;
bapproval_role boolean := false;
bexecute_role boolean := false;
blearning boolean := false;
bsnap jsonb;
bfoo text;
barr jsonb;
btemp jsonb;
bw text;
bx text;
bz text;
bm text;
bn text;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  from_state := g.workflow_state;
  if p_expected_state_version is not null and g.state_version<>p_expected_state_version then raise exception using errcode='40001',message='Decision workflow version conflict'; end if;
  readiness := public.thinkforge_decision_readiness_v1(p_user_id,p_organization_id,d.id);
  if bto not in ('DRAFT','INVESTIGATING','READY_FOR_REVIEW','APPROVED','EXECUTING','OBSERVING','LEARNED','ARCHIVED') then raise exception using errcode='22023',message='Invalid workflow state'; end if;
  if from_state='DRAFT' and bto not in ('INVESTIGATING','ARCHIVED') then raise exception using errcode='55000',message='Invalid DRAFT transition'; end if;
  if from_state='INVESTIGATING' and bto not in ('READY_FOR_REVIEW','DRAFT','ARCHIVED') then raise exception using errcode='55000',message='Invalid INVESTIGATING transition'; end if;
  if from_state='READY_FOR_REVIEW' and bto not in ('APPROVED','INVESTIGATING','ARCHIVED') then raise exception using errcode='55000',message='Invalid READY_FOR_REVIEW transition'; end if;
  if from_state='APPROVED' and bto not in ('EXECUTING','INVESTIGATING','ARCHIVED') then raise exception using errcode='55000',message='Invalid APPROVED transition'; end if;
  if from_state='EXECUTING' and bto not in ('OBSERVING','INVESTIGATING') then raise exception using errcode='55000',message='Invalid EXECUTING transition'; end if;
  if from_state='OBSERVING' and bto not in ('LEARNED','INVESTIGATING') then raise exception using errcode='55000',message='Invalid OBSERVING transition'; end if;
  if from_state='LEARNED' and bto not in ('ARCHIVED','INVESTIGATING') then raise exception using errcode='55000',message='Invalid LEARNED transition'; end if;
  if from_state='ARCHIVED' then raise exception using errcode='55000',message='Archived decision cannot transition'; end if;
  if bto='READY_FOR_REVIEW' and not coalesce((readiness->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  if bto='APPROVED' then
    select exists(select 1 from public.thinkforge_memberships m where m.user_id=p_user_id and m.organization_id=p_organization_id and m.role in ('owner','admin')) or exists(select 1 from public.thinkforge_decision_participants dp where dp.user_id=p_user_id and dp.decision_id=d.id and dp.organization_id=p_organization_id and dp.role in ('owner','approver')) into role_ok;
    if not role_ok then raise exception using errcode='42501',message='Decision approval requires owner, admin, or assigned approver'; end if;
  end if;
  if bto='EXECUTING' then perform public.thinkforge_require_membership(p_user_id,p_organization_id,'editor'); end if;
  if bto='LEARNED' and not (coalesce((readiness->>'hasOutcome')::boolean,false) and coalesce((readiness->>'hasLearning')::boolean,false)) then raise exception using errcode='55000',message='Outcome and learning are required before LEARNED'; end if;
  new_version := g.state_version + 1;
  update public.thinkforge_decision_governance set workflow_state=bto,state_version=new_version,readiness=readiness,last_transition_reason=breason,last_transition_at=now(),last_transition_by=p_user_id,approved_at=case when bto='APPROVED' then now() else approved_at end,approved_by=case when bto='APPROVED' then p_user_id else approved_by end,updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_domain_events(organization_id,aggregate_type,aggregate_id,aggregate_version,event_type,actor_id,request_id,payload)
  values(p_organization_id,'decision',d.id,new_version,'DECISION_WORKFLOW_TRANSITION',p_user_id,p_request_id,jsonb_build_object('from',from_state,'to',bto,'reason',breason,'readiness',readiness));
  if bto='APPROVED' then
    snapshot := public.thinkforge_create_decision_snapshot_v1(p_user_id,p_organization_id,d.id,'decision_approved',p_request_id);
    snapshot_id := (snapshot->>'snapshotId')::uuid;
    update public.thinkforge_decision_governance set approved_snapshot_id=snapshot_id where decision_id=d.id;
  end if;
  return jsonb_build_object('decisionId',d.id,'fromState',from_state,'workflowState',bto,'stateVersion',new_version,'readiness',readiness,'approvedSnapshotId',snapshot_id);
end $$;

grant execute on function public.thinkforge_transition_decision_v1(uuid,uuid,uuid,text,bigint,text,text) to service_role;

create or replace view public.thinkforge_decision_workspace_v1 as
select d.id as decision_id,d.organization_id,d.title,d.status,d.version,
       g.workflow_state,g.state_version,g.last_transition_at,g.last_transition_reason,g.approved_at,g.approved_snapshot_id,
       '{}'::jsonb as readiness
from public.thinkforge_decisions d
left join public.thinkforge_decision_governance g on g.decision_id=d.id
where d.deleted_at is null;

grant select on public.thinkforge_decision_workspace_v1 to service_role;
