-- ThinkForge Stage 2: canonical relational domain model.
-- Additive, migration-safe, stable-ID preserving, and transactionally versioned.

create extension if not exists pgcrypto;

create table if not exists public.thinkforge_organizations(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.thinkforge_memberships(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','admin','editor','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key(organization_id,user_id)
);
create index if not exists idx_tf_membership_user on public.thinkforge_memberships(user_id);

alter table public.thinkforge_workspaces add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_workspaces add column if not exists updated_by uuid references auth.users(id) on delete set null;

-- 1) Canonical ownership + audit metadata on all decision-domain records.
alter table public.thinkforge_decisions add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_decisions add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_decisions add column if not exists archived_at timestamptz;
alter table public.thinkforge_decisions add column if not exists deleted_at timestamptz;

alter table public.thinkforge_assumptions add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_assumptions add column if not exists version bigint not null default 1;
alter table public.thinkforge_assumptions add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_assumptions add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_assumptions add column if not exists archived_at timestamptz;

alter table public.thinkforge_evidence add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_evidence add column if not exists version bigint not null default 1;
alter table public.thinkforge_evidence add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_evidence add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_evidence add column if not exists archived_at timestamptz;

alter table public.thinkforge_challenges add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_challenges add column if not exists version bigint not null default 1;
alter table public.thinkforge_challenges add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_challenges add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_challenges add column if not exists archived_at timestamptz;

alter table public.thinkforge_alternatives add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_alternatives add column if not exists version bigint not null default 1;
alter table public.thinkforge_alternatives add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_alternatives add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_alternatives add column if not exists archived_at timestamptz;

alter table public.thinkforge_experiments add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_experiments add column if not exists version bigint not null default 1;
alter table public.thinkforge_experiments add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_experiments add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_experiments add column if not exists archived_at timestamptz;

alter table public.thinkforge_predictions add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_predictions add column if not exists client_id text;
alter table public.thinkforge_predictions add column if not exists version bigint not null default 1;
alter table public.thinkforge_predictions add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_predictions add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_predictions add column if not exists archived_at timestamptz;

alter table public.thinkforge_outcomes add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_outcomes add column if not exists client_id text;
alter table public.thinkforge_outcomes add column if not exists version bigint not null default 1;
alter table public.thinkforge_outcomes add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_outcomes add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_outcomes add column if not exists archived_at timestamptz;

alter table public.thinkforge_learnings add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_learnings add column if not exists client_id text;
alter table public.thinkforge_learnings add column if not exists version bigint not null default 1;
alter table public.thinkforge_learnings add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_learnings add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_learnings add column if not exists archived_at timestamptz;

alter table public.thinkforge_ai_interactions add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_documents add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_documents add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_documents add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_chunks add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;

-- Stage 1 discovery entities become tenant-aware without breaking existing rows.
alter table public.thinkforge_discoveries add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_discoveries add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_research_evidence add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_research_codes add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_opportunities add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_discovery_tests add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;

