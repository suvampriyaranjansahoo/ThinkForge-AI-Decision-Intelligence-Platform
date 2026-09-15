-- ThinkForge Stage 4 advanced governance: policy, authority, versioning, materiality,
-- approval conditions, dissent, expiry, decision contract, append-only history, and
-- authoritative readiness v2. Additive/idempotent; Stage 1-3/2 foundations preserved.

alter table public.thinkforge_decision_governance add column if not exists rigor_level text not null default 'standard' check(rigor_level in ('quick','standard','significant','high_stakes'));
alter table public.thinkforge_decision_governance add column if not exists policy_version text not null default 'stage4-v2';
alter table public.thinkforge_decision_governance add column if not exists review_status text not null default 'not_started' check(review_status in ('not_started','in_review','changes_requested','approved'));
alter table public.thinkforge_decision_governance add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_decision_governance add column if not exists reviewed_at timestamptz;
alter table public.thinkforge_decision_governance add column if not exists review_notes text;
alter table public.thinkforge_decision_governance add column if not exists reopen_count int not null default 0;
alter table public.thinkforge_decision_governance add column if not exists last_reopen_reason text;
alter table public.thinkforge_decision_governance add column if not exists last_reopen_at timestamptz;
alter table public.thinkforge_decision_governance add column if not exists last_reopen_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_decision_governance add column if not exists review_due_at timestamptz;
alter table public.thinkforge_decision_governance add column if not exists expires_at timestamptz;
alter table public.thinkforge_decision_governance add column if not exists approval_conditions jsonb not null default '[]'::jsonb;
alter table public.thinkforge_decision_governance add column if not exists dissent jsonb not null default '[]'::jsonb;
alter table public.thinkforge_decision_governance add column if not exists what_would_change_my_mind jsonb not null default '[]'::jsonb;
alter table public.thinkforge_decision_governance add column if not exists decision_contract jsonb not null default '{}'::jsonb;
alter table public.thinkforge_decision_governance add column if not exists confidence_breakdown jsonb not null default '{}'::jsonb;
alter table public.thinkforge_decision_governance add column if not exists material_change_detected boolean not null default false;
alter table public.thinkforge_decision_governance add column if not exists material_change_reason jsonb not null default '[]'::jsonb;
alter table public.thinkforge_decision_governance add column if not exists revision_number bigint not null default 1;
alter table public.thinkforge_decision_governance add column if not exists locked_at timestamptz;
alter table public.thinkforge_decision_governance add column if not exists locked_by uuid references auth.users(id) on delete set null;

