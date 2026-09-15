-- ThinkForge Stage 4 finalization: one authoritative governance policy boundary.
-- This migration hardens v14.4/v14.5 Stage 4 without changing Stage 1/2 domain foundations.

-- ---------------------------------------------------------------------------
-- 1. Data-driven transition policy table.
-- ---------------------------------------------------------------------------
create table if not exists public.thinkforge_decision_transition_policies (
  id bigserial primary key,
  policy_version text not null,
  from_state text not null,
  to_state text not null,
  allowed boolean not null,
  action text not null,
  requires_readiness boolean not null default false,
  requires_review boolean not null default false,
  requires_reason boolean not null default false,
  approval_only_route boolean not null default false,
  unique(policy_version,from_state,to_state)
);

insert into public.thinkforge_decision_transition_policies
(policy_version,from_state,to_state,allowed,action,requires_readiness,requires_review,requires_reason,approval_only_route)
values
('stage4-v4','DRAFT','INVESTIGATING',true,'edit',false,false,false,false),
('stage4-v4','DRAFT','ARCHIVED',true,'archive',false,false,false,false),
('stage4-v4','INVESTIGATING','READY_FOR_REVIEW',true,'submit_review',true,false,false,false),
('stage4-v4','INVESTIGATING','DRAFT',true,'edit',false,false,false,false),
('stage4-v4','INVESTIGATING','ARCHIVED',true,'archive',false,false,false,false),
('stage4-v4','READY_FOR_REVIEW','INVESTIGATING',true,'edit',false,false,true,false),
('stage4-v4','READY_FOR_REVIEW','ARCHIVED',true,'archive',false,false,false,false),
('stage4-v4','READY_FOR_REVIEW','APPROVED',false,'approve',true,true,false,true),
('stage4-v4','APPROVED','EXECUTING',true,'execute',false,false,false,false),
('stage4-v4','APPROVED','OBSERVING',true,'execute',false,false,false,false),
('stage4-v4','APPROVED','INVESTIGATING',true,'reopen',false,false,true,false),
('stage4-v4','EXECUTING','OBSERVING',true,'execute',false,false,false,false),
('stage4-v4','EXECUTING','INVESTIGATING',true,'reopen',false,false,true,false),
('stage4-v4','OBSERVING','LEARNED',true,'execute',false,false,false,false),
('stage4-v4','OBSERVING','INVESTIGATING',true,'reopen',false,false,true,false),
('stage4-v4','LEARNED','ARCHIVED',true,'archive',false,false,false,false),
('stage4-v4','LEARNED','INVESTIGATING',true,'reopen',false,false,true,false)
on conflict(policy_version,from_state,to_state) do update set
  allowed=excluded.allowed, action=excluded.action, requires_readiness=excluded.requires_readiness,
  requires_review=excluded.requires_review, requires_reason=excluded.requires_reason,
  approval_only_route=excluded.approval_only_route;

alter table public.thinkforge_decision_transition_policies enable row level security;
drop policy if exists tf_transition_policy_service_only on public.thinkforge_decision_transition_policies;
create policy tf_transition_policy_service_only on public.thinkforge_decision_transition_policies
for select using (false);

-- ---------------------------------------------------------------------------
-- 2. Canonical policy v2 reads a versioned table-backed rule set.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_decision_transition_policy_v2(
  p_from_state text, p_to_state text, p_policy_version text default 'stage4-v4'
) returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(
    (select jsonb_build_object(
      'version',policy_version,'fromState',from_state,'toState',to_state,'allowed',allowed,'action',action,
      'requiresReadiness',requires_readiness,'requiresReview',requires_review,'requiresReason',requires_reason,
      'approvalOnlyRoute',approval_only_route)
       from public.thinkforge_decision_transition_policies
      where policy_version=coalesce(nullif(p_policy_version,''),'stage4-v4')
        and from_state=upper(trim(coalesce(p_from_state,'')))
        and to_state=upper(trim(coalesce(p_to_state,'')))
      limit 1),
    jsonb_build_object('version',coalesce(nullif(p_policy_version,''),'stage4-v4'),'allowed',false,'action','invalid','requiresReadiness',false,'requiresReview',false,'requiresReason',false,'approvalOnlyRoute',false)
  );
$$;
grant execute on function public.thinkforge_decision_transition_policy_v2(text,text,text) to service_role;

