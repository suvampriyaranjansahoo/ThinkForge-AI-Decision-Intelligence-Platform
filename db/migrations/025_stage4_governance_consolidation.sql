-- ThinkForge Stage 4.2 — governance consolidation.
-- Goal: one authoritative readiness/authority/transition policy, governed child
-- mutation locks, server-derived reviews, explicit revision semantics, and
-- DB-backed integration-test surface. Backward-compatible wrappers remain,
-- but legacy implementations no longer own policy.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Formal version semantics
-- ---------------------------------------------------------------------------
alter table public.thinkforge_decision_governance add column if not exists policy_version text not null default 'stage4-v4';
alter table public.thinkforge_decision_governance add column if not exists decision_revision bigint not null default 1;
alter table public.thinkforge_decision_governance add column if not exists approved_revision_number bigint;
alter table public.thinkforge_decision_governance add column if not exists approved_state_version bigint;
alter table public.thinkforge_decision_governance add column if not exists review_required_override boolean;
alter table public.thinkforge_decision_governance add column if not exists material_change_detected boolean not null default false;
alter table public.thinkforge_decision_governance add column if not exists material_change_reason jsonb not null default '[]'::jsonb;

alter table public.thinkforge_decision_snapshots add column if not exists governance_revision bigint;
alter table public.thinkforge_decision_snapshots add column if not exists policy_version text;
alter table public.thinkforge_decision_snapshots add column if not exists snapshot_type text not null default 'decision_state';
alter table public.thinkforge_decision_snapshots drop constraint if exists thinkforge_decision_snapshots_decision_id_decision_version_key;
create unique index if not exists uq_tf_decision_snapshot_governance_revision on public.thinkforge_decision_snapshots(decision_id,governance_revision) where governance_revision is not null;