create table if not exists public.thinkforge_decision_governance_events(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  event_type text not null,
  from_state text,
  to_state text,
  actor_id uuid not null references auth.users(id) on delete cascade,
  reason_code text,
  reason text,
  decision_version bigint,
  state_version bigint,
  snapshot_hash text,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_decision_gov_events on public.thinkforge_decision_governance_events(organization_id,decision_id,created_at desc);

create table if not exists public.thinkforge_decision_approval_conditions(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  metric text not null,
  operator text not null check(operator in ('gt','gte','lt','lte','eq','neq','between')),
  target_value numeric,
  lower_bound numeric,
  upper_bound numeric,
  unit text,
  status text not null default 'pending' check(status in ('pending','met','not_met','waived')),
  source text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_decision_conditions on public.thinkforge_decision_approval_conditions(organization_id,decision_id,status);

create table if not exists public.thinkforge_decision_dissent(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  stance text not null check(stance in ('approve','request_changes','reject','abstain')),
  reason text not null,
  evidence_ids uuid[] not null default '{}',
  unresolved boolean not null default true,
  resolution text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_decision_dissent on public.thinkforge_decision_dissent(organization_id,decision_id,unresolved,created_at desc);

alter table public.thinkforge_decision_governance enable row level security;
alter table public.thinkforge_decision_governance_events enable row level security;
alter table public.thinkforge_decision_approval_conditions enable row level security;
alter table public.thinkforge_decision_dissent enable row level security;

drop policy if exists tf_decision_gov_events_org on public.thinkforge_decision_governance_events;
create policy tf_decision_gov_events_org on public.thinkforge_decision_governance_events for select using(public.thinkforge_has_org_role(organization_id,'viewer'));
drop policy if exists tf_decision_gov_conditions_org on public.thinkforge_decision_approval_conditions;
create policy tf_decision_gov_conditions_org on public.thinkforge_decision_approval_conditions for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
drop policy if exists tf_decision_gov_dissent_org on public.thinkforge_decision_dissent;
create policy tf_decision_gov_dissent_org on public.thinkforge_decision_dissent for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));

-- Canonical readiness v2: the database becomes the authoritative governance result.
create or replace function public.thinkforge_decision_readiness_v2(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare base jsonb;
        g public.thinkforge_decision_governance%rowtype;
        q record;
        blockers jsonb := '[]'::jsonb;
        quality numeric := 0;
        coverage numeric := 0;
        fresh numeric := 0;
        unresolved_critical int := 0;
        high_contradictions int := 0;
        open_conditions int := 0;
        required_quality numeric := .65;
        required_coverage numeric := .50;
        rigor text := 'standard';
        score numeric := 0;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into g from public.thinkforge_decision_governance where decision_id=p_decision_id and organization_id=p_organization_id;
  base := public.thinkforge_decision_readiness_v1(p_user_id,p_organization_id,p_decision_id);
  rigor := coalesce(g.rigor_level,case lower(coalesce(base->>'rigorLevel','standard')) when 'minimal' then 'quick' when 'moderate' then 'standard' when 'high' then 'significant' when 'maximum' then 'high_stakes' else 'standard' end);
  required_quality := case rigor when 'quick' then .55 when 'standard' then .65 when 'significant' then .75 when 'high_stakes' then .85 else .65 end;
  required_coverage := case rigor when 'quick' then .25 when 'standard' then .50 when 'significant' then .65 when 'high_stakes' then .80 else .50 end;
  select coalesce(avg(case lower(coalesce(e.strength,'medium')) when 'strong' then 1 when 'high' then 1 when 'medium' then .65 when 'weak' then .30 when 'low' then .20 else .50 end),0),
         coalesce(avg(case when e.collected_at is null then .5 when e.collected_at >= now()-interval '90 days' then 1 when e.collected_at >= now()-interval '365 days' then .65 else .25 end),0)
    into quality,fresh from public.thinkforge_evidence e
   where e.decision_id=p_decision_id and e.organization_id=p_organization_id and e.archived_at is null;
  select case when count(*)=0 then 0 else count(*) filter(where linked_count>0)::numeric/count(*)::numeric end
    into coverage from (select a.id,(select count(*) from public.thinkforge_assumption_evidence_links l where l.assumption_id=a.id and l.organization_id=p_organization_id) as linked_count from public.thinkforge_assumptions a where a.decision_id=p_decision_id and a.organization_id=p_organization_id and a.archived_at is null) z;
  select count(*) into unresolved_critical from public.thinkforge_assumptions a where a.decision_id=p_decision_id and a.organization_id=p_organization_id and a.archived_at is null and coalesce(a.status,'open') not in ('validated','supported') and (coalesce(a.leap_of_faith,false) or coalesce(a.criticality,0)>=.75 or coalesce(a.impact,0)*coalesce(a.uncertainty,0)>=16);
  select count(*) into high_contradictions from public.thinkforge_contradictions c where c.decision_id=p_decision_id and c.organization_id=p_organization_id and lower(coalesce(c.status,'open')) not in ('resolved','accepted','dismissed') and lower(coalesce(c.severity,'medium')) in ('high','critical');
  select count(*) into open_conditions from public.thinkforge_decision_approval_conditions c where c.decision_id=p_decision_id and c.organization_id=p_organization_id and c.status='pending';
  blockers := coalesce(base->'blockers','[]'::jsonb);
  if quality < required_quality then blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_EVIDENCE_QUALITY','severity','high','label',format('Evidence quality %.0f%% is below the %.0f%% threshold.',quality*100,required_quality*100))); end if;
  if coverage < required_coverage then blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_EVIDENCE_COVERAGE','severity','high','label',format('Evidence coverage %.0f%% is below the %.0f%% threshold.',coverage*100,required_coverage*100))); end if;
  if rigor in ('significant','high_stakes') and open_conditions>0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','APPROVAL_CONDITIONS_PENDING','severity','critical','label',format('%s approval condition%s still pending.',open_conditions,case when open_conditions=1 then '' else 's' end))); end if;
  score := greatest(0,least(1,.45*quality+.25*coverage+.15*fresh+.15*(case when unresolved_critical=0 then 1 else greatest(0,1-unresolved_critical*.2) end)-least(.35,(high_contradictions)*.08)));
  return base || jsonb_build_object('governanceVersion','stage4-v2','rigorLevel',rigor,'evidenceQuality',round(quality,3),'evidenceCoverage',round(coverage,3),'evidenceFreshness',round(fresh,3),'criticalOpenAssumptions',unresolved_critical,'highSeverityContradictions',high_contradictions,'pendingApprovalConditions',open_conditions,'governedConfidence',round(score,3),'blockers',blockers,'readyForReview',jsonb_array_length(blockers)=0);
end $$;
grant execute on function public.thinkforge_decision_readiness_v2(uuid,uuid,uuid) to service_role;

create or replace function public.thinkforge_decision_contract_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype;
        g public.thinkforge_decision_governance%rowtype;
        r jsonb;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id;
  r:=public.thinkforge_decision_readiness_v2(p_user_id,p_organization_id,d.id);
  return jsonb_build_object('version','1.0','decisionId',d.id,'title',d.title,'question',d.problem,'workflowState',g.workflow_state,'rigor',g.rigor_level,'ownerId',coalesce((d.payload->>'ownerId'),null),'selectedOption',coalesce((d.payload->>'selectedOption'),null),'desiredOutcome',coalesce((d.payload->>'desiredOutcome'),null),'readiness',r,'approvalConditions',g.approval_conditions,'dissent',g.dissent,'whatWouldChangeMyMind',g.what_would_change_my_mind,'expiresAt',g.expires_at,'reviewDueAt',g.review_due_at,'confidenceBreakdown',g.confidence_breakdown);
end $$;
grant execute on function public.thinkforge_decision_contract_v1(uuid,uuid,uuid) to service_role;

create or replace function public.thinkforge_decision_history_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare out jsonb;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select coalesce(jsonb_agg(jsonb_build_object('eventId',e.id,'eventType',e.event_type,'fromState',e.from_state,'toState',e.to_state,'actorId',e.actor_id,'reasonCode',e.reason_code,'reason',e.reason,'decisionVersion',e.decision_version,'stateVersion',e.state_version,'snapshotHash',e.snapshot_hash,'metadata',e.metadata,'createdAt',e.created_at) order by e.created_at desc),'[]'::jsonb) into out from public.thinkforge_decision_governance_events e where e.decision_id=p_decision_id and e.organization_id=p_organization_id;
  return out;
end $$;
grant execute on function public.thinkforge_decision_history_v1(uuid,uuid,uuid) to service_role;

-- Approval requires authoritative readiness, explicit review, optional conditions, and a snapshot.
create or replace function public.thinkforge_approve_decision_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_conditions jsonb default '[]'::jsonb,p_dissent jsonb default '[]'::jsonb,p_review jsonb default '{}'::jsonb,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; r jsonb; snap jsonb; sid uuid; sv bigint;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  select public.thinkforge_decision_readiness_v2(p_user_id,p_organization_id,d.id) into r;
  if not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  if not exists(select 1 from public.thinkforge_decision_participants dp where dp.decision_id=d.id and dp.organization_id=p_organization_id and dp.user_id=p_user_id and dp.role in ('owner','approver')) and not exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.role in ('owner','admin')) then raise exception using errcode='42501',message='Decision approval requires owner, admin, or assigned approver'; end if;
  update public.thinkforge_decision_governance set review_status='approved',reviewed_by=coalesce(nullif(p_review->>'reviewedBy','')::uuid,p_user_id),reviewed_at=now(),review_notes=left(coalesce(p_review->>'notes',''),1000),approval_conditions=coalesce(p_conditions,'[]'::jsonb),dissent=coalesce(p_dissent,'[]'::jsonb),workflow_state='APPROVED',state_version=state_version+1,approved_at=now(),approved_by=p_user_id,locked_at=now(),locked_by=p_user_id,revision_number=revision_number+1,readiness=r,confidence_breakdown=jsonb_build_object('governedConfidence',r->>'governedConfidence','evidenceQuality',r->>'evidenceQuality','evidenceCoverage',r->>'evidenceCoverage','evidenceFreshness',r->>'evidenceFreshness'),decision_contract=jsonb_build_object('decisionId',d.id,'title',d.title,'problem',d.problem,'workflowState','APPROVED','rigor',g.rigor_level,'approvedAt',now()) where decision_id=d.id returning state_version into sv;
  snap := public.thinkforge_create_decision_snapshot_v1(p_user_id,p_organization_id,d.id,'decision_approved',p_request_id); sid := (snap->>'snapshotId')::uuid;
  update public.thinkforge_decision_governance set approved_snapshot_id=sid,decision_contract=(decision_contract || jsonb_build_object('snapshotId',sid,'snapshotHash',snap->>'snapshotHash')) where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason,decision_version,state_version,snapshot_hash,metadata,request_id) values(p_organization_id,d.id,'DECISION_APPROVED',g.workflow_state,'APPROVED',p_user_id,'Explicit approval',d.version,sv,snap->>'snapshotHash',jsonb_build_object('review',p_review,'conditions',p_conditions,'dissent',p_dissent),p_request_id);
  return jsonb_build_object('decisionId',d.id,'workflowState','APPROVED','stateVersion',sv,'snapshotId',sid,'snapshotHash',snap->>'snapshotHash','readiness',r);
