-- ThinkForge Stage 1 v14.1: canonical discovery artifacts and downstream materialization.
-- Stage 1 analysis is persisted as first-class relational artifacts so downstream
-- decision/assumption/experiment workflows can consume discovery output directly.

alter table public.thinkforge_discoveries add column if not exists analysis_version text not null default 'stage1-v14.1';
alter table public.thinkforge_discoveries add column if not exists analysis_payload jsonb not null default '{}'::jsonb;
alter table public.thinkforge_research_codes add column if not exists confidence numeric(5,4) check(confidence between 0 and 1);
alter table public.thinkforge_research_codes add column if not exists client_id text;
alter table public.thinkforge_research_themes add column if not exists client_id text;
alter table public.thinkforge_research_themes add column if not exists confidence numeric(5,4) check(confidence between 0 and 1);
alter table public.thinkforge_research_themes add column if not exists evidence_ids jsonb not null default '[]'::jsonb;
alter table public.thinkforge_solutions add column if not exists rationale text;
alter table public.thinkforge_solutions add column if not exists evidence_ids jsonb not null default '[]'::jsonb;
create unique index if not exists uq_tf_research_code_client_org on public.thinkforge_research_codes(organization_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_research_theme_client_org on public.thinkforge_research_themes(organization_id,client_id) where client_id is not null;

create or replace function public.thinkforge_upsert_discovery_v2(
  p_user_id uuid,
  p_organization_id uuid,
  p_discovery jsonb,
  p_request_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid:=p_organization_id;
  v_discovery_id uuid;
  v_existing_version bigint;
  v_x jsonb;
  v_client_id text;
  v_opp_id uuid;
  v_solution_id uuid;
  v_theme_id uuid;
  v_code_id uuid;
  v_analysis_payload jsonb;
begin
  if p_user_id is null then raise exception using message='user is required'; end if;
  if v_org_id is null then
    select w.organization_id into v_org_id from public.thinkforge_workspaces w where w.user_id=p_user_id order by w.updated_at desc nulls last limit 1;
  end if;
  if v_org_id is null then
    insert into public.thinkforge_organizations(name,created_by) values('Personal workspace',p_user_id) returning id into v_org_id;
    insert into public.thinkforge_memberships(organization_id,user_id,role) values(v_org_id,p_user_id,'owner') on conflict do nothing;
  end if;
  perform public.thinkforge_require_membership(p_user_id,v_org_id,'editor');

  v_client_id:=nullif(coalesce(p_discovery->>'clientId',p_discovery->>'client_id',p_discovery->>'id'),'');
  select d.id,d.version into v_discovery_id,v_existing_version
  from public.thinkforge_discoveries d
  where d.user_id=p_user_id and d.organization_id=v_org_id and d.client_id=v_client_id
  for update;

  v_analysis_payload:=coalesce(p_discovery->'analysisPayload',jsonb_build_object(
    'gate',coalesce(p_discovery->'gate','{}'::jsonb),
    'questionUnderstanding',coalesce(p_discovery->'questionUnderstanding','{}'::jsonb),
    'methodFit',coalesce(p_discovery->'methodFit','{}'::jsonb),
    'evidenceQuality',coalesce(p_discovery->'evidenceQuality','{}'::jsonb),
    'evidenceGaps',coalesce(p_discovery->'evidenceGaps','[]'::jsonb),
    'triangulation',coalesce(p_discovery->'triangulation','{}'::jsonb)
  ));

  if v_discovery_id is null then
    insert into public.thinkforge_discoveries(user_id,organization_id,client_id,desired_outcome,research_question,question_type,method,payload,status,version,updated_by,updated_at,analysis_version,analysis_payload)
    values(p_user_id,v_org_id,v_client_id,coalesce(p_discovery->>'desiredOutcome',''),coalesce(p_discovery->>'researchQuestion',''),coalesce(p_discovery->>'questionType','exploratory'),nullif(p_discovery->>'method',''),p_discovery,coalesce(p_discovery->>'status','DRAFT'),1,p_user_id,now(),'stage1-v14.1',v_analysis_payload)
    returning id,version into v_discovery_id,v_existing_version;
  else
    v_existing_version:=v_existing_version+1;
    update public.thinkforge_discoveries d
    set desired_outcome=coalesce(p_discovery->>'desiredOutcome',d.desired_outcome),research_question=coalesce(p_discovery->>'researchQuestion',d.research_question),question_type=coalesce(p_discovery->>'questionType',d.question_type),method=nullif(p_discovery->>'method',''),payload=p_discovery,status=coalesce(p_discovery->>'status',d.status),version=v_existing_version,updated_by=p_user_id,updated_at=now(),analysis_version='stage1-v14.1',analysis_payload=v_analysis_payload,archived_at=null
    where d.id=v_discovery_id;
  end if;

  for v_x in select * from jsonb_array_elements(coalesce(p_discovery->'evidence','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_x->>'id',v_x->>'clientId',v_x->>'client_id'),'');
    insert into public.thinkforge_research_evidence(discovery_id,user_id,organization_id,level,content,source_type,source_id,participant_id,segment,quote,stance,strength,collected_at,provenance,client_id)
    values(v_discovery_id,p_user_id,v_org_id,coalesce(v_x->>'level','FACT'),coalesce(v_x->>'content',v_x->>'text',''),coalesce(v_x->>'sourceType',v_x->>'source_type','other'),nullif(coalesce(v_x->>'sourceId',v_x->>'source_id'),''),nullif(v_x->>'participantId',''),nullif(v_x->>'segment',''),nullif(v_x->>'quote',''),coalesce(v_x->>'stance','neutral'),coalesce(v_x->>'strength','medium'),case when v_x ? 'date' and nullif(v_x->>'date','') is not null then (v_x->>'date')::date else null end,coalesce(v_x->'provenance','{}'::jsonb),v_client_id)
    on conflict (discovery_id,client_id) where client_id is not null do update set content=excluded.content,source_type=excluded.source_type,source_id=excluded.source_id,participant_id=excluded.participant_id,segment=excluded.segment,quote=excluded.quote,stance=excluded.stance,strength=excluded.strength,collected_at=excluded.collected_at,provenance=excluded.provenance,organization_id=excluded.organization_id;
  end loop;

  for v_x in select * from jsonb_array_elements(coalesce(p_discovery->'codes','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_x->>'id',v_x->>'clientId',v_x->>'client_id'),'');
    select rc.id into v_code_id from public.thinkforge_research_codes rc where rc.discovery_id=v_discovery_id and rc.organization_id=v_org_id and rc.client_id=v_client_id limit 1;
    if v_code_id is null then
      insert into public.thinkforge_research_codes(discovery_id,user_id,organization_id,evidence_id,code_type,label,researcher_confirmed,confidence,client_id)
      values(v_discovery_id,p_user_id,v_org_id,(select re.id from public.thinkforge_research_evidence re where re.discovery_id=v_discovery_id and re.client_id=nullif(v_x->>'evidenceId','') limit 1),coalesce(v_x->>'type','other'),coalesce(v_x->>'label',''),coalesce((v_x->>'researcherConfirmed')::boolean,false),nullif(v_x->>'confidence','')::numeric,v_client_id)
      returning id into v_code_id;
    else
      update public.thinkforge_research_codes rc set label=coalesce(v_x->>'label',rc.label),code_type=coalesce(v_x->>'type',rc.code_type),confidence=coalesce(nullif(v_x->>'confidence','')::numeric,rc.confidence) where rc.id=v_code_id;
    end if;
  end loop;

  for v_x in select * from jsonb_array_elements(coalesce(p_discovery->'themes','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_x->>'id',v_x->>'clientId',v_x->>'client_id'),'');
    select rt.id into v_theme_id from public.thinkforge_research_themes rt where rt.discovery_id=v_discovery_id and rt.organization_id=v_org_id and rt.client_id=v_client_id limit 1;
    if v_theme_id is null then
      insert into public.thinkforge_research_themes(organization_id,discovery_id,client_id,label,description,status,created_by,confidence,evidence_ids)
      values(v_org_id,v_discovery_id,v_client_id,coalesce(v_x->>'label',''),nullif(v_x->>'description',''),coalesce(v_x->>'status','candidate'),p_user_id,nullif(v_x->>'confidence','')::numeric,coalesce(v_x->'evidenceIds','[]'::jsonb))
      returning id into v_theme_id;
    else
      update public.thinkforge_research_themes rt set label=coalesce(v_x->>'label',rt.label),description=coalesce(v_x->>'description',rt.description),status=coalesce(v_x->>'status',rt.status),confidence=coalesce(nullif(v_x->>'confidence','')::numeric,rt.confidence),evidence_ids=coalesce(v_x->'evidenceIds',rt.evidence_ids),updated_at=now() where rt.id=v_theme_id;
    end if;
  end loop;

  for v_x in select * from jsonb_array_elements(coalesce(p_discovery->'opportunities','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_x->>'id',v_x->>'clientId',v_x->>'client_id'),'');
    select o.id into v_opp_id from public.thinkforge_opportunities o where o.organization_id=v_org_id and o.client_id=v_client_id limit 1;
    if v_opp_id is null then
      insert into public.thinkforge_opportunities(discovery_id,user_id,organization_id,client_id,label,evidence_ids,customer_importance,customer_reach,strategic_relevance,evidence_strength,market_relevance,score,status,problem_statement,target_segment,rationale,updated_by,updated_at)
      values(v_discovery_id,p_user_id,v_org_id,v_client_id,coalesce(v_x->>'label',v_x->>'text','Opportunity'),coalesce(v_x->'evidenceIds','[]'::jsonb),nullif(v_x->>'customerImportance','')::int,nullif(v_x->>'customerReach','')::int,nullif(v_x->>'strategicRelevance','')::int,nullif(v_x->>'evidenceStrength','')::int,nullif(v_x->>'marketRelevance','')::int,nullif(v_x->>'score','')::numeric,coalesce(v_x->>'status','candidate'),nullif(v_x->>'problemStatement',''),nullif(v_x->>'targetSegment',''),nullif(v_x->>'rationale',''),p_user_id,now())
      returning id into v_opp_id;
    else
      update public.thinkforge_opportunities o set label=coalesce(v_x->>'label',o.label),evidence_ids=coalesce(v_x->'evidenceIds',o.evidence_ids),score=coalesce(nullif(v_x->>'score','')::numeric,o.score),status=coalesce(v_x->>'status',o.status),problem_statement=coalesce(v_x->>'problemStatement',o.problem_statement),target_segment=coalesce(v_x->>'targetSegment',o.target_segment),rationale=coalesce(v_x->>'rationale',o.rationale),version=o.version+1,updated_by=p_user_id,updated_at=now(),archived_at=null where o.id=v_opp_id;
    end if;
  end loop;

  for v_x in select * from jsonb_array_elements(coalesce(p_discovery->'solutions','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_x->>'id',v_x->>'clientId',v_x->>'client_id'),'');
    select o.id into v_opp_id from public.thinkforge_opportunities o where o.organization_id=v_org_id and o.client_id=nullif(v_x->>'opportunityId','') limit 1;
    select s.id into v_solution_id from public.thinkforge_solutions s where s.organization_id=v_org_id and s.client_id=v_client_id limit 1;
    if v_solution_id is null then
      insert into public.thinkforge_solutions(organization_id,discovery_id,opportunity_id,client_id,title,description,status,desirability_score,feasibility_score,viability_score,risk_score,rationale,evidence_ids,created_by,updated_by,updated_at)
      values(v_org_id,v_discovery_id,v_opp_id,v_client_id,coalesce(v_x->>'title',v_x->>'label','Solution'),nullif(v_x->>'description',''),coalesce(v_x->>'status','candidate'),nullif(v_x->>'desirabilityScore','')::numeric,nullif(v_x->>'feasibilityScore','')::numeric,nullif(v_x->>'viabilityScore','')::numeric,nullif(v_x->>'riskScore','')::numeric,nullif(v_x->>'rationale',''),coalesce(v_x->'evidenceIds','[]'::jsonb),p_user_id,p_user_id,now())
      returning id into v_solution_id;
    else
      update public.thinkforge_solutions s set opportunity_id=v_opp_id,title=coalesce(v_x->>'title',v_x->>'label',s.title),description=coalesce(v_x->>'description',s.description),status=coalesce(v_x->>'status',s.status),desirability_score=coalesce(nullif(v_x->>'desirabilityScore','')::numeric,s.desirability_score),feasibility_score=coalesce(nullif(v_x->>'feasibilityScore','')::numeric,s.feasibility_score),viability_score=coalesce(nullif(v_x->>'viabilityScore','')::numeric,s.viability_score),risk_score=coalesce(nullif(v_x->>'riskScore','')::numeric,s.risk_score),rationale=coalesce(v_x->>'rationale',s.rationale),evidence_ids=coalesce(v_x->'evidenceIds',s.evidence_ids),updated_by=p_user_id,updated_at=now(),archived_at=null where s.id=v_solution_id;
    end if;
  end loop;

  return jsonb_build_object('discoveryId',v_discovery_id,'organizationId',v_org_id,'version',v_existing_version,'sourceOfTruth','relational','analysisVersion','stage1-v14.1','materialized',jsonb_build_array('research_codes','research_themes','opportunities','solutions'),'requestId',p_request_id);
end $$;

grant execute on function public.thinkforge_upsert_discovery_v2(uuid,uuid,jsonb,text) to service_role;
