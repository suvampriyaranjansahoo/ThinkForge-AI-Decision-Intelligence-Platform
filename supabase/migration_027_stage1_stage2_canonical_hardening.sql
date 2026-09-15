-- ThinkForge v14.7.1 Stage 1/2 canonical hardening.
-- Additive and backward-compatible. Production authority remains relational.
create extension if not exists pgcrypto;

alter table public.thinkforge_discoveries add column if not exists aggregate_revision bigint not null default 1;
alter table public.thinkforge_discoveries add column if not exists analysis_schema_version text not null default 'discovery-semantic-v2';
alter table public.thinkforge_discoveries add column if not exists policy_version text not null default 'stage1-v2';

alter table public.thinkforge_research_sessions add column if not exists client_id text;
alter table public.thinkforge_research_sessions add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_sessions add column if not exists archived_at timestamptz;
alter table public.thinkforge_research_participants add column if not exists client_id text;
alter table public.thinkforge_research_participants add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_participants add column if not exists archived_at timestamptz;
alter table public.thinkforge_research_observations add column if not exists client_id text;
alter table public.thinkforge_research_observations add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_observations add column if not exists archived_at timestamptz;

create unique index if not exists uq_tf_research_session_client_org on public.thinkforge_research_sessions(organization_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_research_participant_client_org on public.thinkforge_research_participants(organization_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_research_observation_client_org on public.thinkforge_research_observations(organization_id,client_id) where client_id is not null;

-- Discovery claims are first-class and do not replace decision claims.
create table if not exists public.thinkforge_discovery_claims(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  discovery_id uuid not null references public.thinkforge_discoveries(id) on delete cascade,
  client_id text not null,
  text text not null,
  support_status text not null default 'NOT_VERIFIABLE' check(support_status in ('SUPPORTED','PARTIALLY_SUPPORTED','UNSUPPORTED','CONTRADICTED','NOT_VERIFIABLE')),
  uncertainty text not null default 'medium' check(uncertainty in ('low','medium','high')),
  confidence numeric(5,4) check(confidence between 0 and 1),
  rationale text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1,
  archived_at timestamptz
);
create unique index if not exists uq_tf_discovery_claim_client on public.thinkforge_discovery_claims(organization_id,discovery_id,client_id);
create index if not exists idx_tf_discovery_claim_discovery on public.thinkforge_discovery_claims(discovery_id,updated_at desc);

create table if not exists public.thinkforge_discovery_claim_evidence(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  claim_id uuid not null references public.thinkforge_discovery_claims(id) on delete cascade,
  evidence_id uuid not null references public.thinkforge_research_evidence(id) on delete cascade,
  stance text not null default 'supports' check(stance in ('supports','contradicts','neutral')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(claim_id,evidence_id)
);
create index if not exists idx_tf_discovery_claim_evidence_org on public.thinkforge_discovery_claim_evidence(organization_id,claim_id);

create table if not exists public.thinkforge_discovery_theme_evidence(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  theme_id uuid not null references public.thinkforge_research_themes(id) on delete cascade,
  evidence_id uuid not null references public.thinkforge_research_evidence(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(theme_id,evidence_id)
);
create index if not exists idx_tf_discovery_theme_evidence_org on public.thinkforge_discovery_theme_evidence(organization_id,theme_id);

alter table public.thinkforge_discovery_claims enable row level security;
alter table public.thinkforge_discovery_claim_evidence enable row level security;
alter table public.thinkforge_discovery_theme_evidence enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname='tf_discovery_claims_org' and tablename='thinkforge_discovery_claims') then
    create policy tf_discovery_claims_org on public.thinkforge_discovery_claims for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
  end if;
  if not exists (select 1 from pg_policies where policyname='tf_discovery_claim_evidence_org' and tablename='thinkforge_discovery_claim_evidence') then
    create policy tf_discovery_claim_evidence_org on public.thinkforge_discovery_claim_evidence for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
  end if;
  if not exists (select 1 from pg_policies where policyname='tf_discovery_theme_evidence_org' and tablename='thinkforge_discovery_theme_evidence') then
    create policy tf_discovery_theme_evidence_org on public.thinkforge_discovery_theme_evidence for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
  end if;
end $$;

do $$ begin
  if to_regclass('public.thinkforge_guard_graph_link_org') is not null then
    execute 'drop trigger if exists trg_tf_discovery_claim_evidence_org on public.thinkforge_discovery_claim_evidence';
    execute 'create trigger trg_tf_discovery_claim_evidence_org before insert or update on public.thinkforge_discovery_claim_evidence for each row execute function public.thinkforge_guard_graph_link_org()';
  end if;
end $$;

create or replace function public.thinkforge_upsert_discovery_v3(
  p_user_id uuid,
  p_organization_id uuid,
  p_discovery jsonb,
  p_request_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_base_result jsonb;
  v_org_id uuid:=p_organization_id;
  v_discovery_id uuid;
  v_revision bigint;
  v_item jsonb;
  v_child jsonb;
  v_client_id text;
  v_session_id uuid;
  v_observation_id uuid;
  v_participant_id uuid;
  v_evidence_id uuid;
  v_claim_id uuid;
  v_theme_id uuid;
  v_method text;
  v_session_type text;
  v_observation_kind text;
  v_ref text;
begin
  v_base_result:=public.thinkforge_upsert_discovery_v2(p_user_id,v_org_id,p_discovery,p_request_id);
  v_discovery_id:=nullif(v_base_result->>'discoveryId','')::uuid;
  if v_discovery_id is null then raise exception using message='Canonical discovery v2 writer did not return discoveryId'; end if;
  select d.organization_id,d.version into v_org_id,v_revision from public.thinkforge_discoveries d where d.id=v_discovery_id;
  v_revision:=greatest(1,coalesce(v_revision,1));
  update public.thinkforge_discoveries d
    set aggregate_revision=v_revision,
        analysis_schema_version=coalesce(nullif(p_discovery->>'analysisSchemaVersion',''),'discovery-semantic-v2'),
        policy_version=coalesce(nullif(p_discovery->>'policyVersion',''),'stage1-v2'),
        updated_at=now(),updated_by=p_user_id
  where d.id=v_discovery_id
  returning aggregate_revision into v_revision;

  -- Participant identities are canonical within an organization. They are independent of AI output text.
  for v_item in select value from jsonb_array_elements(coalesce(p_discovery->'researchParticipants','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_item->>'clientId',v_item->>'client_id',v_item->>'externalRef',v_item->>'id'),'');
    select p.id into v_participant_id from public.thinkforge_research_participants p where p.organization_id=v_org_id and p.client_id=v_client_id limit 1;
    if v_participant_id is null then
      insert into public.thinkforge_research_participants(organization_id,client_id,external_ref,segment,persona,experience_level,attributes,created_by,updated_at)
      values(v_org_id,v_client_id,nullif(v_item->>'externalRef',''),nullif(v_item->>'segment',''),nullif(v_item->>'persona',''),nullif(v_item->>'experienceLevel',''),coalesce(v_item->'attributes','{}'::jsonb),p_user_id,now())
      returning id into v_participant_id;
    else
      update public.thinkforge_research_participants p
      set external_ref=coalesce(nullif(v_item->>'externalRef',''),p.external_ref),segment=coalesce(nullif(v_item->>'segment',''),p.segment),persona=coalesce(nullif(v_item->>'persona',''),p.persona),experience_level=coalesce(nullif(v_item->>'experienceLevel',''),p.experience_level),attributes=coalesce(v_item->'attributes',p.attributes),version=p.version+1,updated_at=now(),archived_at=null
      where p.id=v_participant_id;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_discovery->'researchSessions','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_item->>'clientId',v_item->>'client_id',v_item->>'id'),'');
    v_method:=coalesce(nullif(v_item->>'method',''),'other');
    v_session_type:=case v_method
      when 'behavioral_analytics' then 'analytics'
      when 'support_ticket_analysis' then 'support'
      when 'prototype_test' then 'usability'
      when 'competitive_research' then 'other'
      when 'contextual_inquiry' then 'contextual_inquiry'
      when 'usability_test' then 'usability'
      when 'diary_study' then 'interview'
      when 'survey' then 'survey'
      when 'experiment' then 'experiment'
      when 'interview' then 'interview'
      else 'other' end;
    select rs.id into v_session_id from public.thinkforge_research_sessions rs where rs.organization_id=v_org_id and rs.client_id=v_client_id limit 1;
    if v_session_id is null then
      insert into public.thinkforge_research_sessions(organization_id,discovery_id,client_id,session_type,title,method,started_at,ended_at,researcher_id,notes,metadata,created_by,updated_at)
      values(v_org_id,v_discovery_id,v_client_id,v_session_type,nullif(v_item->>'title',''),v_method,nullif(v_item->>'startedAt','')::timestamptz,nullif(v_item->>'endedAt','')::timestamptz,coalesce(nullif(v_item->>'researcherId','')::uuid,p_user_id),nullif(v_item->>'notes',''),coalesce(v_item->'metadata','{}'::jsonb),p_user_id,now())
      returning id into v_session_id;
    else
      update public.thinkforge_research_sessions rs
      set title=coalesce(nullif(v_item->>'title',''),rs.title),method=coalesce(nullif(v_item->>'method',''),rs.method),started_at=coalesce(nullif(v_item->>'startedAt','')::timestamptz,rs.started_at),ended_at=coalesce(nullif(v_item->>'endedAt','')::timestamptz,rs.ended_at),notes=coalesce(nullif(v_item->>'notes',''),rs.notes),metadata=coalesce(v_item->'metadata',rs.metadata),version=rs.version+1,updated_at=now(),archived_at=null
      where rs.id=v_session_id;
    end if;

    for v_child in select value from jsonb_array_elements(coalesce(v_item->'observations','[]'::jsonb)) loop
      v_client_id:=nullif(coalesce(v_child->>'clientId',v_child->>'client_id',v_child->>'id'),'');
      select re.id into v_evidence_id from public.thinkforge_research_evidence re where re.discovery_id=v_discovery_id and re.client_id=nullif(coalesce(v_child->>'sourceEvidenceId',v_child->>'evidenceId'), '') limit 1;
      select rp.id into v_participant_id from public.thinkforge_research_participants rp where rp.organization_id=v_org_id and rp.client_id=nullif(coalesce(v_child->>'participantId',v_child->>'participantClientId'), '') limit 1;
      v_observation_kind:=case lower(coalesce(v_child->>'kind','observation')) when 'fact' then 'fact' when 'behavior' then 'behavior' when 'quote' then 'quote' when 'inference' then 'inference' else 'observation' end;
      select ro.id into v_observation_id from public.thinkforge_research_observations ro where ro.organization_id=v_org_id and ro.client_id=v_client_id limit 1;
      if v_observation_id is null then
        insert into public.thinkforge_research_observations(organization_id,discovery_id,session_id,participant_id,source_evidence_id,client_id,kind,content,confidence,researcher_confirmed,created_by,updated_at)
        values(v_org_id,v_discovery_id,(select rs.id from public.thinkforge_research_sessions rs where rs.organization_id=v_org_id and rs.client_id=nullif(coalesce(v_item->>'clientId',v_item->>'client_id',v_item->>'id'),'') limit 1),v_participant_id,v_evidence_id,v_client_id,v_observation_kind,coalesce(v_child->>'content',''),nullif(v_child->>'confidence','')::numeric,coalesce((v_child->>'researcherConfirmed')::boolean,false),p_user_id,now());
      else
        update public.thinkforge_research_observations ro
        set session_id=(select rs.id from public.thinkforge_research_sessions rs where rs.organization_id=v_org_id and rs.client_id=nullif(coalesce(v_item->>'clientId',v_item->>'client_id',v_item->>'id'),'') limit 1),participant_id=v_participant_id,source_evidence_id=v_evidence_id,kind=v_observation_kind,content=coalesce(v_child->>'content',ro.content),confidence=coalesce(nullif(v_child->>'confidence','')::numeric,ro.confidence),researcher_confirmed=coalesce((v_child->>'researcherConfirmed')::boolean,ro.researcher_confirmed),version=ro.version+1,updated_at=now(),archived_at=null
        where ro.id=v_observation_id;
      end if;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_discovery->'claims','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_item->>'clientId',v_item->>'client_id',v_item->>'id'),'');
    select dc.id into v_claim_id from public.thinkforge_discovery_claims dc where dc.organization_id=v_org_id and dc.discovery_id=v_discovery_id and dc.client_id=v_client_id limit 1;
    if v_claim_id is null then
      insert into public.thinkforge_discovery_claims(organization_id,discovery_id,client_id,text,support_status,uncertainty,confidence,rationale,created_by)
      values(v_org_id,v_discovery_id,v_client_id,coalesce(v_item->>'text',''),coalesce(v_item->>'supportStatus','NOT_VERIFIABLE'),coalesce(v_item->>'uncertainty','medium'),nullif(v_item->>'confidence','')::numeric,nullif(v_item->>'rationale',''),p_user_id)
      returning id into v_claim_id;
    else
      update public.thinkforge_discovery_claims dc
      set text=coalesce(v_item->>'text',dc.text),support_status=coalesce(v_item->>'supportStatus',dc.support_status),uncertainty=coalesce(v_item->>'uncertainty',dc.uncertainty),confidence=coalesce(nullif(v_item->>'confidence','')::numeric,dc.confidence),rationale=coalesce(nullif(v_item->>'rationale',''),dc.rationale),version=dc.version+1,updated_at=now(),archived_at=null
      where dc.id=v_claim_id;
    end if;
    delete from public.thinkforge_discovery_claim_evidence ce where ce.claim_id=v_claim_id;
    for v_ref in select jsonb_array_elements_text(coalesce(v_item->'evidenceIds','[]'::jsonb)) loop
      select re.id into v_evidence_id from public.thinkforge_research_evidence re where re.discovery_id=v_discovery_id and re.client_id=v_ref limit 1;
      if v_evidence_id is not null then
        insert into public.thinkforge_discovery_claim_evidence(organization_id,claim_id,evidence_id,stance,created_by)
        values(v_org_id,v_claim_id,v_evidence_id,case when (select dc.support_status from public.thinkforge_discovery_claims dc where dc.id=v_claim_id)='CONTRADICTED' then 'contradicts' else 'supports' end,p_user_id)
        on conflict do nothing;
      end if;
    end loop;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_discovery->'themes','[]'::jsonb)) loop
    v_client_id:=nullif(coalesce(v_item->>'clientId',v_item->>'client_id',v_item->>'id'),'');
    select rt.id into v_theme_id from public.thinkforge_research_themes rt where rt.discovery_id=v_discovery_id and rt.organization_id=v_org_id and rt.client_id=v_client_id limit 1;
    if v_theme_id is not null then
      delete from public.thinkforge_discovery_theme_evidence te where te.theme_id=v_theme_id;
      for v_ref in select jsonb_array_elements_text(coalesce(v_item->'evidenceIds','[]'::jsonb)) loop
        select re.id into v_evidence_id from public.thinkforge_research_evidence re where re.discovery_id=v_discovery_id and re.client_id=v_ref limit 1;
        if v_evidence_id is not null then
          insert into public.thinkforge_discovery_theme_evidence(organization_id,theme_id,evidence_id,created_by) values(v_org_id,v_theme_id,v_evidence_id,p_user_id) on conflict do nothing;
        end if;
      end loop;
    end if;
  end loop;

  return v_base_result || jsonb_build_object('writerVersion','stage1-stage2-v3','aggregateRevision',v_revision,'analysisSchemaVersion',coalesce(p_discovery->>'analysisSchemaVersion','discovery-semantic-v2'),'policyVersion',coalesce(p_discovery->>'policyVersion','stage1-v2'),'materialized',jsonb_build_array('research_sessions','research_participants','research_observations','discovery_claims','claim_evidence','theme_evidence'),'sourceOfTruth','relational');
end $$;

grant execute on function public.thinkforge_upsert_discovery_v3(uuid,uuid,jsonb,text) to authenticated,service_role;

create or replace view public.thinkforge_stage1_stage2_canonical_write_paths as
select 'discovery'::text as aggregate,'thinkforge_upsert_discovery_v3'::text as canonical_writer,'analysis_payload'::text as compatibility_layer
union all select 'workspace','thinkforge_sync_workspace_v3','workspace JSON cache';

create or replace function public.thinkforge_verify_stage1_stage2_live()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  required_tables text[]:=array['thinkforge_discoveries','thinkforge_research_sessions','thinkforge_research_participants','thinkforge_research_observations','thinkforge_research_themes','thinkforge_discovery_claims','thinkforge_discovery_claim_evidence','thinkforge_discovery_theme_evidence'];
  t text; c jsonb:='[]'::jsonb; ok boolean:=true; exists_table boolean;
begin
  foreach t in array required_tables loop
    select exists(select 1 from information_schema.tables where table_schema='public' and table_name=t) into exists_table;
    c:=c||jsonb_build_array(jsonb_build_object('check','table:'||t,'passed',exists_table));ok:=ok and exists_table;
  end loop;
  for t in select unnest(array['policy_version','analysis_schema_version','aggregate_revision']) loop
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name='thinkforge_discoveries' and column_name=t) into exists_table;
    c:=c||jsonb_build_array(jsonb_build_object('check','column:discoveries.'||t,'passed',exists_table));ok:=ok and exists_table;
  end loop;
  select exists(select 1 from pg_proc where proname='thinkforge_upsert_discovery_v3') into exists_table;c:=c||jsonb_build_array(jsonb_build_object('check','function:thinkforge_upsert_discovery_v3','passed',exists_table));ok:=ok and exists_table;
  return jsonb_build_object('status',case when ok then 'PASS' else 'FAIL' end,'checks',c,'checkedAt',now(),'readOnly',true,'release','v14.7');
end $$;

grant execute on function public.thinkforge_verify_stage1_stage2_live() to service_role;
