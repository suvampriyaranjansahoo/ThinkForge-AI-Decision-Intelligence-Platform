-- ThinkForge Stage 4.1 — canonical governance policy boundary.
-- The database is authoritative for readiness and authority. Application
-- modules may preview policy, but they must not authorize or approve actions.

create or replace function public.thinkforge_decision_governance_policy_v1(
  p_rigor text default 'standard'
) returns jsonb language sql immutable as $$
  select case lower(coalesce(p_rigor,'standard'))
    when 'quick' then jsonb_build_object('version','stage4-v3','rigor','quick','minimumEvidence',1,'minQuality',0.55,'minSegmentCoverage',0.25,'optionsMinimum',1,'reviewRequired',false,'expiryDays',90)
    when 'significant' then jsonb_build_object('version','stage4-v3','rigor','significant','minimumEvidence',3,'minQuality',0.75,'minSegmentCoverage',0.65,'optionsMinimum',2,'reviewRequired',true,'expiryDays',120)
    when 'high_stakes' then jsonb_build_object('version','stage4-v3','rigor','high_stakes','minimumEvidence',4,'minQuality',0.85,'minSegmentCoverage',0.80,'optionsMinimum',3,'reviewRequired',true,'expiryDays',90)
    else jsonb_build_object('version','stage4-v3','rigor','standard','minimumEvidence',2,'minQuality',0.65,'minSegmentCoverage',0.50,'optionsMinimum',2,'reviewRequired',true,'expiryDays',180)
  end;
$$;

grant execute on function public.thinkforge_decision_governance_policy_v1(text) to service_role;

-- Canonical action-authority evaluator. This is the only database policy boundary
-- for decision workflow mutations; UI/API role hints are never trusted.
create or replace function public.thinkforge_decision_authorize_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid,
  p_action text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  action text := lower(trim(coalesce(p_action,'')));
  is_org_owner boolean := false;
  decision_role text;
  allowed boolean := false;
  reason text := null;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.role in ('owner','admin')) into is_org_owner;
  select dp.role into decision_role from public.thinkforge_decision_participants dp where dp.organization_id=p_organization_id and dp.decision_id=p_decision_id and dp.user_id=p_user_id order by case dp.role when 'owner' then 1 when 'approver' then 2 when 'reviewer' then 3 when 'contributor' then 4 else 5 end limit 1;
  case action
    when 'view' then allowed := true;
    when 'edit' then allowed := is_org_owner or decision_role in ('owner','contributor');
    when 'submit_review' then allowed := is_org_owner or decision_role in ('owner','contributor');
    when 'review' then allowed := is_org_owner or decision_role in ('owner','reviewer','approver');
    when 'approve' then allowed := is_org_owner or decision_role in ('owner','approver');
    when 'reopen' then allowed := is_org_owner or decision_role in ('owner','approver') or exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.role='editor');
    when 'archive' then allowed := is_org_owner;
    when 'execute' then allowed := is_org_owner or decision_role='owner' or exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=p_user_id and m.role='editor');
    else reason := 'UNKNOWN_ACTION';
  end case;
  if not allowed and reason is null then reason := upper(action)||'_NOT_AUTHORIZED'; end if;
  return jsonb_build_object('allowed',allowed,'action',action,'organizationId',p_organization_id,'decisionId',p_decision_id,'actorId',p_user_id,'decisionRole',decision_role,'orgOwnerOrAdmin',is_org_owner,'reason',reason,'policyVersion','stage4-v3');
end $$;

grant execute on function public.thinkforge_decision_authorize_v1(uuid,uuid,uuid,text) to service_role;