end $$;
grant execute on function public.thinkforge_approve_decision_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;

create or replace function public.thinkforge_reopen_decision_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_reason_code text,p_reason text default null,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.thinkforge_decision_governance%rowtype; d public.thinkforge_decisions%rowtype; sv bigint; prev text;
begin
  if p_reason_code not in ('new_evidence','assumption_invalidated','outcome_changed','stakeholder_change','external_condition','policy_change','data_correction','implementation_change','other') then raise exception using errcode='22023',message='Invalid reopen reason'; end if;
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  if g.workflow_state not in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then raise exception using errcode='55000',message='Decision is not in a reopenable state'; end if;
  if not exists(select 1 from public.thinkforge_decision_participants dp where dp.decision_id=d.id and dp.organization_id=p_organization_id and dp.user_id=p_user_id and dp.role in ('owner','approver')) and not exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.role in ('owner','admin','editor')) then raise exception using errcode='42501',message='Reopening requires decision authority'; end if;
  prev:=g.workflow_state; sv:=g.state_version+1;
  update public.thinkforge_decision_governance set workflow_state='INVESTIGATING',state_version=sv,reopen_count=reopen_count+1,last_reopen_reason=p_reason_code,last_reopen_at=now(),last_reopen_by=p_user_id,locked_at=null,locked_by=null,review_status='changes_requested',approved_at=null,approved_by=null,approved_snapshot_id=null,last_transition_reason=left(coalesce(p_reason,''),500),last_transition_at=now(),last_transition_by=p_user_id,updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,'DECISION_REOPENED',prev,'INVESTIGATING',p_user_id,p_reason_code,left(coalesce(p_reason,''),500),d.version,sv,jsonb_build_object('reopenCount',g.reopen_count+1),p_request_id);
  return jsonb_build_object('decisionId',d.id,'fromState',prev,'workflowState','INVESTIGATING','stateVersion',sv,'reasonCode',p_reason_code);