-- Backfill ownership from the user's workspace where available.
update public.thinkforge_decisions d set organization_id=w.organization_id from public.thinkforge_workspaces w where d.organization_id is null and w.user_id=d.user_id and w.organization_id is not null;
update public.thinkforge_assumptions a set organization_id=d.organization_id from public.thinkforge_decisions d where a.organization_id is null and a.decision_id=d.id;
update public.thinkforge_evidence e set organization_id=d.organization_id from public.thinkforge_decisions d where e.organization_id is null and e.decision_id=d.id;
update public.thinkforge_challenges c set organization_id=d.organization_id from public.thinkforge_decisions d where c.organization_id is null and c.decision_id=d.id;
update public.thinkforge_alternatives a set organization_id=d.organization_id from public.thinkforge_decisions d where a.organization_id is null and a.decision_id=d.id;
update public.thinkforge_experiments x set organization_id=d.organization_id from public.thinkforge_decisions d where x.organization_id is null and x.decision_id=d.id;
update public.thinkforge_predictions p set organization_id=d.organization_id from public.thinkforge_decisions d where p.organization_id is null and p.decision_id=d.id;
update public.thinkforge_outcomes o set organization_id=d.organization_id from public.thinkforge_decisions d where o.organization_id is null and o.decision_id=d.id;
update public.thinkforge_learnings l set organization_id=d.organization_id from public.thinkforge_decisions d where l.organization_id is null and l.decision_id=d.id;
update public.thinkforge_ai_interactions a set organization_id=d.organization_id from public.thinkforge_decisions d where a.organization_id is null and a.decision_id=d.id;
update public.thinkforge_documents x set organization_id=w.organization_id from public.thinkforge_workspaces w where x.organization_id is null and w.user_id=x.user_id and w.organization_id is not null;
update public.thinkforge_chunks x set organization_id=d.organization_id from public.thinkforge_documents d where x.organization_id is null and x.document_id=d.id;
update public.thinkforge_discoveries x set organization_id=w.organization_id from public.thinkforge_workspaces w where x.organization_id is null and w.user_id=x.user_id and w.organization_id is not null;
update public.thinkforge_research_evidence x set organization_id=d.organization_id from public.thinkforge_discoveries d where x.organization_id is null and x.discovery_id=d.id;
update public.thinkforge_research_codes x set organization_id=d.organization_id from public.thinkforge_discoveries d where x.organization_id is null and x.discovery_id=d.id;
update public.thinkforge_opportunities x set organization_id=d.organization_id from public.thinkforge_discoveries d where x.organization_id is null and x.discovery_id=d.id;
update public.thinkforge_discovery_tests x set organization_id=d.organization_id from public.thinkforge_discoveries d where x.organization_id is null and x.discovery_id=d.id;