-- Replace readiness v2 with a policy-versioned authoritative implementation.
create or replace function public.thinkforge_decision_readiness_v2(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  d public.thinkforge_decisions%rowtype;
  g public.thinkforge_decision_governance%rowtype;
  base jsonb;
  p jsonb;
  blockers jsonb := '[]'::jsonb;
  evidence_count int := 0;
  evidence_quality numeric := 0;
  evidence_coverage numeric := 0;
  evidence_freshness numeric := 0;
  unresolved_critical int := 0;
  high_contradictions int := 0;
  option_count int := 0;
  rigor text;
  ready boolean;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id and organization_id=p_organization_id;
  rigor := coalesce(g.rigor_level,'standard');
  p := public.thinkforge_decision_governance_policy_v1(rigor);
  base := public.thinkforge_decision_readiness_v1(p_user_id,p_organization_id,p_decision_id);

  select count(*),
    coalesce(avg(case lower(coalesce(e.strength,'medium')) when 'strong' then 1 when 'high' then 1 when 'medium' then .65 when 'weak' then .30 when 'low' then .20 else .50 end),0),
    coalesce(avg(case when e.collected_at is null then .5 when e.collected_at >= now()-interval '90 days' then 1 when e.collected_at >= now()-interval '365 days' then .65 else .25 end),0)
  into evidence_count,evidence_quality,evidence_freshness
  from public.thinkforge_evidence e
  where e.decision_id=d.id and e.organization_id=p_organization_id and e.archived_at is null;

  select case when count(*)=0 then case when evidence_count>0 then 1 else 0 end
    else count(*) filter(where exists(select 1 from public.thinkforge_assumption_evidence_links l where l.assumption_id=a.id and l.organization_id=p_organization_id))::numeric/count(*)::numeric end
  into evidence_coverage
  from public.thinkforge_assumptions a
  where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null;

  select count(*) into unresolved_critical from public.thinkforge_assumptions a
  where a.decision_id=d.id and a.organization_id=p_organization_id and a.archived_at is null
    and lower(coalesce(a.status,'open')) not in ('validated','supported')
    and (coalesce(a.leap_of_faith,false) or coalesce(a.criticality,0)>=.75 or coalesce(a.impact,0)*coalesce(a.uncertainty,0)>=16);

  select count(*) into high_contradictions from public.thinkforge_contradictions c
  where c.decision_id=d.id and c.organization_id=p_organization_id
    and lower(coalesce(c.status,'open')) not in ('resolved','accepted','dismissed')
    and lower(coalesce(c.severity,'medium')) in ('high','critical');

  select count(*) into option_count from public.thinkforge_alternatives a where a.decision_id=d.id and a.organization_id=p_organization_id;


  if coalesce(nullif(d.title,''),null) is null or coalesce(nullif(d.problem,''),null) is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','MISSING_DECISION_CONTEXT','severity','critical','label','Define the decision question and problem.'));
  end if;
  if evidence_count < (p->>'minimumEvidence')::int then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_EVIDENCE','severity','critical','label',format('At least %s evidence item(s) required for %s rigor.',p->>'minimumEvidence',rigor)));
  end if;
  if evidence_quality < (p->>'minQuality')::numeric then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_EVIDENCE_QUALITY','severity','high','label',format('Evidence quality %.0f%% is below the %.0f%% threshold.',evidence_quality*100,(p->>'minQuality')::numeric*100)));
  end if;
  if evidence_coverage < (p->>'minSegmentCoverage')::numeric then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','LOW_EVIDENCE_COVERAGE','severity','high','label',format('Evidence coverage %.0f%% is below the %.0f%% threshold.',evidence_coverage*100,(p->>'minSegmentCoverage')::numeric*100)));
  end if;
  if unresolved_critical>0 and (p->>'rigor') in ('standard','significant','high_stakes') then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','CRITICAL_ASSUMPTIONS_OPEN','severity','critical','label',format('%s critical assumption(s) unresolved.',unresolved_critical)));
  end if;
  if high_contradictions>0 and (p->>'rigor') <> 'quick' then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','HIGH_CONTRADICTION','severity','critical','label',format('%s high-severity contradiction(s) unresolved.',high_contradictions)));
  end if;
  if option_count < (p->>'optionsMinimum')::int then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code','INSUFFICIENT_OPTIONS','severity','high','label',format('At least %s credible options are required for %s rigor.',p->>'optionsMinimum',rigor)));
  end if;
  ready := jsonb_array_length(blockers)=0;
  return jsonb_build_object('governanceVersion','stage4-v3','rigorLevel',rigor,'policy',p,'evidenceCount',evidence_count,'evidenceQuality',round(evidence_quality,3),'evidenceCoverage',round(evidence_coverage,3),'evidenceFreshness',round(evidence_freshness,3),'criticalOpenAssumptions',unresolved_critical,'highSeverityContradictions',high_contradictions,'optionCount',option_count,'hasOutcome',coalesce((base->>'hasOutcome')::boolean,false),'hasLearning',coalesce((base->>'hasLearning')::boolean,false),'blockers',blockers,'readyForReview',ready,'nextAction',case when not ready then blockers->0->>'label' else 'Ready for governed review.' end);
end $$;

grant execute on function public.thinkforge_decision_readiness_v2(uuid,uuid,uuid) to service_role;

-- Canonical v2 transition endpoint: all authority + readiness checks occur here.
create or replace function public.thinkforge_transition_decision_v2(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_to_state text,p_expected_state_version bigint default null,
  p_reason text default null,p_reopen_reason text default null,p_request_id text default null,p_conditions jsonb default '[]'::jsonb,p_dissent jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  g public.thinkforge_decision_governance%rowtype;
  d public.thinkforge_decisions%rowtype;
  r jsonb;
  authz jsonb;
  from_state text;
  to_state text := upper(trim(p_to_state));
  sv bigint;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id for update;
  from_state := g.workflow_state;
  if p_expected_state_version is not null and g.state_version<>p_expected_state_version then raise exception using errcode='40001',message='Decision workflow version conflict'; end if;
  if to_state not in ('DRAFT','INVESTIGATING','READY_FOR_REVIEW','APPROVED','EXECUTING','OBSERVING','LEARNED','ARCHIVED') then raise exception using errcode='22023',message='Invalid workflow state'; end if;
  if from_state='DRAFT' and to_state not in ('INVESTIGATING','ARCHIVED') then raise exception using errcode='55000',message='Invalid DRAFT transition'; end if;
  if from_state='INVESTIGATING' and to_state not in ('READY_FOR_REVIEW','DRAFT','ARCHIVED') then raise exception using errcode='55000',message='Invalid INVESTIGATING transition'; end if;
  if from_state='READY_FOR_REVIEW' and to_state not in ('APPROVED','INVESTIGATING','ARCHIVED') then raise exception using errcode='55000',message='Invalid READY_FOR_REVIEW transition'; end if;
  if from_state='APPROVED' and to_state not in ('EXECUTING','INVESTIGATING','ARCHIVED') then raise exception using errcode='55000',message='Invalid APPROVED transition'; end if;
  if from_state='EXECUTING' and to_state not in ('OBSERVING','INVESTIGATING') then raise exception using errcode='55000',message='Invalid EXECUTING transition'; end if;
  if from_state='OBSERVING' and to_state not in ('LEARNED','INVESTIGATING') then raise exception using errcode='55000',message='Invalid OBSERVING transition'; end if;
  if from_state='LEARNED' and to_state not in ('ARCHIVED','INVESTIGATING') then raise exception using errcode='55000',message='Invalid LEARNED transition'; end if;
  if from_state='ARCHIVED' then raise exception using errcode='55000',message='Archived decision cannot transition'; end if;
  authz := public.thinkforge_decision_authorize_v1(p_user_id,p_organization_id,d.id,case when to_state='APPROVED' then 'approve' when to_state='EXECUTING' then 'execute' when to_state='ARCHIVED' then 'archive' when to_state='INVESTIGATING' and from_state in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then 'reopen' else 'edit' end);
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  r := public.thinkforge_decision_readiness_v2(p_user_id,p_organization_id,d.id);
  if to_state='READY_FOR_REVIEW' and not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  if to_state='APPROVED' and not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  if to_state='INVESTIGATING' and from_state in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then
    if lower(trim(coalesce(p_reopen_reason,''))) not in ('new_evidence','assumption_invalidated','outcome_changed','stakeholder_change','external_condition','policy_change','data_correction','implementation_change','other') then raise exception using errcode='22023',message='Structured reopen reason required'; end if;
  end if;
  if to_state='LEARNED' and not (coalesce((r->>'hasOutcome')::boolean,false) and coalesce((r->>'hasLearning')::boolean,false)) then
    raise exception using errcode='55000',message='Outcome and learning are required before LEARNED';
  end if;
  sv:=g.state_version+1;
  update public.thinkforge_decision_governance set workflow_state=to_state,state_version=sv,last_transition_reason=left(coalesce(p_reason,''),500),last_transition_at=now(),last_transition_by=p_user_id,updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,case when to_state='INVESTIGATING' and from_state in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then 'DECISION_REOPENED' else 'DECISION_WORKFLOW_TRANSITION' end,from_state,to_state,p_user_id,nullif(p_reopen_reason,''),left(coalesce(p_reason,''),500),d.version,sv,jsonb_build_object('authorization',authz,'readiness',r),p_request_id);
  return jsonb_build_object('decisionId',d.id,'fromState',from_state,'workflowState',to_state,'stateVersion',sv,'readiness',r,'authorization',authz,'policyVersion','stage4-v3');
end $$;

grant execute on function public.thinkforge_transition_decision_v2(uuid,uuid,uuid,text,bigint,text,text,text,jsonb,jsonb) to service_role;

-- Rebind approval/reopen to the same canonical authority function used by transitions.
create or replace function public.thinkforge_approve_decision_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_conditions jsonb default '[]'::jsonb,
  p_dissent jsonb default '[]'::jsonb,p_review jsonb default '{}'::jsonb,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype; g public.thinkforge_decision_governance%rowtype; r jsonb; authz jsonb; snap jsonb; sid uuid; sv bigint;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id and organization_id=p_organization_id for update;
  authz:=public.thinkforge_decision_authorize_v1(p_user_id,p_organization_id,d.id,'approve');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  r:=public.thinkforge_decision_readiness_v2(p_user_id,p_organization_id,d.id);
  if not coalesce((r->>'readyForReview')::boolean,false) then raise exception using errcode='55000',message='Decision readiness gates are not satisfied'; end if;
  if coalesce(g.review_status,'not_started')<>'approved' and coalesce((r->'policy'->>'reviewRequired')::boolean,true) and not (coalesce(p_review->>'status','') in ('approved','pass','ready')) then
    raise exception using errcode='55000',message='Designated review must be completed before approval';
  end if;
  sv:=g.state_version+1;
  update public.thinkforge_decision_governance set review_status='approved',reviewed_by=coalesce(nullif(p_review->>'reviewedBy','')::uuid,p_user_id),reviewed_at=now(),review_notes=left(coalesce(p_review->>'notes',''),1000),approval_conditions=coalesce(p_conditions,'[]'::jsonb),dissent=coalesce(p_dissent,'[]'::jsonb),workflow_state='APPROVED',state_version=sv,approved_at=now(),approved_by=p_user_id,locked_at=now(),locked_by=p_user_id,revision_number=revision_number+1,readiness=r,confidence_breakdown=jsonb_build_object('governedConfidence',r->>'governedConfidence','evidenceQuality',r->>'evidenceQuality','evidenceCoverage',r->>'evidenceCoverage','evidenceFreshness',r->>'evidenceFreshness'),decision_contract=jsonb_build_object('decisionId',d.id,'title',d.title,'problem',d.problem,'workflowState','APPROVED','rigor',g.rigor_level,'policyVersion','stage4-v3','approvedAt',now()) where decision_id=d.id returning state_version into sv;
  snap:=public.thinkforge_create_decision_snapshot_v1(p_user_id,p_organization_id,d.id,'decision_approved',p_request_id); sid:=(snap->>'snapshotId')::uuid;
  update public.thinkforge_decision_governance set approved_snapshot_id=sid,decision_contract=decision_contract||jsonb_build_object('snapshotId',sid,'snapshotHash',snap->>'snapshotHash') where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,snapshot_hash,metadata,request_id) values(p_organization_id,d.id,'DECISION_APPROVED',g.workflow_state,'APPROVED',p_user_id,null,'Explicit approval',d.version,sv,snap->>'snapshotHash',jsonb_build_object('authorization',authz,'review',p_review,'conditions',p_conditions,'dissent',p_dissent,'policyVersion','stage4-v3'),p_request_id);
  return jsonb_build_object('decisionId',d.id,'workflowState','APPROVED','stateVersion',sv,'snapshotId',sid,'snapshotHash',snap->>'snapshotHash','readiness',r,'authorization',authz,'policyVersion','stage4-v3');