end $$;
grant execute on function public.thinkforge_reopen_decision_v1(uuid,uuid,uuid,text,text,text) to service_role;

-- Approved/active-governed decisions require an explicit reopen before material edits.
create or replace function public.thinkforge_guard_governed_decision_mutation()
returns trigger language plpgsql as $$
declare s text; override text;
begin
  select workflow_state into s from public.thinkforge_decision_governance where decision_id=old.id;
  override:=current_setting('thinkforge.governance_override',true);
  if s in ('APPROVED','EXECUTING','OBSERVING','LEARNED') and coalesce(override,'')<>'on' then
    if new.title is distinct from old.title or new.problem is distinct from old.problem or new.status is distinct from old.status or new.payload is distinct from old.payload then
      raise exception using errcode='55000',message='Governed decision is locked; reopen the decision before making material changes';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_tf_governed_decision_mutation on public.thinkforge_decisions;
create trigger trg_tf_governed_decision_mutation before update on public.thinkforge_decisions for each row execute function public.thinkforge_guard_governed_decision_mutation();

-- Append-only history: updates/deletes to governance events are rejected.
create or replace function public.thinkforge_reject_governance_event_mutation()
returns trigger language plpgsql as $$ begin raise exception using errcode='55000',message='Decision governance history is append-only'; end $$;
drop trigger if exists trg_tf_decision_gov_event_update on public.thinkforge_decision_governance_events;
create trigger trg_tf_decision_gov_event_update before update on public.thinkforge_decision_governance_events for each row execute function public.thinkforge_reject_governance_event_mutation();
drop trigger if exists trg_tf_decision_gov_event_delete on public.thinkforge_decision_governance_events;
create trigger trg_tf_decision_gov_event_delete before delete on public.thinkforge_decision_governance_events for each row execute function public.thinkforge_reject_governance_event_mutation();

-- Helpful view for the decision workspace. Read path only; readiness itself comes from v2 RPC.
create or replace view public.thinkforge_decision_governance_v2 as
select g.decision_id,g.organization_id,g.workflow_state,g.state_version,g.rigor_level,g.policy_version,g.review_status,
       g.reviewed_by,g.reviewed_at,g.approved_at,g.approved_by,g.approved_snapshot_id,g.reopen_count,g.last_reopen_reason,
       g.review_due_at,g.expires_at,g.approval_conditions,g.dissent,g.what_would_change_my_mind,g.decision_contract,
       g.confidence_breakdown,g.material_change_detected,g.material_change_reason,g.revision_number,g.locked_at,g.locked_by,
       g.last_transition_reason,g.last_transition_at
from public.thinkforge_decision_governance g;
grant select on public.thinkforge_decision_governance_v2 to service_role;