-- ---------------------------------------------------------------------------
-- 2. First-class review record. Reviewer identity is server-derived.
-- ---------------------------------------------------------------------------
create table if not exists public.thinkforge_decision_reviews(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  status text not null check(status in ('in_review','approved','changes_requested','rejected')),
  notes text,
  decision_revision bigint not null default 1,
  state_version bigint not null default 1,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists idx_tf_decision_reviews_lookup on public.thinkforge_decision_reviews(organization_id,decision_id,created_at desc);

alter table public.thinkforge_decision_reviews enable row level security;
drop policy if exists tf_decision_reviews_org on public.thinkforge_decision_reviews;
create policy tf_decision_reviews_org on public.thinkforge_decision_reviews
  for select using(public.thinkforge_has_org_role(organization_id,'viewer'));
drop policy if exists tf_decision_reviews_write on public.thinkforge_decision_reviews;
create policy tf_decision_reviews_write on public.thinkforge_decision_reviews
  for all using(public.thinkforge_has_org_role(organization_id,'editor'))
  with check(public.thinkforge_has_org_role(organization_id,'editor'));

-- ---------------------------------------------------------------------------
-- 3. Canonical, complete rigor policy.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_decision_governance_policy_v2(
  p_rigor text default 'standard'
) returns jsonb language sql immutable as $$
  select case lower(coalesce(p_rigor,'standard'))
    when 'quick' then jsonb_build_object(
      'version','stage4-v4','rigor','quick','minimumEvidence',1,'minQuality',0.55,
      'minSegmentCoverage',0.25,'minAssumptionEvidenceCoverage',0.50,
      'optionsMinimum',1,'reviewRequired',false,'criticalAssumptionsMustBeValidated',false,
      'highContradictionsBlock',false,'approvalConditionsRequired',false,
      'expiryDays',90,'materialConfidenceShift',0.08)
    when 'significant' then jsonb_build_object(
      'version','stage4-v4','rigor','significant','minimumEvidence',3,'minQuality',0.75,
      'minSegmentCoverage',0.65,'minAssumptionEvidenceCoverage',0.75,
      'optionsMinimum',2,'reviewRequired',true,'criticalAssumptionsMustBeValidated',true,
      'highContradictionsBlock',true,'approvalConditionsRequired',false,
      'expiryDays',120,'materialConfidenceShift',0.07)
    when 'high_stakes' then jsonb_build_object(
      'version','stage4-v4','rigor','high_stakes','minimumEvidence',4,'minQuality',0.85,
      'minSegmentCoverage',0.80,'minAssumptionEvidenceCoverage',0.90,
      'optionsMinimum',3,'reviewRequired',true,'criticalAssumptionsMustBeValidated',true,
      'highContradictionsBlock',true,'approvalConditionsRequired',true,
      'expiryDays',90,'materialConfidenceShift',0.05)
    else jsonb_build_object(
      'version','stage4-v4','rigor','standard','minimumEvidence',2,'minQuality',0.65,
      'minSegmentCoverage',0.50,'minAssumptionEvidenceCoverage',0.67,
      'optionsMinimum',2,'reviewRequired',true,'criticalAssumptionsMustBeValidated',true,
      'highContradictionsBlock',true,'approvalConditionsRequired',false,
      'expiryDays',180,'materialConfidenceShift',0.08)
  end;
$$;
grant execute on function public.thinkforge_decision_governance_policy_v2(text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Data-driven transition policy.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_decision_transition_policy_v1(
  p_from_state text,
  p_to_state text
) returns jsonb language sql immutable as $$
  with t as (
    select upper(trim(coalesce(p_from_state,''))) f, upper(trim(coalesce(p_to_state,''))) t
  )
  select case
    when f='DRAFT' and t='INVESTIGATING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','edit','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='DRAFT' and t='ARCHIVED' then jsonb_build_object('version','stage4-v4','allowed',true,'action','archive','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='INVESTIGATING' and t='READY_FOR_REVIEW' then jsonb_build_object('version','stage4-v4','allowed',true,'action','submit_review','requiresReadiness',true,'requiresReview',false,'requiresReason',false)
    when f='INVESTIGATING' and t='DRAFT' then jsonb_build_object('version','stage4-v4','allowed',true,'action','edit','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='INVESTIGATING' and t='ARCHIVED' then jsonb_build_object('version','stage4-v4','allowed',true,'action','archive','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='READY_FOR_REVIEW' and t='INVESTIGATING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','edit','requiresReadiness',false,'requiresReview',false,'requiresReason',true)
    when f='READY_FOR_REVIEW' and t='ARCHIVED' then jsonb_build_object('version','stage4-v4','allowed',true,'action','archive','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='READY_FOR_REVIEW' and t='APPROVED' then jsonb_build_object('version','stage4-v4','allowed',false,'action','approve','requiresReadiness',true,'requiresReview',true,'requiresReason',false,'approvalOnlyRoute',true)
    when f='APPROVED' and t='EXECUTING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','execute','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='APPROVED' and t='OBSERVING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','execute','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='APPROVED' and t='INVESTIGATING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','reopen','requiresReadiness',false,'requiresReview',false,'requiresReason',true)
    when f='EXECUTING' and t='OBSERVING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','execute','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='EXECUTING' and t='INVESTIGATING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','reopen','requiresReadiness',false,'requiresReview',false,'requiresReason',true)
    when f='OBSERVING' and t='LEARNED' then jsonb_build_object('version','stage4-v4','allowed',true,'action','execute','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='OBSERVING' and t='INVESTIGATING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','reopen','requiresReadiness',false,'requiresReview',false,'requiresReason',true)
    when f='LEARNED' and t='ARCHIVED' then jsonb_build_object('version','stage4-v4','allowed',true,'action','archive','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
    when f='LEARNED' and t='INVESTIGATING' then jsonb_build_object('version','stage4-v4','allowed',true,'action','reopen','requiresReadiness',false,'requiresReview',false,'requiresReason',true)
    else jsonb_build_object('version','stage4-v4','allowed',false,'action','invalid','requiresReadiness',false,'requiresReview',false,'requiresReason',false)
  end
  from t;
$$;
grant execute on function public.thinkforge_decision_transition_policy_v1(text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Canonical authority evaluator v2.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_decision_authorize_v2(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid,
  p_action text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  action text := lower(trim(coalesce(p_action,'')));
  org_role text;
  decision_role text;
  allowed boolean := false;
  reason text := null;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select m.role into org_role from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=p_user_id limit 1;
  select dp.role into decision_role
    from public.thinkforge_decision_participants dp
   where dp.organization_id=p_organization_id and dp.decision_id=p_decision_id and dp.user_id=p_user_id
   order by case dp.role when 'owner' then 1 when 'approver' then 2 when 'reviewer' then 3 when 'contributor' then 4 else 5 end
   limit 1;
  case action
    when 'view' then allowed := org_role in ('owner','admin','editor','viewer') or decision_role is not null;
    when 'edit' then allowed := org_role in ('owner','admin','editor') or decision_role in ('owner','contributor');
    when 'submit_review' then allowed := org_role in ('owner','admin','editor') or decision_role in ('owner','contributor');
    when 'review' then allowed := org_role in ('owner','admin') or decision_role in ('owner','reviewer','approver');
    when 'approve' then allowed := org_role in ('owner','admin') or decision_role in ('owner','approver');
    when 'reopen' then allowed := org_role in ('owner','admin','editor') or decision_role in ('owner','approver');
    when 'archive' then allowed := org_role in ('owner','admin') or decision_role='owner';
    when 'execute' then allowed := org_role in ('owner','admin','editor') or decision_role='owner';
    else reason := 'UNKNOWN_ACTION';
  end case;
  if not allowed and reason is null then reason := upper(action)||'_NOT_AUTHORIZED'; end if;
  return jsonb_build_object('allowed',allowed,'action',action,'organizationId',p_organization_id,'decisionId',p_decision_id,'actorId',p_user_id,'orgRole',org_role,'decisionRole',decision_role,'reason',reason,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_decision_authorize_v2(uuid,uuid,uuid,text) to service_role;

-- Compatibility wrapper: v1 is no longer an independent policy.
create or replace function public.thinkforge_decision_authorize_v1(uuid,uuid,uuid,text)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_decision_authorize_v2($1,$2,$3,$4);
$$;
grant execute on function public.thinkforge_decision_authorize_v1(uuid,uuid,uuid,text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Canonical readiness v3. It does NOT call v1.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_decision_readiness_v3(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  d public.thinkforge_decisions%rowtype;
  g public.thinkforge_decision_governance%rowtype;
  p jsonb;
  blockers jsonb := '[]'::jsonb;
  evidence_count int := 0;
  evidence_quality numeric := 0;
  evidence_segment_coverage numeric := 0;
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
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision)
  values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1))
  on conflict(decision_id) do update set decision_revision=greatest(public.thinkforge_decision_governance.decision_revision,excluded.decision_revision),policy_version='stage4-v4';
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
  into evidence_segment_coverage;

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
  select count(*) into prediction_count from public.thinkforge_predictions p2 where p2.decision_id=d.id and p2.organization_id=p_organization_id and p2.archived_at is null;
  select count(*) into outcome_count from public.thinkforge_outcomes o where o.decision_id=d.id and o.organization_id=p_organization_id and o.archived_at is null;
  select count(*) into learning_count from public.thinkforge_learnings l where l.decision_id=d.id and l.organization_id=p_organization_id and l.archived_at is null;

  if nullif(trim(d.title),'') is null or nullif(trim(d.problem),'') is null then blockers := blockers || jsonb_build_array(jsonb_build_object('code','MISSING_DECISION_CONTEXT','severity','critical','label','Define the decision question and problem.')); end if;
  if evidence_count < (p->>'minimumEvidence')::int then blockers := blockers || jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_EVIDENCE','severity','critical','label',format('At least %s evidence item(s) are required for %s rigor.',p->>'minimumEvidence',rigor))); end if;
  if evidence_quality < (p->>'minQuality')::numeric then blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_EVIDENCE_QUALITY','severity','high','label',format('Evidence quality %.0f%% is below the %.0f%% threshold.',evidence_quality*100,(p->>'minQuality')::numeric*100))); end if;
  if evidence_segment_coverage < (p->>'minSegmentCoverage')::numeric then blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_SEGMENT_COVERAGE','severity','high','label',format('Segment coverage %.0f%% is below the %.0f%% threshold.',evidence_segment_coverage*100,(p->>'minSegmentCoverage')::numeric*100))); end if;
  if assumption_evidence_coverage < (p->>'minAssumptionEvidenceCoverage')::numeric then blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_ASSUMPTION_EVIDENCE_COVERAGE','severity','high','label',format('Assumption evidence coverage %.0f%% is below the %.0f%% threshold.',assumption_evidence_coverage*100,(p->>'minAssumptionEvidenceCoverage')::numeric*100))); end if;
  if (p->>'criticalAssumptionsMustBeValidated')::boolean and unresolved_critical>0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','CRITICAL_ASSUMPTIONS_OPEN','severity','critical','label',format('%s critical assumption(s) unresolved.',unresolved_critical))); end if;
  if (p->>'highContradictionsBlock')::boolean and high_contradictions>0 then blockers := blockers || jsonb_build_array(jsonb_build_object('code','HIGH_CONTRADICTION','severity','critical','label',format('%s high-severity contradiction(s) unresolved.',high_contradictions))); end if;
  if option_count < (p->>'optionsMinimum')::int then blockers := blockers || jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_OPTIONS','severity','high','label',format('At least %s credible options are required for %s rigor.',p->>'optionsMinimum',rigor))); end if;
  ready := jsonb_array_length(blockers)=0;
  confidence := greatest(0,least(1,.34*evidence_quality+.16*evidence_segment_coverage+.14*assumption_evidence_coverage+.12*evidence_freshness+.14*(case when unresolved_critical=0 then 1 else greatest(0,1-unresolved_critical/5.0) end)+.10*(least(1,option_count/3.0))-least(.35,high_contradictions*.08)));
  next_action := case
    when jsonb_array_length(blockers)>0 then blockers->0->>'label'
    when outcome_count=0 and prediction_count>0 then 'Move to observation and capture the outcome.'
    when learning_count=0 and outcome_count>0 then 'Capture learning and update the affected assumption.'
    else 'Ready for governed review.'
  end;
  return jsonb_build_object(
    'governanceVersion','stage4-v4','rigorLevel',rigor,'policy',p,
    'evidenceCount',evidence_count,'evidenceQuality',round(evidence_quality,3),
    'segmentCoverage',round(evidence_segment_coverage,3),'assumptionEvidenceCoverage',round(assumption_evidence_coverage,3),
    'evidenceFreshness',round(evidence_freshness,3),'criticalOpenAssumptions',unresolved_critical,
    'highSeverityContradictions',high_contradictions,'optionCount',option_count,'hasPrediction',prediction_count>0,
    'hasOutcome',outcome_count>0,'hasLearning',learning_count>0,'blockers',blockers,'readyForReview',ready,
    'governedConfidence',round(confidence,3),'workflowState',g.workflow_state,
    'decisionRevision',g.decision_revision,'governanceStateVersion',g.state_version,
    'approvedRevisionNumber',g.approved_revision_number,'approvedStateVersion',g.approved_state_version,
    'policyVersion','stage4-v4','nextAction',next_action
  );
end $$;
grant execute on function public.thinkforge_decision_readiness_v3(uuid,uuid,uuid) to service_role;

-- Compatibility wrapper: v2 is now a forward adapter to the canonical v3 policy.
create or replace function public.thinkforge_decision_readiness_v2(uuid,uuid,uuid)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_decision_readiness_v3($1,$2,$3);
$$;
grant execute on function public.thinkforge_decision_readiness_v2(uuid,uuid,uuid) to service_role;

-- Legacy v1 readiness wrapper. No independent policy remains.
create or replace function public.thinkforge_decision_readiness_v1(uuid,uuid,uuid)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_decision_readiness_v3($1,$2,$3);
$$;
grant execute on function public.thinkforge_decision_readiness_v1(uuid,uuid,uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Review submission. Reviewer identity is always p_user_id.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_submit_decision_review_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_status text,p_notes text default null,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; authz jsonb; rid uuid; status text := lower(trim(coalesce(p_status,''))); sv bigint;
begin
  if status not in ('in_review','approved','changes_requested','rejected') then raise exception using errcode='22023',message='Invalid review status'; end if;
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision) values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1)) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  authz:=public.thinkforge_decision_authorize_v2(p_user_id,p_organization_id,d.id,'review');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  sv:=g.state_version+1;
  insert into public.thinkforge_decision_reviews(organization_id,decision_id,reviewer_id,status,notes,decision_revision,state_version,reviewed_at)
  values(p_organization_id,d.id,p_user_id,status,left(coalesce(p_notes,''),2000),coalesce(d.version,1),sv,case when status='in_review' then null else now() end)
  returning id into rid;
  update public.thinkforge_decision_governance set review_status=case when status='approved' then 'approved' when status='changes_requested' or status='rejected' then 'changes_requested' else 'in_review' end,reviewed_by=p_user_id,reviewed_at=case when status='in_review' then null else now() end,review_notes=left(coalesce(p_notes,''),1000),state_version=sv,updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,actor_id,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,'DECISION_REVIEW_SUBMITTED',p_user_id,left(coalesce(p_notes,''),500),d.version,sv,jsonb_build_object('reviewId',rid,'status',status,'policyVersion','stage4-v4'),p_request_id);
  return jsonb_build_object('reviewId',rid,'decisionId',d.id,'status',status,'reviewerId',p_user_id,'decisionRevision',coalesce(d.version,1),'stateVersion',sv,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_submit_decision_review_v1(uuid,uuid,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Snapshot v2: governance revision becomes part of identity.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_create_decision_snapshot_v2(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_reason text default 'decision_state_capture',p_request_id text default null,p_snapshot_type text default 'decision_state'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; s jsonb; h text; sid uuid;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision) values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1)) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id;
  s:=jsonb_build_object(
    'decision',to_jsonb(d),
    'governance',jsonb_build_object('workflowState',g.workflow_state,'stateVersion',g.state_version,'revisionNumber',g.revision_number,'decisionRevision',g.decision_revision,'policyVersion',g.policy_version,'approvedRevisionNumber',g.approved_revision_number,'approvedStateVersion',g.approved_state_version),
    'assumptions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_assumptions q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_evidence q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'challenges',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_challenges q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'alternatives',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_alternatives q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'experiments',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_experiments q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'predictions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_predictions q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'outcomes',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_outcomes q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'learnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_learnings q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'approvalConditions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_decision_approval_conditions q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb),
    'dissent',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_decision_dissent q where q.decision_id=d.id and q.organization_id=p_organization_id),'[]'::jsonb)
  );
  h:=encode(digest(s::text,'sha256'),'hex');
  insert into public.thinkforge_decision_snapshots(organization_id,decision_id,decision_version,governance_revision,snapshot_hash,snapshot,reason,created_by,policy_version,snapshot_type)
  values(p_organization_id,d.id,coalesce(d.version,1),coalesce(g.revision_number,1),h,s,left(coalesce(p_reason,''),500),p_user_id,'stage4-v4',left(coalesce(p_snapshot_type,'decision_state'),80))
  on conflict(decision_id,governance_revision) where governance_revision is not null do nothing;
  select id into sid from public.thinkforge_decision_snapshots where decision_id=d.id and governance_revision=coalesce(g.revision_number,1);
  return jsonb_build_object('snapshotId',sid,'decisionId',d.id,'decisionVersion',coalesce(d.version,1),'governanceRevision',coalesce(g.revision_number,1),'snapshotHash',h,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_create_decision_snapshot_v2(uuid,uuid,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Canonical approval: only route to APPROVED.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_approve_decision_v2(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_review_id uuid,p_conditions jsonb default '[]'::jsonb,p_dissent jsonb default '[]'::jsonb,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; r jsonb; authz jsonb; snap jsonb; sid uuid; sv bigint; approved_review record; condition jsonb; dissent_item jsonb;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for update;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision) values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1)) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  if g.workflow_state <> 'READY_FOR_REVIEW' then raise exception using errcode='55000',message='Only READY_FOR_REVIEW decisions can be approved'; end if;
  authz:=public.thinkforge_decision_authorize_v2(p_user_id,p_organization_id,d.id,'approve');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  r:=public.thinkforge_decision_readiness_v4(p_user_id,p_organization_id,d.id);
  if not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  if coalesce((r->'policy'->>'reviewRequired')::boolean,false) then
    select rv.* into approved_review from public.thinkforge_decision_reviews rv where rv.id=p_review_id and rv.organization_id=p_organization_id and rv.decision_id=d.id and rv.status='approved' and exists(select 1 from public.thinkforge_decision_participants dp where dp.organization_id=rv.organization_id and dp.decision_id=rv.decision_id and dp.user_id=rv.reviewer_id and dp.role='reviewer') order by rv.created_at desc limit 1;
    if approved_review.id is null then raise exception using errcode='55000',message='A server-recorded approved reviewer decision is required before approval'; end if;
    if approved_review.decision_revision<>coalesce(d.version,1) then raise exception using errcode='55000',message='Reviewer decision is stale; review the current decision revision'; end if;
  end if;
  if jsonb_typeof(coalesce(p_conditions,'[]'::jsonb))<>'array' then raise exception using errcode='22023',message='Approval conditions must be an array'; end if;
  delete from public.thinkforge_decision_approval_conditions where organization_id=p_organization_id and decision_id=d.id;
  for condition in select value from jsonb_array_elements(coalesce(p_conditions,'[]'::jsonb)) loop
    if nullif(trim(condition->>'metric'),'') is null or lower(coalesce(condition->>'operator','')) not in ('gt','gte','lt','lte','eq','neq','between') then raise exception using errcode='22023',message='Invalid approval condition'; end if;
    insert into public.thinkforge_decision_approval_conditions(organization_id,decision_id,metric,operator,target_value,lower_bound,upper_bound,unit,status,source,created_by)
    values(p_organization_id,d.id,condition->>'metric',lower(condition->>'operator'),nullif(condition->>'targetValue','')::numeric,nullif(condition->>'lowerBound','')::numeric,nullif(condition->>'upperBound','')::numeric,condition->>'unit','pending',condition->>'source',p_user_id);
  end loop;
  delete from public.thinkforge_decision_dissent where organization_id=p_organization_id and decision_id=d.id;
  for dissent_item in select value from jsonb_array_elements(coalesce(p_dissent,'[]'::jsonb)) loop
    if lower(coalesce(dissent_item->>'stance','')) not in ('approve','request_changes','reject','abstain') or nullif(trim(dissent_item->>'reason'),'') is null then raise exception using errcode='22023',message='Invalid dissent item'; end if;
    insert into public.thinkforge_decision_dissent(organization_id,decision_id,author_id,stance,reason,unresolved)
    values(p_organization_id,d.id,p_user_id,lower(dissent_item->>'stance'),left(dissent_item->>'reason',2000),coalesce((dissent_item->>'unresolved')::boolean,true));
  end loop;
  sv:=g.state_version+1;
  update public.thinkforge_decision_governance set review_status='approved',reviewed_by=approved_review.reviewer_id,reviewed_at=approved_review.reviewed_at,workflow_state='APPROVED',state_version=sv,approved_at=now(),approved_by=p_user_id,locked_at=now(),locked_by=p_user_id,revision_number=revision_number+1,decision_revision=coalesce(d.version,1),approved_revision_number=revision_number+1,approved_state_version=sv,approval_conditions=coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.thinkforge_decision_approval_conditions c where c.decision_id=d.id),'[]'::jsonb),dissent=coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.thinkforge_decision_dissent x where x.decision_id=d.id),'[]'::jsonb),readiness=r,confidence_breakdown=jsonb_build_object('governedConfidence',r->>'governedConfidence','evidenceQuality',r->>'evidenceQuality','segmentCoverage',r->>'segmentCoverage','assumptionEvidenceCoverage',r->>'assumptionEvidenceCoverage','evidenceFreshness',r->>'evidenceFreshness'),policy_version='stage4-v4',updated_at=now() where decision_id=d.id returning state_version into sv;
  snap:=public.thinkforge_create_decision_snapshot_v2(p_user_id,p_organization_id,d.id,'decision_approved',p_request_id,'approved'); sid:=(snap->>'snapshotId')::uuid;
  update public.thinkforge_decision_governance set approved_snapshot_id=sid,decision_contract=jsonb_build_object('decisionId',d.id,'title',d.title,'problem',d.problem,'workflowState','APPROVED','rigor',g.rigor_level,'policyVersion','stage4-v4','approvedAt',now(),'approvedRevisionNumber',revision_number,'snapshotId',sid,'snapshotHash',snap->>'snapshotHash') where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason,decision_version,state_version,snapshot_hash,metadata,request_id) values(p_organization_id,d.id,'DECISION_APPROVED','READY_FOR_REVIEW','APPROVED',p_user_id,'Explicit approval',d.version,sv,snap->>'snapshotHash',jsonb_build_object('authorization',authz,'reviewId',p_review_id,'reviewerId',approved_review.reviewer_id,'policyVersion','stage4-v4'),p_request_id);
  return jsonb_build_object('decisionId',d.id,'workflowState','APPROVED','stateVersion',sv,'snapshotId',sid,'snapshotHash',snap->>'snapshotHash','reviewId',p_review_id,'reviewerId',approved_review.reviewer_id,'readiness',r,'authorization',authz,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_approve_decision_v2(uuid,uuid,uuid,uuid,jsonb,jsonb,text) to service_role;

-- Compatibility wrapper for old approval callers. It cannot spoof reviewer identity.
create or replace function public.thinkforge_approve_decision_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb,text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare review_id uuid;
begin
  review_id:=nullif(($6->>'reviewId'),'')::uuid;
  if review_id is null then raise exception using errcode='22023',message='reviewId is required for canonical approval'; end if;
  return public.thinkforge_approve_decision_v2($1,$2,$3,review_id,$4,$5,$7);
end $$;
grant execute on function public.thinkforge_approve_decision_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Canonical transition v3. APPROVED is an approval-only route.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_transition_decision_v3(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_to_state text,p_expected_state_version bigint default null,p_reason text default null,p_reopen_reason text default null,p_request_id text default null,p_conditions jsonb default '[]'::jsonb,p_dissent jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; pol jsonb; authz jsonb; r jsonb; sv bigint; from_state text; tp jsonb;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for update;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision) values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1)) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  from_state:=g.workflow_state; tp:=public.thinkforge_decision_transition_policy_v1(from_state,upper(trim(p_to_state)));
  if not coalesce((tp->>'allowed')::boolean,false) then
    if coalesce((tp->>'approvalOnlyRoute')::boolean,false) then raise exception using errcode='55000',message='APPROVAL_ROUTE_REQUIRED'; else raise exception using errcode='55000',message='Invalid workflow transition'; end if;
  end if;
  if p_expected_state_version is not null and g.state_version<>p_expected_state_version then raise exception using errcode='40001',message='Decision workflow version conflict'; end if;
  authz:=public.thinkforge_decision_authorize_v2(p_user_id,p_organization_id,d.id,tp->>'action');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  if (tp->>'requiresReadiness')::boolean then
    r:=public.thinkforge_decision_readiness_v4(p_user_id,p_organization_id,d.id);
    if not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  else
    r:=public.thinkforge_decision_readiness_v4(p_user_id,p_organization_id,d.id);
  end if;
  if (tp->>'requiresReason')::boolean and nullif(trim(coalesce(case when tp->>'action'='reopen' then p_reopen_reason else p_reason end,'')),'') is null then raise exception using errcode='22023',message='Structured reason required'; end if;
  if upper(trim(p_to_state))='LEARNED' and not (coalesce((r->>'hasOutcome')::boolean,false) and coalesce((r->>'hasLearning')::boolean,false)) then raise exception using errcode='55000',message='Outcome and learning are required before LEARNED'; end if;
  sv:=g.state_version+1;
  update public.thinkforge_decision_governance set workflow_state=upper(trim(p_to_state)),state_version=sv,last_transition_reason=left(coalesce(p_reason,''),500),last_transition_at=now(),last_transition_by=p_user_id,decision_revision=coalesce(d.version,1),policy_version='stage4-v4',updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,case when tp->>'action'='reopen' then 'DECISION_REOPENED' else 'DECISION_WORKFLOW_TRANSITION' end,from_state,upper(trim(p_to_state)),p_user_id,nullif(p_reopen_reason,''),left(coalesce(p_reason,''),500),d.version,sv,jsonb_build_object('authorization',authz,'transitionPolicy',tp,'policyVersion','stage4-v4'),p_request_id);
  return jsonb_build_object('decisionId',d.id,'fromState',from_state,'workflowState',upper(trim(p_to_state)),'stateVersion',sv,'readiness',r,'authorization',authz,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_transition_decision_v3(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb) to service_role;

-- Compatibility wrapper: v2 delegates to canonical v3.
create or replace function public.thinkforge_transition_decision_v2(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_transition_decision_v3($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);
$$;
grant execute on function public.thinkforge_transition_decision_v2(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb) to service_role;

-- Legacy v1 transition adapter: never has approval authority.
create or replace function public.thinkforge_transition_decision_v1(uuid,uuid,uuid,text,bigint,text,text)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_transition_decision_v3($1,$2,$3,$4,$5,$6,null,$7,'[]'::jsonb,'[]'::jsonb);
$$;
grant execute on function public.thinkforge_transition_decision_v1(uuid,uuid,uuid,text,bigint,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 11. Canonical reopen v2. Preserve prior approval lineage.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_reopen_decision_v2(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_reason_code text,p_reason text default null,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; authz jsonb; sv bigint; prev text; prior_snapshot uuid; prior_revision bigint;
begin
  if p_reason_code not in ('new_evidence','assumption_invalidated','outcome_changed','stakeholder_change','external_condition','policy_change','data_correction','implementation_change','other') then raise exception using errcode='22023',message='Invalid reopen reason'; end if;
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for update;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id,policy_version,decision_revision) values(d.id,p_organization_id,'stage4-v4',coalesce(d.version,1)) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  if g.workflow_state not in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then raise exception using errcode='55000',message='Decision is not in a reopenable state'; end if;
  authz:=public.thinkforge_decision_authorize_v2(p_user_id,p_organization_id,d.id,'reopen');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  prev:=g.workflow_state; prior_snapshot:=g.approved_snapshot_id; prior_revision:=coalesce(g.approved_revision_number,g.revision_number); sv:=g.state_version+1;
  update public.thinkforge_decision_governance set workflow_state='INVESTIGATING',state_version=sv,reopen_count=reopen_count+1,last_reopen_reason=p_reason_code,last_reopen_at=now(),last_reopen_by=p_user_id,locked_at=null,locked_by=null,review_status='changes_requested',approved_at=null,approved_by=null,approved_snapshot_id=null,material_change_detected=false,material_change_reason='[]'::jsonb,last_transition_reason=left(coalesce(p_reason,''),500),last_transition_at=now(),last_transition_by=p_user_id,decision_revision=coalesce(d.version,1),policy_version='stage4-v4',updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,'DECISION_REOPENED',prev,'INVESTIGATING',p_user_id,p_reason_code,left(coalesce(p_reason,''),500),d.version,sv,jsonb_build_object('authorization',authz,'priorSnapshotId',prior_snapshot,'priorApprovedRevision',prior_revision,'policyVersion','stage4-v4'),p_request_id);
  return jsonb_build_object('decisionId',d.id,'fromState',prev,'workflowState','INVESTIGATING','stateVersion',sv,'reasonCode',p_reason_code,'priorSnapshotId',prior_snapshot,'priorApprovedRevision',prior_revision,'authorization',authz,'policyVersion','stage4-v4');
end $$;
grant execute on function public.thinkforge_reopen_decision_v2(uuid,uuid,uuid,text,text,text) to service_role;

create or replace function public.thinkforge_reopen_decision_v1(uuid,uuid,uuid,text,text,text)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_reopen_decision_v2($1,$2,$3,$4,$5,$6);
$$;
grant execute on function public.thinkforge_reopen_decision_v1(uuid,uuid,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 12. Child-mutation governance guards + automatic materiality markers.
-- ---------------------------------------------------------------------------
create or replace function public.thinkforge_stage4_resolve_decision_id(p_table text,p_row jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare did uuid; ref uuid;
begin
  if p_row ? 'decision_id' then return nullif(p_row->>'decision_id','')::uuid; end if;
  case p_table
    when 'thinkforge_evidence_provenance' then ref:=nullif(p_row->>'evidence_id','')::uuid; select decision_id into did from public.thinkforge_evidence where id=ref;
    when 'thinkforge_assumption_evidence_links' then ref:=nullif(p_row->>'assumption_id','')::uuid; select decision_id into did from public.thinkforge_assumptions where id=ref;
    when 'thinkforge_claim_evidence_links' then ref:=nullif(p_row->>'claim_id','')::uuid; select decision_id into did from public.thinkforge_claims where id=ref;
    when 'thinkforge_opportunity_evidence_links' then ref:=nullif(p_row->>'opportunity_id','')::uuid; select decision_id into did from public.thinkforge_opportunities where id=ref;
    when 'thinkforge_assumption_experiments' then ref:=nullif(p_row->>'assumption_id','')::uuid; select decision_id into did from public.thinkforge_assumptions where id=ref;
    when 'thinkforge_prediction_outcome_links' then ref:=nullif(p_row->>'prediction_id','')::uuid; select decision_id into did from public.thinkforge_predictions where id=ref;
    when 'thinkforge_learning_evidence_links' then ref:=nullif(p_row->>'learning_id','')::uuid; select decision_id into did from public.thinkforge_learnings where id=ref;
    when 'thinkforge_solution_assumptions' then ref:=nullif(p_row->>'assumption_id','')::uuid; select decision_id into did from public.thinkforge_assumptions where id=ref;
    else did:=null;
  end case;
  return did;
end $$;
grant execute on function public.thinkforge_stage4_resolve_decision_id(text,jsonb) to service_role;

create or replace function public.thinkforge_guard_stage4_material_child_mutation()
returns trigger language plpgsql as $$
declare did uuid; s text;
begin
  did:=public.thinkforge_stage4_resolve_decision_id(TG_TABLE_NAME,case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end);
  if did is null then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  select workflow_state into s from public.thinkforge_decision_governance where decision_id=did;
  if s in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then
    raise exception using errcode='55000',message='DECISION_REOPEN_REQUIRED: governed decision is locked; reopen before changing material decision inputs';
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'thinkforge_evidence','thinkforge_assumptions','thinkforge_challenges','thinkforge_alternatives',
    'thinkforge_experiments','thinkforge_predictions','thinkforge_claims','thinkforge_decision_contexts',
    'thinkforge_decision_participants','thinkforge_decision_approval_conditions','thinkforge_decision_dissent',
    'thinkforge_decision_reviews','thinkforge_evidence_provenance','thinkforge_assumption_evidence_links',
    'thinkforge_claim_evidence_links','thinkforge_opportunity_evidence_links','thinkforge_solution_assumptions',
    'thinkforge_assumption_experiments','thinkforge_prediction_outcome_links','thinkforge_learning_evidence_links',
    'thinkforge_decision_learning_links'
  ] LOOP
    EXECUTE format('drop trigger if exists trg_tf_stage4_lock_%I on public.%I',t,t);
    EXECUTE format('create trigger trg_tf_stage4_lock_%I before insert or update or delete on public.%I for each row execute function public.thinkforge_guard_stage4_material_child_mutation()',t,t);
  END LOOP;
END $$;

create or replace function public.thinkforge_guard_stage4_observation_mutation()
returns trigger language plpgsql as $$
declare did uuid; s text;
begin
  did:=public.thinkforge_stage4_resolve_decision_id(TG_TABLE_NAME,case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end);
  select workflow_state into s from public.thinkforge_decision_governance where decision_id=did;
  if s='LEARNED' then raise exception using errcode='55000',message='DECISION_REOPEN_REQUIRED: learned decision is immutable until explicitly reopened'; end if;
  if TG_TABLE_NAME='thinkforge_outcomes' and s<>'OBSERVING' then raise exception using errcode='55000',message='Outcome changes require OBSERVING state'; end if;
  if TG_TABLE_NAME='thinkforge_outcomes' and s is null then raise exception using errcode='55000',message='Decision governance state is required before changing outcomes'; end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
DROP TRIGGER IF EXISTS trg_tf_stage4_outcome_lock ON public.thinkforge_outcomes;
CREATE TRIGGER trg_tf_stage4_outcome_lock BEFORE INSERT OR UPDATE OR DELETE ON public.thinkforge_outcomes FOR EACH ROW EXECUTE FUNCTION public.thinkforge_guard_stage4_observation_mutation();
DROP TRIGGER IF EXISTS trg_tf_stage4_learning_lock ON public.thinkforge_learnings;
CREATE TRIGGER trg_tf_stage4_learning_lock BEFORE INSERT OR UPDATE OR DELETE ON public.thinkforge_learnings FOR EACH ROW EXECUTE FUNCTION public.thinkforge_guard_stage4_observation_mutation();

create or replace function public.thinkforge_mark_stage4_material_child_change()
returns trigger language plpgsql as $$
declare did uuid; g public.thinkforge_decision_governance%rowtype; reason jsonb; entity_id text;
begin
  did:=public.thinkforge_stage4_resolve_decision_id(TG_TABLE_NAME,case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end);
  if did is null then return case when TG_OP='DELETE' then OLD else NEW end; end if;
  select * into g from public.thinkforge_decision_governance where decision_id=did for update;
  if TG_OP='DELETE' then entity_id:=coalesce(OLD.id::text,''); else entity_id:=coalesce(NEW.id::text,''); end if;
  if g.decision_id is not null then
    reason:=jsonb_build_object('entityType',TG_TABLE_NAME,'operation',TG_OP,'entityId',entity_id,'reason',case when g.workflow_state='READY_FOR_REVIEW' then 'material_child_mutation' else 'revision' end,'policyVersion','stage4-v4','at',now());
    update public.thinkforge_decision_governance
       set decision_revision=coalesce((select version from public.thinkforge_decisions where id=did),decision_revision),
           revision_number=revision_number+1,
           material_change_detected=case when g.workflow_state='READY_FOR_REVIEW' then true else material_change_detected end,
           material_change_reason=case when g.workflow_state='READY_FOR_REVIEW' then coalesce(material_change_reason,'[]'::jsonb)||jsonb_build_array(reason) else material_change_reason end,
           review_status=case when g.workflow_state='READY_FOR_REVIEW' then 'changes_requested' else review_status end,
           updated_at=now()
     where decision_id=did;
  end if;
  return case when TG_OP='DELETE' then OLD else NEW end;
end $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'thinkforge_evidence','thinkforge_assumptions','thinkforge_challenges','thinkforge_alternatives',
    'thinkforge_experiments','thinkforge_predictions','thinkforge_claims','thinkforge_decision_contexts',
    'thinkforge_decision_participants','thinkforge_evidence_provenance','thinkforge_assumption_evidence_links',
    'thinkforge_claim_evidence_links','thinkforge_opportunity_evidence_links','thinkforge_solution_assumptions',
    'thinkforge_assumption_experiments','thinkforge_prediction_outcome_links','thinkforge_learning_evidence_links',
    'thinkforge_decision_learning_links'
  ] LOOP
    EXECUTE format('drop trigger if exists trg_tf_stage4_revision_%I on public.%I',t,t);
    EXECUTE format('create trigger trg_tf_stage4_revision_%I after insert or update or delete on public.%I for each row execute function public.thinkforge_mark_stage4_material_child_change()',t,t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 13. API compatibility + docs/test marker.
-- ---------------------------------------------------------------------------
comment on column public.thinkforge_decision_governance.decision_revision is 'Canonical domain revision from thinkforge_decisions.version.';
comment on column public.thinkforge_decision_governance.revision_number is 'Aggregate material decision revision, including child graph mutations.';
comment on column public.thinkforge_decision_governance.state_version is 'Workflow transition counter only.';
comment on column public.thinkforge_decision_governance.approved_revision_number is 'Aggregate revision captured at latest approval.';
comment on column public.thinkforge_decision_snapshots.governance_revision is 'Aggregate decision revision represented by this snapshot.';


-- The legacy snapshot API remains callable for compatibility, but delegates to the canonical Stage 4 snapshot path.
create or replace function public.thinkforge_create_decision_snapshot_v1(uuid,uuid,uuid,text,text)
returns jsonb language sql security definer set search_path=public as $$
  select public.thinkforge_create_decision_snapshot_v2($1,$2,$3,$4,$5,'decision_state');
$$;
grant execute on function public.thinkforge_create_decision_snapshot_v1(uuid,uuid,uuid,text,text) to service_role;
