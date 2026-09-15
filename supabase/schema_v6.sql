-- ThinkForge v6 relational source of truth, tenancy, audit chain, prediction/outcome and hybrid RAG.
create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.thinkforge_organizations(
  id uuid primary key default gen_random_uuid(), name text not null, created_by uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now()
);
create table if not exists public.thinkforge_memberships(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','admin','editor','reviewer','viewer')),
  created_at timestamptz not null default now(), primary key(organization_id,user_id)
);
create index if not exists idx_tf_membership_user on public.thinkforge_memberships(user_id);

alter table public.thinkforge_workspaces add column if not exists organization_id uuid references public.thinkforge_organizations(id) on delete cascade;
alter table public.thinkforge_workspaces add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.thinkforge_decisions add column if not exists version bigint not null default 1;
alter table public.thinkforge_decisions add column if not exists archived_at timestamptz;
alter table public.thinkforge_decisions add column if not exists client_id text;
create unique index if not exists uq_tf_decision_client on public.thinkforge_decisions(user_id,client_id) where client_id is not null;

create table if not exists public.thinkforge_predictions(
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, metric text not null, prediction_type text not null check(prediction_type in ('probability','effect','point_estimate')),
  predicted_value numeric, lower_bound numeric, upper_bound numeric, probability numeric check(probability between 0 and 1), locked_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_tf_predictions_decision on public.thinkforge_predictions(decision_id);

create table if not exists public.thinkforge_outcomes(
  id uuid primary key default gen_random_uuid(), prediction_id uuid references public.thinkforge_predictions(id) on delete set null,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  actual_value numeric, observed_probability numeric check(observed_probability between 0 and 1), result text, learning text, observed_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_tf_outcomes_decision on public.thinkforge_outcomes(decision_id);

create table if not exists public.thinkforge_external_actions(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null, idempotency_key text not null, request_id text, response_json jsonb, created_at timestamptz not null default now(),
  unique(user_id,idempotency_key)
);
alter table public.thinkforge_external_actions enable row level security;
drop policy if exists tf_external_actions_own on public.thinkforge_external_actions;
create policy tf_external_actions_own on public.thinkforge_external_actions for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.thinkforge_evaluation_annotations(
  id uuid primary key default gen_random_uuid(), case_id text not null, rater_id uuid not null references auth.users(id) on delete cascade,
  module text not null, scores jsonb not null, notes text, created_at timestamptz not null default now()
);
create index if not exists idx_tf_annotations_case on public.thinkforge_evaluation_annotations(case_id);
alter table public.thinkforge_evaluation_annotations enable row level security;
drop policy if exists tf_annotations_own on public.thinkforge_evaluation_annotations;
create policy tf_annotations_own on public.thinkforge_evaluation_annotations for all using(rater_id=auth.uid()) with check(rater_id=auth.uid());

create table if not exists public.thinkforge_learnings(
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, statement text not null, evidence_refs jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);

alter table public.thinkforge_audit_events add column if not exists request_id text;
alter table public.thinkforge_audit_events add column if not exists previous_hash text;
alter table public.thinkforge_audit_events add column if not exists event_hash text;
create unique index if not exists idx_tf_audit_event_hash on public.thinkforge_audit_events(event_hash) where event_hash is not null;

alter table public.thinkforge_chunks add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.thinkforge_chunks add column if not exists tsv tsvector;
update public.thinkforge_chunks set tsv=to_tsvector('english',coalesce(content,'')) where tsv is null;
create index if not exists idx_tf_chunks_tsv on public.thinkforge_chunks using gin(tsv);


create table if not exists public.thinkforge_challenges(
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  priority int not null check(priority between 1 and 5), assumption text not null, question text not null, why text not null, evidence_refs jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_tf_challenges_decision on public.thinkforge_challenges(decision_id);
create table if not exists public.thinkforge_alternatives(
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, rationale text, tradeoffs jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.thinkforge_experiments(
  id uuid primary key default gen_random_uuid(), decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  hypothesis text not null, control text, intervention text, primary_metric text, guardrails jsonb not null default '[]'::jsonb, baseline text, target text, prediction text, alpha numeric, power numeric, mde numeric, sample_size bigint, analysis_plan jsonb not null default '{}'::jsonb, status text not null default 'planned', created_at timestamptz not null default now()
);
create index if not exists idx_tf_experiments_decision on public.thinkforge_experiments(decision_id);


alter table public.thinkforge_assumptions add column if not exists client_id text;
create unique index if not exists uq_tf_assumption_client on public.thinkforge_assumptions(user_id,client_id) where client_id is not null;
alter table public.thinkforge_evidence add column if not exists client_id text;
create unique index if not exists uq_tf_evidence_client on public.thinkforge_evidence(user_id,client_id) where client_id is not null;
alter table public.thinkforge_challenges add column if not exists client_id text;
alter table public.thinkforge_alternatives add column if not exists client_id text;
alter table public.thinkforge_experiments add column if not exists client_id text;
-- Prevent direct non-members from seeing tenant data in the new tables.
alter table public.thinkforge_organizations enable row level security;
alter table public.thinkforge_memberships enable row level security;
alter table public.thinkforge_predictions enable row level security;
alter table public.thinkforge_outcomes enable row level security;
alter table public.thinkforge_learnings enable row level security;
alter table public.thinkforge_challenges enable row level security;
alter table public.thinkforge_alternatives enable row level security;
alter table public.thinkforge_experiments enable row level security;
drop policy if exists tf_challenges_own on public.thinkforge_challenges;
create policy tf_challenges_own on public.thinkforge_challenges for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists tf_alternatives_own on public.thinkforge_alternatives;
create policy tf_alternatives_own on public.thinkforge_alternatives for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists tf_experiments_own on public.thinkforge_experiments;
create policy tf_experiments_own on public.thinkforge_experiments for all using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists tf_org_member_read on public.thinkforge_organizations;
create policy tf_org_member_read on public.thinkforge_organizations for select using(exists(select 1 from public.thinkforge_memberships m where m.organization_id=id and m.user_id=auth.uid()));
drop policy if exists tf_membership_self on public.thinkforge_memberships;
create policy tf_membership_self on public.thinkforge_memberships for select using(user_id=auth.uid());
drop policy if exists tf_predictions_own on public.thinkforge_predictions;
create policy tf_predictions_own on public.thinkforge_predictions for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists tf_outcomes_own on public.thinkforge_outcomes;
create policy tf_outcomes_own on public.thinkforge_outcomes for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists tf_learnings_own on public.thinkforge_learnings;
create policy tf_learnings_own on public.thinkforge_learnings for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.match_thinkforge_chunks_hybrid(query_text text, query_embedding vector(1536), match_count int default 8, filter_user_id uuid default auth.uid())
returns table(id uuid,content text,source_locator text,document_name text,semantic_score float,lexical_score float,rrf_score float)
language sql stable as $$
with vec as (
 select c.id,c.content,c.source_locator,d.name as document_name,1-(c.embedding<=>query_embedding) as semantic_score,row_number() over(order by c.embedding<=>query_embedding) as vrank
 from public.thinkforge_chunks c join public.thinkforge_documents d on d.id=c.document_id
 where c.user_id=filter_user_id and c.embedding is not null order by c.embedding<=>query_embedding limit 50
),lex as (
 select c.id,ts_rank_cd(coalesce(c.tsv,to_tsvector('english',c.content)),plainto_tsquery('english',query_text)) as lexical_score,row_number() over(order by ts_rank_cd(coalesce(c.tsv,to_tsvector('english',c.content)),plainto_tsquery('english',query_text)) desc) as lrank
 from public.thinkforge_chunks c where c.user_id=filter_user_id and c.tsv @@ plainto_tsquery('english',query_text) order by ts_rank_cd(coalesce(c.tsv,to_tsvector('english',c.content)),plainto_tsquery('english',query_text)) desc limit 50
)
select coalesce(v.id,l.id),coalesce(v.content,c2.content),coalesce(v.source_locator,c2.source_locator),coalesce(v.document_name,d2.name),coalesce(v.semantic_score,0),coalesce(l.lexical_score,0),coalesce(1.0/(60+v.vrank),0)+coalesce(1.0/(60+l.lrank),0) as rrf_score
from vec v full outer join lex l on l.id=v.id
left join public.thinkforge_chunks c2 on c2.id=l.id left join public.thinkforge_documents d2 on d2.id=c2.document_id
order by rrf_score desc limit greatest(1,least(match_count,50));
$$;

create or replace function public.thinkforge_sync_workspace(p_user_id uuid,p_state jsonb,p_event jsonb default null,p_expected_version bigint default null,p_request_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_version bigint; next_version bigint; org_id uuid; d jsonb; a jsonb; e jsonb; c jsonb; al jsonb; ex jsonb; decision_row uuid; previous text; eh text;
begin
  if p_user_id is null then raise exception using message='user required'; end if;
  select version,organization_id into current_version,org_id from public.thinkforge_workspaces where user_id=p_user_id for update;
  if current_version is null then
    insert into public.thinkforge_organizations(name,created_by) values ('Personal workspace',p_user_id) returning id into org_id;
    insert into public.thinkforge_memberships(organization_id,user_id,role) values(org_id,p_user_id,'owner');
    insert into public.thinkforge_workspaces(user_id,state,version,updated_by,organization_id) values(p_user_id,p_state,1,p_user_id,org_id);
    current_version:=1;
  elsif p_expected_version is not null and current_version<>p_expected_version then
    raise exception using errcode='40001',message='Workspace version conflict';
  else
    next_version:=current_version+1;
    update public.thinkforge_workspaces set state=p_state,version=next_version,updated_by=p_user_id,updated_at=now() where user_id=p_user_id; current_version:=next_version;
  end if;

  -- Relational projection: state JSON remains a cache/compatibility layer, relational rows are authoritative for analytics.
  for d in select * from jsonb_array_elements(coalesce(p_state->'decisions','[]'::jsonb)) loop
    insert into public.thinkforge_decisions(user_id,client_id,title,problem,status,payload)
    values(p_user_id,nullif(d->>'id',''),coalesce(d->>'title','Untitled decision'),coalesce(d->>'problem',''),case when d->>'status' in ('validate','build','defer','do_not_build') then d->>'status' else 'validate' end,d)
    on conflict (user_id,client_id) where client_id is not null do update set title=excluded.title,problem=excluded.problem,status=excluded.status,payload=excluded.payload,version=public.thinkforge_decisions.version+1,updated_at=now();
    select id into decision_row from public.thinkforge_decisions where user_id=p_user_id and client_id=nullif(d->>'id','');
    if decision_row is not null then
      delete from public.thinkforge_assumptions where decision_id=decision_row;
      insert into public.thinkforge_assumptions(decision_id,user_id,client_id,text,impact,uncertainty,confidence,status,rationale)
      select decision_row,p_user_id,nullif(x->>'id',''),x->>'text',greatest(1,least(5,coalesce((x->>'impact')::int,1))),greatest(1,least(5,coalesce((x->>'uncertainty')::int,1))),greatest(0,least(1,coalesce((x->>'confidence')::numeric,0))),coalesce(x->>'status','open'),x->>'rationale' from jsonb_array_elements(coalesce(d->'assumptions','[]'::jsonb)) x;
      delete from public.thinkforge_evidence where decision_id=decision_row;
      insert into public.thinkforge_evidence(decision_id,user_id,client_id,evidence_type,source,content,stance,strength,source_url,source_locator,provenance)
      select decision_row,p_user_id,nullif(x->>'id',''),x->>'type',x->>'source',coalesce(x->>'content',''),nullif(x->>'stance',''),nullif(x->>'strength',''),nullif(x->>'url',''),nullif(x->>'date',''),jsonb_build_object('linked',coalesce(x->'linked','[]'::jsonb)) from jsonb_array_elements(coalesce(d->'evidence','[]'::jsonb)) x;
    end if;
  end loop;

  if p_event is not null then
    select event_hash into previous from public.thinkforge_audit_events where user_id=p_user_id order by created_at desc,id desc limit 1;
    eh:=encode(digest(coalesce(previous,'') || p_event::text || coalesce(p_request_id,''),'sha256'),'hex');
    insert into public.thinkforge_audit_events(user_id,event_type,entity_type,entity_id,payload,request_id,previous_hash,event_hash)
    values(p_user_id,coalesce(p_event->>'type','state_update'),coalesce(p_event->>'entityType','workspace'),null,coalesce(p_event->'payload','{}'::jsonb),p_request_id,previous,eh);
  end if;
  return jsonb_build_object('version',current_version,'organizationId',org_id,'relationalProjection','completed');
exception when sqlstate '40001' then raise;
end $$;
