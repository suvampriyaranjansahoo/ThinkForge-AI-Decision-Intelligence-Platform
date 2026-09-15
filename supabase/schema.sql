-- ThinkForge production-grade persistence + audit foundation
create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.thinkforge_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.thinkforge_workspaces enable row level security;
drop policy if exists "workspace_select_own" on public.thinkforge_workspaces;
drop policy if exists "workspace_insert_own" on public.thinkforge_workspaces;
drop policy if exists "workspace_update_own" on public.thinkforge_workspaces;
drop policy if exists "workspace_delete_own" on public.thinkforge_workspaces;
create policy "workspace_select_own" on public.thinkforge_workspaces for select using (auth.uid() = user_id);
create policy "workspace_insert_own" on public.thinkforge_workspaces for insert with check (auth.uid() = user_id);
create policy "workspace_update_own" on public.thinkforge_workspaces for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workspace_delete_own" on public.thinkforge_workspaces for delete using (auth.uid() = user_id);

create table if not exists public.thinkforge_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  problem text not null,
  status text not null default 'validate' check(status in ('validate','build','defer','do_not_build')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_decisions_user_updated on public.thinkforge_decisions(user_id,updated_at desc);
alter table public.thinkforge_decisions enable row level security;
drop policy if exists "decisions_own" on public.thinkforge_decisions;
create policy "decisions_own" on public.thinkforge_decisions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_assumptions (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  impact int not null check(impact between 1 and 5),
  uncertainty int not null check(uncertainty between 1 and 5),
  confidence numeric(5,4) not null check(confidence between 0 and 1),
  status text not null default 'open',
  rationale text,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_assumptions_decision on public.thinkforge_assumptions(decision_id);
alter table public.thinkforge_assumptions enable row level security;
create policy "assumptions_own" on public.thinkforge_assumptions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_evidence (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  evidence_type text,
  source text,
  content text not null,
  stance text check(stance in ('supports','contradicts','neutral')),
  strength text check(strength in ('weak','medium','strong')),
  source_url text,
  source_locator text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_evidence_decision on public.thinkforge_evidence(decision_id);
alter table public.thinkforge_evidence enable row level security;
create policy "evidence_own" on public.thinkforge_evidence for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision_id uuid references public.thinkforge_decisions(id) on delete set null,
  request_id text not null,
  module text not null,
  model text,
  prompt_version text,
  retriever_version text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  cost_usd numeric(12,6),
  validation_status text,
  failure_code text,
  input_hash text,
  output_json jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_ai_interactions_request on public.thinkforge_ai_interactions(request_id);
create index if not exists idx_tf_ai_interactions_created on public.thinkforge_ai_interactions(created_at desc);
alter table public.thinkforge_ai_interactions enable row level security;
create policy "ai_interactions_own" on public.thinkforge_ai_interactions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_audit_user_created on public.thinkforge_audit_events(user_id,created_at desc);
alter table public.thinkforge_audit_events enable row level security;
create policy "audit_own" on public.thinkforge_audit_events for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mime_type text,
  checksum text,
  version int not null default 1,
  created_at timestamptz not null default now()
);
alter table public.thinkforge_documents enable row level security;
drop policy if exists "documents_own" on public.thinkforge_documents;
create policy "documents_own" on public.thinkforge_documents for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.thinkforge_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  source_locator text,
  token_count int,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_chunks_document on public.thinkforge_chunks(document_id,chunk_index);
create index if not exists idx_tf_chunks_embedding on public.thinkforge_chunks using ivfflat (embedding vector_cosine_ops) with (lists=100);
alter table public.thinkforge_chunks enable row level security;
drop policy if exists "chunks_own" on public.thinkforge_chunks;
create policy "chunks_own" on public.thinkforge_chunks for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create or replace function public.match_thinkforge_chunks(query_embedding vector(1536),match_count int default 8,filter_user_id uuid default auth.uid())
returns table(id uuid,content text,source_locator text,document_name text,similarity float)
language sql stable as $$
  select c.id,c.content,c.source_locator,d.name,1-(c.embedding<=>query_embedding) as similarity
  from public.thinkforge_chunks c join public.thinkforge_documents d on d.id=c.document_id
  where c.user_id=filter_user_id and c.embedding is not null
  order by c.embedding<=>query_embedding limit greatest(1,least(match_count,50));
$$;