create or replace function public.thinkforge_decision_transition_policy_v1(text,text)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_decision_transition_policy_v2($1,$2,'stage4-v4');
$$;
grant execute on function public.thinkforge_decision_transition_policy_v1(text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Canonical readiness v4: complete policy consumption + separate coverage semantics.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_decision_readiness_v4(
  p_user_id uuid, p_organization_id uuid, p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  d public.thinkforge_decisions%rowtype;
  g public.thinkforge_decision_governance%rowtype;
  p jsonb;
  blockers jsonb := '[]'::jsonb;
  evidence_count int := 0;
  evidence_quality numeric := 0;
  segment_coverage numeric := 0;
  assumption_evidence_coverage numeric := 0;
  evidence_freshness numeric := 0;
  unresolved_critical int := 0;
  high_contradictions int := 0;
  option_count int := 0;
  prediction_count int := 0;
  outcome_count int := 0;
  learning_count int := 0;
  rigor text := 'standard';
  ready boolean := false;
  confidence numeric := 0;
  next_action text;
  policy_version text := 'stage4-v4';
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision)
  values(d.id,p_organization_id,policy_version,coalesce(d.version,1))
  on conflict(decision_id) do update set decision_revision=greatest(public.thinkforge_decision_governance.decision_revision,excluded.decision_revision),policy_version=excluded.policy_version;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id and organization_id=p_organization_id;
  rigor := coalesce(g.rigor_level,'standard');
  p := public.thinkforge_decision_governance_policy_v2(rigor);
  select count(*),
    coalesce(avg(case lower(coalesce(e.strength,'medium')) when 'strong' then 1 when 'high' then 1 when 'medium' then .65 when 'weak' then .30 when 'low' then .20 else .50 end),0),
    coalesce(avg(case when e.collected_at is null then .5 when e.collected_at>=now()-interval '90 days' then 1 when e.collected_at>=now()-interval '365 days' then .65 else .25 end),0)
    into evidence_count,evidence_quality,evidence_freshness
    from public.thinkforge_evidence e
   where e.decision_id=d.id and e.organization_id=p_organization_id and e.archived_at is null;
  select case
    when jsonb_typeof(coalesce(d.payload->'segments','[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(d.payload->'segments','[]'::jsonb))=0 then case when evidence_count>0 then 1 else 0 end
    else least(1,coalesce((select count(distinct coalesce(e.provenance->>'segment',e.payload->>'segment'))::numeric from public.thinkforge_evidence e where e.decision_id=d.id and e.organization_id=p_organization_id and e.archived_at is null and coalesce(e.provenance->>'segment',e.payload->>'segment') is not null),0)/greatest(1,jsonb_array_length(d.payload->'segments'))) end
    into segment_coverage;
  select case when count(*)=0 then case when evidence_count>0 then 1 else 0 end
    else count(*) filter(where exists(select 1 from public.thinkforge_assumption_evidence_links l where l.assumption_id=a.id and l.organization_id=p_organization_id))::numeric/count(*)::numeric end
    into assumption_evidence_coverage
    from public.thinkforge_assumptions a
   where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null;
  select count(*) into unresolved_critical from public.thinkforge_assumptions a
   where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null
     and lower(coalesce(a.status,'open')) not in ('validated','supported')
     and (coalesce(a.leap_of_faith,false) or coalesce(a.criticality,0)>=.75 or coalesce(a.impact,0)*coalesce(a.uncertainty,0)>=16);
  select count(*) into high_contradictions from public.thinkforge_contradictions c
   where c.decision_id=d.id and c.organization_id=p_organization_id and lower(coalesce(c.status,'open')) not in ('resolved','accepted','dismissed') and lower(coalesce(c.severity,'medium')) in ('high','critical');
  select count(*) into option_count from public.thinkforge_alternatives a where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null;
  select count(*) into prediction_count from public.thinkforge_predictions x where x.decision_id=d.id and x.organization_id=p_organization_id and x.archived_at is null;
  select count(*) into outcome_count from public.thinkforge_outcomes x where x.decision_id=d.id and x.organization_id=p_organization_id and x.archived_at is null;
  select count(*) into learning_count from public.thinkforge_learnings x where x.decision_id=d.id and x.organization_id=p_organization_id and x.archived_at is null;
  if nullif(trim(d.title),'') is null or nullif(trim(d.problem),'') is null then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','MISSING_DECISION_CONTEXT','severity','critical','label','Define the decision question and problem.')); end if;
  if evidence_count<(p->>'minimumEvidence')::int then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_EVIDENCE','severity','critical','label',format('At least %s evidence item(s) are required for %s rigor.',p->>'minimumEvidence',rigor))); end if;
  if evidence_quality<(p->>'minQuality')::numeric then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','LOW_EVIDENCE_QUALITY','severity','high','label',format('Evidence quality %.0f%% is below the %.0f%% threshold.',evidence_quality*100,(p->>'minQuality')::numeric*100))); end if;
  if segment_coverage<(p->>'minSegmentCoverage')::numeric then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','LOW_SEGMENT_COVERAGE','severity','high','label',format('Segment coverage %.0f%% is below the %.0f%% threshold.',segment_coverage*100,(p->>'minSegmentCoverage')::numeric*100))); end if;
  if assumption_evidence_coverage<(p->>'minAssumptionEvidenceCoverage')::numeric then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','LOW_ASSUMPTION_EVIDENCE_COVERAGE','severity','high','label',format('Assumption evidence coverage %.0f%% is below the %.0f%% threshold.',assumption_evidence_coverage*100,(p->>'minAssumptionEvidenceCoverage')::numeric*100))); end if;
  if (p->>'criticalAssumptionsMustBeValidated')::boolean and unresolved_critical>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','CRITICAL_ASSUMPTIONS_OPEN','severity','critical','label',format('%s critical assumption(s) unresolved.',unresolved_critical))); end if;
  if (p->>'highContradictionsBlock')::boolean and high_contradictions>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','HIGH_CONTRADICTION','severity','critical','label',format('%s high-severity contradiction(s) unresolved.',high_contradictions))); end if;
  if option_count<(p->>'optionsMinimum')::int then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_OPTIONS','severity','high','label',format('At least %s credible options are required for %s rigor.',p->>'optionsMinimum',rigor))); end if;
  ready:=jsonb_array_length(blockers)=0;
  confidence:=greatest(0,least(1,.34*evidence_quality+.16*segment_coverage+.14*assumption_evidence_coverage+.12*evidence_freshness+.14*(case when unresolved_critical=0 then 1 else greatest(0,1-unresolved_critical/5.0) end)+.10*least(1,option_count/3.0)-least(.35,high_contradictions*.08)));
  next_action:=case when jsonb_array_length(blockers)>0 then blockers->0->>'label' when outcome_count=0 and prediction_count>0 then 'Move to observation and capture the outcome.' when learning_count=0 and outcome_count>0 then 'Capture learning and update the affected assumption.' else 'Ready for governed review.' end;
  return jsonb_build_object('governanceVersion',policy_version,'rigorLevel',rigor,'policy',p,'evidenceCount',evidence_count,'evidenceQuality',round(evidence_quality,3),'segmentCoverage',round(segment_coverage,3),'assumptionEvidenceCoverage',round(assumption_evidence_coverage,3),'evidenceFreshness',round(evidence_freshness,3),'criticalOpenAssumptions',unresolved_critical,'highSeverityContradictions',high_contradictions,'optionCount',option_count,'hasPrediction',prediction_count>0,'hasOutcome',outcome_count>0,'hasLearning',learning_count>0,'blockers',blockers,'readyForReview',ready,'governedConfidence',round(confidence,3),'workflowState',g.workflow_state,'decisionRevision',g.decision_revision,'governanceStateVersion',g.state_version,'approvedRevisionNumber',g.approved_revision_number,'approvedStateVersion',g.approved_state_version,'policyVersion',policy_version,'nextAction',next_action);
end $$;
grant execute on function public.thinkforge_decision_readiness_v4(uuid,uuid,uuid) to service_role;

create or replace function public.thinkforge_decision_readiness_v3(uuid,uuid,uuid)
returns jsonb language sql security definer set search_path=public as $$ select public.thinkforge_decision_readiness_v4($1,$2,$3); $$;
grant execute on function public.thinkforge_decision_readiness_v3(uuid,uuid,uuid) to service_role;
create or replace function public.thinkforge_decision_readiness_v2(uuid,uuid,uuid)
returns jsonb language sql security definer set search_path=public as $$ select public.thinkforge_decision_readiness_v4($1,$2,$3); $$;
grant execute on function public.thinkforge_decision_readiness_v2(uuid,uuid,uuid) to service_role;
create or replace function public.thinkforge_decision_readiness_v1(uuid,uuid,uuid)
returns jsonb language sql security definer set search_path=public as $$ select public.thinkforge_decision_readiness_v4($1,$2,$3); $$;
grant execute on function public.thinkforge_decision_readiness_v1(uuid,uuid,uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Canonical transition v4: table-driven, approval-only approval route.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_transition_decision_v4(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_to_state text,p_expected_state_version bigint default null,p_reason text default null,p_reopen_reason text default null,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; authz jsonb; r jsonb; sv bigint; from_state text; tp jsonb;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for update;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision) values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1)) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  from_state:=g.workflow_state; tp:=public.thinkforge_decision_transition_policy_v2(from_state,upper(trim(p_to_state)),'stage4-v4');
  if not coalesce((tp->>'allowed')::boolean,false) then if coalesce((tp->>'approvalOnlyRoute')::boolean,false) then raise exception using errcode='55000',message='APPROVAL_ROUTE_REQUIRED'; else raise exception using errcode='55000',message='Invalid workflow transition'; end if; end if;
  if p_expected_state_version is not null and g.state_version<>p_expected_state_version then raise exception using errcode='40001',message='Decision workflow version conflict'; end if;
  authz:=public.thinkforge_decision_authorize_v2(p_user_id,p_organization_id,d.id,tp->>'action');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  if (tp->>'requiresReadiness')::boolean then r:=public.thinkforge_decision_readiness_v4(p_user_id,p_organization_id,d.id); if not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if; else r:=public.thinkforge_decision_readiness_v4(p_user_id,p_organization_id,d.id); end if;
  if (tp->>'requiresReason')::boolean and nullif(trim(coalesce(case when tp->>'action'='reopen' then p_reopen_reason else p_reason end,'')),'') is null then raise exception using errcode='22023',message='Structured reason required'; end if;
  if upper(trim(p_to_state))='LEARNED' and not (coalesce((r->>'hasOutcome')::boolean,false) and coalesce((r->>'hasLearning')::boolean,false)) then raise exception using errcode='55000',message='Outcome and learning are required before LEARNED'; end if;
  sv:=g.state_version+1;
  update public.thinkforge_decision_governance set workflow_state=upper(trim(p_to_state)),state_version=sv,last_transition_reason=left(coalesce(p_reason,''),500),last_transition_at=now(),last_transition_by=p_user_id,decision_revision=coalesce(d.version,1),policy_version='stage4-v4',updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,case when tp->>'action'='reopen' then 'DECISION_REOPENED' else 'DECISION_WORKFLOW_TRANSITION' end,from_state,upper(trim(p_to_state)),p_user_id,nullif(p_reopen_reason,''),left(coalesce(p_reason,''),500),d.version,sv,jsonb_build_object('authorization',authz,'transitionPolicy',tp,'policyVersion','stage4-v4'),p_request_id);
  return jsonb_build_object('decisionId',d.id,'fromState',from_state,'workflowState',upper(trim(p_to_state)),'stateVersion',sv,'readiness',r,'authorization',authz,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_transition_decision_v4(uuid,uuid,uuid,text,bigint,text,text,text) to service_role;

create or replace function public.thinkforge_transition_decision_v3(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb)
returns jsonb language sql security definer set search_path=public as $$ select public.thinkforge_transition_decision_v4($1,$2,$3,$4,$5,$6,$7,$8); $$;
grant execute on function public.thinkforge_transition_decision_v3(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb) to service_role;
create or replace function public.thinkforge_transition_decision_v2(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb)
returns jsonb language sql security definer set search_path=public as $$ select public.thinkforge_transition_decision_v4($1,$2,$3,$4,$5,$6,$7,$8); $$;
grant execute on function public.thinkforge_transition_decision_v2(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb) to service_role;
create or replace function public.thinkforge_transition_decision_v1(uuid,uuid,uuid,text,bigint,text,text)
returns jsonb language sql security definer set search_path=public as $$ select public.thinkforge_transition_decision_v4($1,$2,$3,$4,$5,$6,null,$7); $$;
grant execute on function public.thinkforge_transition_decision_v1(uuid,uuid,uuid,text,bigint,text,text) to service_role;

comment on table public.thinkforge_decision_transition_policies is 'Stage 4 authoritative, versioned transition policy; application code must not define approval authority independently.';
comment on function public.thinkforge_decision_readiness_v4(uuid,uuid,uuid) is 'Stage 4 authoritative readiness evaluator; v1-v3 are forward-compatible adapters only.';
comment on function public.thinkforge_transition_decision_v4(uuid,uuid,uuid,text,bigint,text,text,text) is 'Stage 4 authoritative state-transition evaluator; APPROVED is reachable only through the dedicated approval RPC.';
