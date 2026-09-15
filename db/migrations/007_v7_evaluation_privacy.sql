-- ThinkForge v7: evidence-grounded evaluation, durable tenancy, privacy and decision-native history.
create extension if not exists pgcrypto;

create table if not exists public.thinkforge_annotation_assignments(
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  rater_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'assigned' check(status in ('assigned','in_progress','submitted','adjudication_required','completed')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(case_id,rater_id)
);

create table if not exists public.thinkforge_annotation_adjudications(
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  dimension text not null,
  adjudicator_id uuid not null references auth.users(id) on delete cascade,
  final_score numeric check(final_score between 1 and 5),
  rationale text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.thinkforge_evaluation_runs(
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  model text,
  prompt_version text,
  retriever_version text,
  case_count int not null default 0,
  expert_gold_count int not null default 0,
  contract_pass_rate numeric,
  grounding_score numeric,
  hallucination_rate numeric,
  rag_recall_at_10 numeric,
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.thinkforge_prompt_versions(
  id uuid primary key default gen_random_uuid(),
  module text not null,
  version text not null,
  template text not null,
  created_at timestamptz not null default now(),
  unique(module,version)
);

create table if not exists public.thinkforge_model_versions(
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  version text not null,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider,model,version)
);

create table if not exists public.thinkforge_documents_versions(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.thinkforge_documents(id) on delete cascade,
  version_no bigint not null,
  checksum text not null,
  extracted_text text,
  parser text,
  parser_version text,
  created_at timestamptz not null default now(),
  unique(document_id,version_no),
  unique(document_id,checksum)
);

create table if not exists public.thinkforge_privacy_requests(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check(request_type in ('export','delete','retention')),
  status text not null default 'requested' check(status in ('requested','processing','completed','rejected')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);

alter table public.thinkforge_annotation_assignments enable row level security;
drop policy if exists tf_assignments_self on public.thinkforge_annotation_assignments;
create policy tf_assignments_self on public.thinkforge_annotation_assignments for all using(rater_id=auth.uid()) with check(rater_id=auth.uid());
alter table public.thinkforge_annotation_adjudications enable row level security;
drop policy if exists tf_adjudications_self on public.thinkforge_annotation_adjudications;
create policy tf_adjudications_self on public.thinkforge_annotation_adjudications for all using(adjudicator_id=auth.uid()) with check(adjudicator_id=auth.uid());
alter table public.thinkforge_evaluation_runs enable row level security;
drop policy if exists tf_eval_runs_self on public.thinkforge_evaluation_runs;
create policy tf_eval_runs_self on public.thinkforge_evaluation_runs for all using(created_by=auth.uid()) with check(created_by=auth.uid());
alter table public.thinkforge_prompt_versions enable row level security;
drop policy if exists tf_prompts_authenticated_read on public.thinkforge_prompt_versions;
create policy tf_prompts_authenticated_read on public.thinkforge_prompt_versions for select using(auth.uid() is not null);
alter table public.thinkforge_model_versions enable row level security;
drop policy if exists tf_models_authenticated_read on public.thinkforge_model_versions;
create policy tf_models_authenticated_read on public.thinkforge_model_versions for select using(auth.uid() is not null);

create index if not exists idx_tf_eval_runs_created on public.thinkforge_evaluation_runs(created_at desc);
create index if not exists idx_tf_doc_versions_doc on public.thinkforge_documents_versions(document_id,version_no desc);

-- Append-only audit guard: application role can insert but not update/delete via RLS.
drop policy if exists tf_audit_update on public.thinkforge_audit_events;
drop policy if exists tf_audit_delete on public.thinkforge_audit_events;

alter table public.thinkforge_privacy_requests enable row level security;
drop policy if exists tf_privacy_self on public.thinkforge_privacy_requests;
create policy tf_privacy_self on public.thinkforge_privacy_requests for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.thinkforge_evaluation_candidates(
  case_id text primary key,
  module text not null,
  model text,
  prompt_version text,
  retriever_version text,
  output_json jsonb not null,
  request_id text not null,
  generated_at timestamptz not null default now(),
  checksum text not null
);
alter table public.thinkforge_evaluation_candidates enable row level security;
drop policy if exists tf_eval_candidates_authenticated_read on public.thinkforge_evaluation_candidates;
create policy tf_eval_candidates_authenticated_read on public.thinkforge_evaluation_candidates for select using(auth.uid() is not null);