-- Stable client-id uniqueness for canonical upserts.
create unique index if not exists uq_tf_challenge_client on public.thinkforge_challenges(user_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_alternative_client on public.thinkforge_alternatives(user_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_experiment_client on public.thinkforge_experiments(user_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_prediction_client on public.thinkforge_predictions(user_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_outcome_client on public.thinkforge_outcomes(user_id,client_id) where client_id is not null;
create unique index if not exists uq_tf_learning_client on public.thinkforge_learnings(user_id,client_id) where client_id is not null;

create index if not exists idx_tf_decisions_org_updated on public.thinkforge_decisions(organization_id,updated_at desc) where organization_id is not null;
create index if not exists idx_tf_assumptions_org on public.thinkforge_assumptions(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_evidence_org on public.thinkforge_evidence(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_challenges_org on public.thinkforge_challenges(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_alternatives_org on public.thinkforge_alternatives(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_experiments_org on public.thinkforge_experiments(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_predictions_org on public.thinkforge_predictions(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_outcomes_org on public.thinkforge_outcomes(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_learnings_org on public.thinkforge_learnings(organization_id,decision_id) where organization_id is not null;
create index if not exists idx_tf_ai_interactions_org on public.thinkforge_ai_interactions(organization_id,created_at desc) where organization_id is not null;
create index if not exists idx_tf_documents_org on public.thinkforge_documents(organization_id,created_at desc) where organization_id is not null;
create index if not exists idx_tf_chunks_org on public.thinkforge_chunks(organization_id,document_id) where organization_id is not null;

-- Append-only row snapshots provide actual history rather than overwriting semantics.
create table if not exists public.thinkforge_entity_versions(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  version bigint not null,
  operation text not null check(operation in ('UPSERT','ARCHIVE')),
  snapshot jsonb not null,
  request_id text,
  created_at timestamptz not null default now(),
  unique(entity_type,entity_id,version)
);
create index if not exists idx_tf_entity_versions_entity on public.thinkforge_entity_versions(entity_type,entity_id,version desc);
create index if not exists idx_tf_entity_versions_org on public.thinkforge_entity_versions(organization_id,created_at desc);
alter table public.thinkforge_entity_versions enable row level security;
drop policy if exists tf_entity_versions_select on public.thinkforge_entity_versions;
create policy tf_entity_versions_select on public.thinkforge_entity_versions for select using(exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_entity_versions.organization_id and m.user_id=auth.uid()));
drop policy if exists tf_entity_versions_insert on public.thinkforge_entity_versions;
create policy tf_entity_versions_insert on public.thinkforge_entity_versions for insert with check(user_id=auth.uid() and exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_entity_versions.organization_id and m.user_id=auth.uid()));

grant select,insert on public.thinkforge_entity_versions to authenticated;

-- Canonical tenant checks for application/service code.
create or replace function public.thinkforge_require_membership(p_user_id uuid,p_organization_id uuid,p_min_role text default 'viewer')
returns void language plpgsql security definer set search_path=public as $$
declare role_value text;
begin
  select role into role_value from public.thinkforge_memberships where organization_id=p_organization_id and user_id=p_user_id;
  if role_value is null then raise exception using errcode='42501',message='Organization membership required'; end if;
  if p_min_role='viewer' then return; end if;
  if p_min_role='reviewer' and role_value in ('viewer') then raise exception using errcode='42501',message='Reviewer role required'; end if;
  if p_min_role='editor' and role_value not in ('owner','admin','editor') then raise exception using errcode='42501',message='Editor role required'; end if;
  if p_min_role='admin' and role_value not in ('owner','admin') then raise exception using errcode='42501',message='Admin role required'; end if;
end $$;

create or replace function public.thinkforge_has_org_role(p_organization_id uuid,p_min_role text default 'viewer')
returns boolean language sql security definer stable set search_path=public as $$
  select case p_min_role
    when 'viewer' then exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid())
    when 'reviewer' then exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','editor','reviewer'))
    when 'editor' then exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','editor'))
    when 'admin' then exists(select 1 from public.thinkforge_memberships m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))
    else false end;
$$;


-- Replace user-only policies on canonical domain tables with tenant-aware membership policies.
do $$ declare t text; begin
  foreach t in array array['thinkforge_decisions','thinkforge_assumptions','thinkforge_evidence','thinkforge_challenges','thinkforge_alternatives','thinkforge_experiments','thinkforge_predictions','thinkforge_outcomes','thinkforge_learnings','thinkforge_discoveries','thinkforge_research_evidence','thinkforge_research_codes','thinkforge_opportunities','thinkforge_discovery_tests','thinkforge_documents','thinkforge_chunks','thinkforge_ai_interactions'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

drop policy if exists decisions_own on public.thinkforge_decisions;
drop policy if exists assumptions_own on public.thinkforge_assumptions;
drop policy if exists evidence_own on public.thinkforge_evidence;
drop policy if exists tf_challenges_own on public.thinkforge_challenges;
drop policy if exists tf_alternatives_own on public.thinkforge_alternatives;
drop policy if exists tf_experiments_own on public.thinkforge_experiments;
drop policy if exists tf_predictions_own on public.thinkforge_predictions;
drop policy if exists tf_outcomes_own on public.thinkforge_outcomes;
drop policy if exists tf_discoveries_own on public.thinkforge_discoveries;
drop policy if exists research_evidence_own on public.thinkforge_research_evidence;
drop policy if exists research_codes_own on public.thinkforge_research_codes;
drop policy if exists opportunities_own on public.thinkforge_opportunities;
drop policy if exists discovery_tests_own on public.thinkforge_discovery_tests;

create policy tf_decisions_select on public.thinkforge_decisions for select using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'viewer'));
create policy tf_decisions_insert on public.thinkforge_decisions for insert with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_decisions_update on public.thinkforge_decisions for update using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor')) with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_decisions_delete on public.thinkforge_decisions for delete using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'admin'));

-- Children inherit tenant from the decision, and preserve legacy user-owned rows if not yet backfilled.
do $$ declare t text; begin
  foreach t in array array['thinkforge_assumptions','thinkforge_evidence','thinkforge_challenges','thinkforge_alternatives','thinkforge_experiments','thinkforge_predictions','thinkforge_outcomes','thinkforge_learnings'] loop
    execute format('drop policy if exists %I on public.%I',lower(replace(t,'thinkforge_',''))||'_own',t);
    execute format('create policy %I on public.%I for select using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,''viewer''))', 'tf_'||t||'_select', t);
    execute format('create policy %I on public.%I for insert with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,''editor''))','tf_'||t||'_insert',t);
    execute format('create policy %I on public.%I for update using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,''editor'')) with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,''editor''))','tf_'||t||'_update',t);
    execute format('create policy %I on public.%I for delete using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,''admin''))','tf_'||t||'_delete',t);
  end loop;
end $$;

-- Discovery/RAG/telemetry tables use the same tenant model; legacy rows remain owner-visible until backfill.
create policy tf_discoveries_select on public.thinkforge_discoveries for select using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'viewer'));
create policy tf_discoveries_insert on public.thinkforge_discoveries for insert with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_discoveries_update on public.thinkforge_discoveries for update using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor')) with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_discoveries_delete on public.thinkforge_discoveries for delete using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'admin'));

create policy tf_ai_interactions_select on public.thinkforge_ai_interactions for select using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'viewer'));
create policy tf_ai_interactions_insert on public.thinkforge_ai_interactions for insert with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));

