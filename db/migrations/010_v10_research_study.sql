-- ThinkForge v10 research study controls.
create extension if not exists pgcrypto;

create table if not exists public.thinkforge_research_studies(
  study_id text primary key,
  study_version text not null,
  dataset_version text not null,
  rubric_version text not null,
  protocol_version text not null,
  status text not null check(status in ('DRAFT','REGISTERED','DATASET_FROZEN','CANDIDATES_FROZEN','PILOT','QUALIFICATION','MAIN_ANNOTATION','ADJUDICATION','GOLD_LOCKED','EVALUATION_COMPLETE','PUBLISHED')),
  dataset_checksum text,
  candidate_checksum text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.thinkforge_evaluation_rater_profiles(
  study_id text not null references public.thinkforge_research_studies(study_id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  expertise jsonb not null default '[]'::jsonb,
  training_version text,
  pilot_completed integer not null default 0,
  pilot_quality numeric,
  hidden_duplicate_consistency numeric,
  attention_check_rate numeric,
  qualification_status text not null default 'UNTRAINED' check(qualification_status in ('UNTRAINED','TRAINING','PILOT','QUALIFICATION_REVIEW','CERTIFIED','SUSPENDED')),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(study_id,rater_id)
);
create table if not exists public.thinkforge_evaluation_candidate_snapshots(
  study_id text primary key references public.thinkforge_research_studies(study_id) on delete cascade,
  dataset_checksum text not null,
  candidate_checksum text not null,
  model_config jsonb not null default '{}'::jsonb,
  immutable boolean not null default false,
  frozen_at timestamptz
);
alter table public.thinkforge_research_studies enable row level security;
alter table public.thinkforge_evaluation_rater_profiles enable row level security;
alter table public.thinkforge_evaluation_candidate_snapshots enable row level security;
create index if not exists idx_tf_research_study_status on public.thinkforge_research_studies(status);
create index if not exists idx_tf_rater_qualification on public.thinkforge_evaluation_rater_profiles(study_id,qualification_status);