end $$;
grant execute on function public.thinkforge_approve_decision_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) to service_role;

create or replace function public.thinkforge_reopen_decision_v1(
  p_user_id uuid,p_organization_id uuid,p_decision_id uuid,p_reason_code text,p_reason text default null,p_request_id text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.thinkforge_decision_governance%rowtype; d public.thinkforge_decisions%rowtype; authz jsonb; sv bigint; prev text;
begin
  if p_reason_code not in ('new_evidence','assumption_invalidated','outcome_changed','stakeholder_change','external_condition','policy_change','data_correction','implementation_change','other') then raise exception using errcode='22023',message='Invalid reopen reason'; end if;
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  insert into public.thinkforge_decision_governance(decision_id,organization_id) values(d.id,p_organization_id) on conflict(decision_id) do nothing;
  select * into g from public.thinkforge_decision_governance where decision_id=d.id and organization_id=p_organization_id for update;
  if g.workflow_state not in ('APPROVED','EXECUTING','OBSERVING','LEARNED') then raise exception using errcode='55000',message='Decision is not in a reopenable state'; end if;
  authz:=public.thinkforge_decision_authorize_v1(p_user_id,p_organization_id,d.id,'reopen');
  if not coalesce((authz->>'allowed')::boolean,false) then raise exception using errcode='42501',message:=(authz->>'reason'); end if;
  prev:=g.workflow_state; sv:=g.state_version+1;
  update public.thinkforge_decision_governance set workflow_state='INVESTIGATING',state_version=sv,reopen_count=reopen_count+1,last_reopen_reason=p_reason_code,last_reopen_at=now(),last_reopen_by=p_user_id,locked_at=null,locked_by=null,review_status='changes_requested',approved_at=null,approved_by=null,approved_snapshot_id=null,material_change_detected=false,material_change_reason='[]'::jsonb,last_transition_reason=left(coalesce(p_reason,''),500),last_transition_at=now(),last_transition_by=p_user_id,updated_at=now() where decision_id=d.id;
  insert into public.thinkforge_decision_governance_events(organization_id,decision_id,event_type,from_state,to_state,actor_id,reason_code,reason,decision_version,state_version,metadata,request_id) values(p_organization_id,d.id,'DECISION_REOPENED',prev,'INVESTIGATING',p_user_id,p_reason_code,left(coalesce(p_reason,''),500),d.version,sv,jsonb_build_object('authorization',authz,'reopenCount',g.reopen_count+1,'policyVersion','stage4-v3'),p_request_id);
  return jsonb_build_object('decisionId',d.id,'fromState',prev,'workflowState','INVESTIGATING','stateVersion',sv,'reasonCode',p_reason_code,'authorization',authz,'policyVersion','stage4-v3');
end $$;
grant execute on function public.thinkforge_reopen_decision_v1(uuid,uuid,uuid,text,text,text) to service_role;