create policy tf_documents_select on public.thinkforge_documents for select using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'viewer'));
create policy tf_documents_insert on public.thinkforge_documents for insert with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_documents_update on public.thinkforge_documents for update using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor')) with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_documents_delete on public.thinkforge_documents for delete using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'admin'));
create policy tf_chunks_select on public.thinkforge_chunks for select using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'viewer'));
create policy tf_chunks_insert on public.thinkforge_chunks for insert with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_chunks_update on public.thinkforge_chunks for update using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor')) with check((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_chunks_delete on public.thinkforge_chunks for delete using((organization_id is null and user_id=auth.uid()) or public.thinkforge_has_org_role(organization_id,'admin'));

-- Transactional canonical graph write. JSON workspace remains compatibility cache only.
create or replace function public.thinkforge_upsert_decision_graph_v2(
  p_user_id uuid,
  p_organization_id uuid,
  p_graph jsonb,
  p_expected_version bigint default null,
  p_request_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  d jsonb;
  x jsonb;
  decision_row uuid;
  decision_client text;
  current_version bigint;
  next_version bigint;
  pred_row uuid;
  org_id uuid:=p_organization_id;
  snapshot jsonb;
begin
  if p_user_id is null or p_organization_id is null then raise exception using message='user and organization are required'; end if;
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'editor');
  d:=p_graph->'decision';
  if d is null then raise exception using message='decision is required'; end if;
  decision_client:=nullif(coalesce(d->>'clientId',d->>'client_id',d->>'id'),'');
  select id,version into decision_row,current_version from public.thinkforge_decisions where user_id=p_user_id and organization_id=org_id and client_id=decision_client for update;
  if decision_row is null then
    insert into public.thinkforge_decisions(user_id,organization_id,client_id,title,problem,status,payload,version,updated_by,updated_at,archived_at,deleted_at)
    values(p_user_id,org_id,decision_client,coalesce(d->>'title','Untitled decision'),coalesce(d->>'problem',''),case when d->>'status' in ('validate','build','defer','do_not_build') then d->>'status' else 'validate' end,d,1,p_user_id,now(),null,null)
    returning id,version into decision_row,current_version;
  else
    if p_expected_version is not null and current_version<>p_expected_version then raise exception using errcode='40001',message='Decision version conflict'; end if;
    next_version:=current_version+1;
    update public.thinkforge_decisions set title=coalesce(d->>'title',title),problem=coalesce(d->>'problem',problem),status=case when d->>'status' in ('validate','build','defer','do_not_build') then d->>'status' else status end,payload=d,version=next_version,updated_by=p_user_id,updated_at=now(),archived_at=null,deleted_at=null where id=decision_row;
    current_version:=next_version;
  end if;
  snapshot:=to_jsonb((select q from public.thinkforge_decisions q where q.id=decision_row));
  insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) values(org_id,p_user_id,'decision',decision_row,current_version,'UPSERT',snapshot,p_request_id);

  -- Each child entity keeps its client id, version history, and archive state. Nothing is hard-deleted during sync.
  for x in select * from jsonb_array_elements(coalesce(p_graph->'assumptions','[]'::jsonb)) loop
    insert into public.thinkforge_assumptions(decision_id,user_id,organization_id,client_id,text,impact,uncertainty,confidence,status,rationale,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),coalesce(x->>'text',''),greatest(1,least(5,coalesce((x->>'impact')::int,1))),greatest(1,least(5,coalesce((x->>'uncertainty')::int,1))),greatest(0,least(1,coalesce((x->>'confidence')::numeric,0))),coalesce(x->>'status','open'),x->>'rationale',1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,text=excluded.text,impact=excluded.impact,uncertainty=excluded.uncertainty,confidence=excluded.confidence,status=excluded.status,rationale=excluded.rationale,version=public.thinkforge_assumptions.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_assumptions q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'assumption',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_assumptions q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_graph->'evidence','[]'::jsonb)) loop
    insert into public.thinkforge_evidence(decision_id,user_id,organization_id,client_id,evidence_type,source,content,stance,strength,source_url,source_locator,provenance,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),x->>'type',x->>'source',coalesce(x->>'content',''),nullif(x->>'stance',''),nullif(x->>'strength',''),nullif(coalesce(x->>'url',x->>'source_url'),'') ,nullif(coalesce(x->>'date',x->>'source_locator'),''),coalesce(x->'provenance',jsonb_build_object('linked',coalesce(x->'linked','[]'::jsonb))),1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,evidence_type=excluded.evidence_type,source=excluded.source,content=excluded.content,stance=excluded.stance,strength=excluded.strength,source_url=excluded.source_url,source_locator=excluded.source_locator,provenance=excluded.provenance,version=public.thinkforge_evidence.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_evidence q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'evidence',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_evidence q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  -- The remaining collections are retained in their canonical tables using JSON payload fields.
  for x in select * from jsonb_array_elements(coalesce(p_graph->'challenges','[]'::jsonb)) loop
    insert into public.thinkforge_challenges(decision_id,user_id,organization_id,client_id,priority,assumption,question,why,evidence_refs,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),greatest(1,least(5,coalesce((x->>'priority')::int,1))),coalesce(x->>'assumption',''),coalesce(x->>'question',''),coalesce(x->>'why',x->>'rationale',''),coalesce(x->'evidence_refs','[]'::jsonb),1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,priority=excluded.priority,assumption=excluded.assumption,question=excluded.question,why=excluded.why,evidence_refs=excluded.evidence_refs,version=public.thinkforge_challenges.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_challenges q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'challenge',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_challenges q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_graph->'alternatives','[]'::jsonb)) loop
    insert into public.thinkforge_alternatives(decision_id,user_id,organization_id,client_id,name,rationale,tradeoffs,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),coalesce(x->>'name',x->>'label',''),x->>'rationale',coalesce(x->'tradeoffs','{}'::jsonb),1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,name=excluded.name,rationale=excluded.rationale,tradeoffs=excluded.tradeoffs,version=public.thinkforge_alternatives.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_alternatives q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'alternative',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_alternatives q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_graph->'experiments','[]'::jsonb)) loop
    insert into public.thinkforge_experiments(decision_id,user_id,organization_id,client_id,hypothesis,control,intervention,primary_metric,guardrails,baseline,target,prediction,alpha,power,mde,sample_size,analysis_plan,status,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),coalesce(x->>'hypothesis',''),x->>'control',x->>'intervention',coalesce(x->>'primary',x->>'primary_metric'),coalesce(x->'guardrails','[]'::jsonb),x->>'baseline',x->>'target',x->>'prediction',nullif(x->>'alpha','')::numeric,nullif(x->>'power','')::numeric,nullif(x->>'mde','')::numeric,nullif(x->>'sampleSize','')::bigint,coalesce(x->'analysisPlan',x->'analysis_plan','{}'::jsonb),coalesce(x->>'status','planned'),1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,hypothesis=excluded.hypothesis,control=excluded.control,intervention=excluded.intervention,primary_metric=excluded.primary_metric,guardrails=excluded.guardrails,baseline=excluded.baseline,target=excluded.target,prediction=excluded.prediction,alpha=excluded.alpha,power=excluded.power,mde=excluded.mde,sample_size=excluded.sample_size,analysis_plan=excluded.analysis_plan,status=excluded.status,version=public.thinkforge_experiments.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_experiments q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'experiment',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_experiments q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  -- Prediction/outcome/learning tables can carry a flexible metadata snapshot while retaining typed metrics.
  for x in select * from jsonb_array_elements(coalesce(p_graph->'predictions','[]'::jsonb)) loop
    insert into public.thinkforge_predictions(decision_id,user_id,organization_id,client_id,metric,prediction_type,predicted_value,lower_bound,upper_bound,probability,locked_at,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),coalesce(x->>'metric',''),coalesce(x->>'predictionType',x->>'prediction_type','point_estimate'),nullif(x->>'predicted','')::numeric,nullif(x->>'lowerBound','')::numeric,nullif(x->>'upperBound','')::numeric,nullif(x->>'probability','')::numeric,nullif(x->>'lockedAt','')::timestamptz,1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,metric=excluded.metric,prediction_type=excluded.prediction_type,predicted_value=excluded.predicted_value,lower_bound=excluded.lower_bound,upper_bound=excluded.upper_bound,probability=excluded.probability,locked_at=coalesce(public.thinkforge_predictions.locked_at,excluded.locked_at),version=public.thinkforge_predictions.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_predictions q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'prediction',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_predictions q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_graph->'outcomes','[]'::jsonb)) loop
    pred_row:=null;
    if nullif(x->>'predictionId','') is not null then
      select p.id into pred_row from public.thinkforge_predictions p where p.user_id=p_user_id and p.organization_id=org_id and (p.client_id=x->>'predictionId' or p.id::text=x->>'predictionId') limit 1;
    end if;
    insert into public.thinkforge_outcomes(prediction_id,decision_id,user_id,organization_id,client_id,actual_value,observed_probability,result,learning,observed_at,metadata,version,updated_at,updated_by,archived_at)
    values(pred_row,decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),nullif(x->>'actual','')::numeric,nullif(x->>'observedProbability','')::numeric,x->>'result',x->>'learning',coalesce(nullif(x->>'observedAt','')::timestamptz,now()),coalesce(x->'metadata','{}'::jsonb),1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,actual_value=excluded.actual_value,observed_probability=excluded.observed_probability,result=excluded.result,learning=excluded.learning,observed_at=excluded.observed_at,metadata=excluded.metadata,version=public.thinkforge_outcomes.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_outcomes q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'outcome',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_outcomes q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_graph->'learnings','[]'::jsonb)) loop
    insert into public.thinkforge_learnings(decision_id,user_id,organization_id,client_id,statement,evidence_refs,version,updated_at,updated_by,archived_at)
    values(decision_row,p_user_id,org_id,nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),''),coalesce(x->>'statement',x->>'text',''),coalesce(x->'evidenceRefs',x->'evidence_refs','[]'::jsonb),1,now(),p_user_id,null)
    on conflict (user_id,client_id) where client_id is not null do update set decision_id=excluded.decision_id,organization_id=excluded.organization_id,statement=excluded.statement,evidence_refs=excluded.evidence_refs,version=public.thinkforge_learnings.version+1,updated_at=now(),updated_by=p_user_id,archived_at=null;
    select to_jsonb(q) into snapshot from public.thinkforge_learnings q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
    insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'learning',q.id,q.version,'UPSERT',snapshot,p_request_id from public.thinkforge_learnings q where q.user_id=p_user_id and q.organization_id=org_id and q.client_id=nullif(coalesce(x->>'clientId',x->>'client_id',x->>'id'),'');
  end loop;

  -- Archive omitted entities. Archive is versioned and written to history in this same transaction.
  with changed as (update public.thinkforge_assumptions a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'assumptions','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'assumption',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_evidence a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'evidence','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'evidence',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_challenges a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'challenges','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'challenge',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_alternatives a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'alternatives','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'alternative',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_experiments a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'experiments','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'experiment',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_predictions a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'predictions','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'prediction',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_outcomes a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'outcomes','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'outcome',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;
  with changed as (update public.thinkforge_learnings a set archived_at=now(),updated_at=now(),updated_by=p_user_id,version=a.version+1 where a.user_id=p_user_id and a.organization_id=org_id and a.decision_id=decision_row and a.archived_at is null and not exists (select 1 from jsonb_array_elements(coalesce(p_graph->'learnings','[]'::jsonb)) z where nullif(coalesce(z->>'clientId',z->>'client_id',z->>'id'),'')=a.client_id) returning a.*) insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id) select org_id,p_user_id,'learning',id,version,'ARCHIVE',to_jsonb(changed),p_request_id from changed;

  return jsonb_build_object('decisionId',decision_row,'version',current_version,'organizationId',org_id,'sourceOfTruth','relational','history','append-only');
