-- ThinkForge canonical write-path consolidation.
-- PostgreSQL relational graph is authoritative; workspace JSON is a derived compatibility cache.

create or replace function public.thinkforge_sync_workspace_v3(
  p_user_id uuid,
  p_state jsonb,
  p_expected_version bigint default null,
  p_request_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  org_id uuid;
  current_version bigint;
  d jsonb;
  graph jsonb;
  results jsonb:='[]'::jsonb;
  decision_ids jsonb:='[]'::jsonb;
begin
  if p_user_id is null then raise exception using message='user is required'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception using message='workspace state must be an object'; end if;

  select organization_id,version into org_id,current_version
  from public.thinkforge_workspaces
  where user_id=p_user_id
  for update;

  if org_id is null then
    insert into public.thinkforge_organizations(name,created_by)
    values('Personal workspace',p_user_id) returning id into org_id;
    insert into public.thinkforge_memberships(organization_id,user_id,role)
    values(org_id,p_user_id,'owner')
    on conflict do nothing;
  end if;

  if current_version is not null and p_expected_version is not null and current_version<>p_expected_version then
    raise exception using errcode='40001',message='Workspace version conflict';
  end if;

  -- canonical graph is written FIRST. Any exception aborts the transaction and leaves the cache unchanged.
  for d in select * from jsonb_array_elements(coalesce(p_state->'decisions','[]'::jsonb)) loop
    graph:=jsonb_build_object(
      'decision',d,
      'assumptions',coalesce(d->'assumptions','[]'::jsonb),
      'evidence',coalesce(d->'evidence','[]'::jsonb),
      'challenges',coalesce(d->'challenges','[]'::jsonb),
      'alternatives',coalesce(d->'alternatives','[]'::jsonb),
      'experiments',case when d->'experiment' is null then '[]'::jsonb else jsonb_build_array((d->'experiment') || jsonb_build_object('id',concat(coalesce(d->>'id','decision'),'-experiment'))) end,
      'predictions',case when d->'prediction' is null then '[]'::jsonb else jsonb_build_array((d->'prediction') || jsonb_build_object('id',concat(coalesce(d->>'id','decision'),'-prediction'))) end,
      'outcomes',case when d->'outcome' is null then '[]'::jsonb else jsonb_build_array((d->'outcome') || jsonb_build_object('id',concat(coalesce(d->>'id','decision'),'-outcome'),'predictionId',concat(coalesce(d->>'id','decision'),'-prediction'))) end,
      'learnings',case when d->>'learning' is null or d->>'learning'='' then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id',concat('learn-',coalesce(d->>'id',gen_random_uuid()::text)),'statement',d->>'learning','evidence_refs','[]'::jsonb)) end
    );
    results:=results || jsonb_build_array(public.thinkforge_upsert_decision_graph_v2(p_user_id,org_id,graph,null,p_request_id));
    decision_ids:=decision_ids || jsonb_build_array(coalesce(d->>'id',''));
  end loop;

  -- Only after the canonical graph commits inside this transaction do we refresh the compatibility cache.
  if current_version is null then
    insert into public.thinkforge_workspaces(user_id,organization_id,state,version,updated_by,updated_at)
    values(p_user_id,org_id,p_state,1,p_user_id,now());
    current_version:=1;
  else
    current_version:=current_version+1;
    update public.thinkforge_workspaces
    set organization_id=org_id,state=p_state,version=current_version,updated_by=p_user_id,updated_at=now()
    where user_id=p_user_id;
  end if;

  return jsonb_build_object(
    'version',current_version,
    'organizationId',org_id,
    'sourceOfTruth','relational',
    'workspaceCache','derived_compatibility',
    'decisionIds',decision_ids,
    'canonicalWrites',results
  );
end $$;

grant execute on function public.thinkforge_sync_workspace_v3(uuid,jsonb,bigint,text) to service_role;

-- Canonical discovery persistence. Discovery and its child records are written transactionally.
alter table public.thinkforge_research_evidence add column if not exists client_id text;
create unique index if not exists uq_tf_research_evidence_discovery_client on public.thinkforge_research_evidence(discovery_id,client_id) where client_id is not null;

create or replace function public.thinkforge_upsert_discovery_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_discovery jsonb,
  p_request_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  org_id uuid:=p_organization_id;
  discovery_id uuid;
  r jsonb;
  x jsonb;
  client_id text;
  current_version bigint;
begin
  if p_user_id is null then raise exception using message='user is required'; end if;
  if org_id is null then
    select organization_id into org_id from public.thinkforge_workspaces where user_id=p_user_id order by updated_at desc nulls last limit 1;
  end if;
  if org_id is null then
    insert into public.thinkforge_organizations(name,created_by) values('Personal workspace',p_user_id) returning id into org_id;
    insert into public.thinkforge_memberships(organization_id,user_id,role) values(org_id,p_user_id,'owner') on conflict do nothing;
  end if;
  perform public.thinkforge_require_membership(p_user_id,org_id,'editor');

  client_id:=nullif(coalesce(p_discovery->>'clientId',p_discovery->>'client_id',p_discovery->>'id'),'');
  select id,version into discovery_id,current_version
  from public.thinkforge_discoveries
  where user_id=p_user_id and organization_id=org_id and client_id=client_id
  for update;

  if discovery_id is null then
    insert into public.thinkforge_discoveries(user_id,organization_id,client_id,desired_outcome,research_question,question_type,method,payload,status,version,updated_by,updated_at)
    values(p_user_id,org_id,client_id,coalesce(p_discovery->>'desiredOutcome',''),coalesce(p_discovery->>'researchQuestion',''),coalesce(p_discovery->>'questionType','exploratory'),nullif(p_discovery->>'method',''),p_discovery,coalesce(p_discovery->>'status','DRAFT'),1,p_user_id,now())
    returning id,version into discovery_id,current_version;
  else
    current_version:=current_version+1;
    update public.thinkforge_discoveries set desired_outcome=coalesce(p_discovery->>'desiredOutcome',desired_outcome),research_question=coalesce(p_discovery->>'researchQuestion',research_question),question_type=coalesce(p_discovery->>'questionType',question_type),method=nullif(p_discovery->>'method',''),payload=p_discovery,status=coalesce(p_discovery->>'status',status),version=current_version,updated_by=p_user_id,updated_at=now(),archived_at=null where id=discovery_id;
  end if;

  -- Research evidence keeps a stable client_id separate from its DB UUID so UI IDs such as E-123 remain valid.
  for x in select * from jsonb_array_elements(coalesce(p_discovery->'evidence','[]'::jsonb)) loop
    client_id:=nullif(coalesce(x->>'id',x->>'clientId',x->>'client_id'),'');
    insert into public.thinkforge_research_evidence(discovery_id,user_id,organization_id,level,content,source_type,source_id,participant_id,segment,quote,stance,strength,collected_at,provenance,client_id)
    values(discovery_id,p_user_id,org_id,coalesce(x->>'level','FACT'),coalesce(x->>'content',x->>'text',''),coalesce(x->>'sourceType',x->>'source_type','other'),nullif(coalesce(x->>'sourceId',x->>'source_id'),''),nullif(x->>'participantId',''),nullif(x->>'segment',''),nullif(x->>'quote',''),coalesce(x->>'stance','neutral'),coalesce(x->>'strength','medium'),case when x ? 'date' and nullif(x->>'date','') is not null then (x->>'date')::date else null end,coalesce(x->'provenance','{}'::jsonb),client_id)
    on conflict (discovery_id,client_id) where client_id is not null do update set content=excluded.content,source_type=excluded.source_type,source_id=excluded.source_id,participant_id=excluded.participant_id,segment=excluded.segment,quote=excluded.quote,stance=excluded.stance,strength=excluded.strength,collected_at=excluded.collected_at,provenance=excluded.provenance,organization_id=excluded.organization_id;
  end loop;

  return jsonb_build_object('discoveryId',discovery_id,'organizationId',org_id,'version',current_version,'sourceOfTruth','relational','workspaceCache','not_used');
end $$;

grant execute on function public.thinkforge_upsert_discovery_v1(uuid,uuid,jsonb,text) to service_role;

-- A read-only integrity view makes source-of-truth drift measurable.
create or replace view public.thinkforge_canonical_write_paths_v1 as
select 'workspace'::text as resource,'thinkforge_sync_workspace_v3'::text as writer,'relational_first_then_cache'::text as policy
union all select 'decision_graph','thinkforge_upsert_decision_graph_v2','relational'
union all select 'discovery','thinkforge_upsert_discovery_v1','relational';