exception when sqlstate='40001' then raise;
end $$;

create or replace function public.thinkforge_read_decision_graph_v2(p_user_id uuid,p_organization_id uuid,p_decision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d jsonb;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select to_jsonb(q) into d from public.thinkforge_decisions q where q.id=p_decision_id and q.organization_id=p_organization_id and q.deleted_at is null;
  if d is null then return null; end if;
  return jsonb_build_object(
    'decision',d,
    'assumptions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_assumptions q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_evidence q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'challenges',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_challenges q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'alternatives',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_alternatives q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'experiments',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_experiments q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'predictions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_predictions q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'outcomes',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_outcomes q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb),
    'learnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_learnings q where q.decision_id=p_decision_id and q.archived_at is null),'[]'::jsonb)
  );
end $$;

grant execute on function public.thinkforge_upsert_decision_graph_v2(uuid,uuid,jsonb,bigint,text) to service_role;
grant execute on function public.thinkforge_read_decision_graph_v2(uuid,uuid,uuid) to service_role;

-- Keep workspace JSON as compatibility cache, but use the canonical relational writer.
create or replace function public.thinkforge_sync_workspace_v2(p_user_id uuid,p_state jsonb,p_expected_version bigint default null,p_request_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  org_id uuid;
  current_version bigint;
  d jsonb;
  graph jsonb;
  results jsonb:='[]'::jsonb;
begin
  select organization_id,version into org_id,current_version from public.thinkforge_workspaces where user_id=p_user_id for update;
  if org_id is null then
    insert into public.thinkforge_organizations(name,created_by) values('Personal workspace',p_user_id) returning id into org_id;
    insert into public.thinkforge_memberships(organization_id,user_id,role) values(org_id,p_user_id,'owner');
  end if;
  if current_version is not null and p_expected_version is not null and current_version<>p_expected_version then raise exception using errcode='40001',message='Workspace version conflict'; end if;
  if current_version is null then
    insert into public.thinkforge_workspaces(user_id,organization_id,state,version,updated_by,updated_at) values(p_user_id,org_id,p_state,1,p_user_id,now()); current_version:=1;
  else
    current_version:=current_version+1;
    update public.thinkforge_workspaces set state=p_state,version=current_version,updated_by=p_user_id,updated_at=now() where user_id=p_user_id;
  end if;
  for d in select * from jsonb_array_elements(coalesce(p_state->'decisions','[]'::jsonb)) loop
    graph:=jsonb_build_object('decision',d,'assumptions',coalesce(d->'assumptions','[]'::jsonb),'evidence',coalesce(d->'evidence','[]'::jsonb),'challenges',coalesce(d->'challenges','[]'::jsonb),'alternatives',coalesce(d->'alternatives','[]'::jsonb),'experiments',case when d->'experiment' is null then '[]'::jsonb else jsonb_build_array((d->'experiment') || jsonb_build_object('id',concat(coalesce(d->>'id','decision'),'-experiment'))) end,'predictions',case when d->'prediction' is null then '[]'::jsonb else jsonb_build_array((d->'prediction') || jsonb_build_object('id',concat(coalesce(d->>'id','decision'),'-prediction'))) end,'outcomes',case when d->'outcome' is null then '[]'::jsonb else jsonb_build_array((d->'outcome') || jsonb_build_object('id',concat(coalesce(d->>'id','decision'),'-outcome'),'predictionId',concat(coalesce(d->>'id','decision'),'-prediction'))) end,'learnings',case when d->>'learning' is null or d->>'learning'='' then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id',concat('learn-',coalesce(d->>'id',gen_random_uuid()::text)),'statement',d->>'learning','evidence_refs','[]'::jsonb)) end);
    results:=results || jsonb_build_array(public.thinkforge_upsert_decision_graph_v2(p_user_id,org_id,graph,null,p_request_id));
  end loop;
  return jsonb_build_object('version',current_version,'organizationId',org_id,'sourceOfTruth','relational','relationalProjection','canonical');
end $$;
grant execute on function public.thinkforge_sync_workspace_v2(uuid,jsonb,bigint,text) to service_role;
