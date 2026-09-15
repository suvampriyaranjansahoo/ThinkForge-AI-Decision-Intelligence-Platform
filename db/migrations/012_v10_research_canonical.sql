-- v10 canonical research schema bridge. Run after 010/011 and prior research drafts.
-- Canonical identifiers are study_id/study_version and rater profile records.
create table if not exists public.thinkforge_research_studies(
  study_id text primary key, study_version text not null, dataset_version text not null, rubric_version text not null, protocol_version text not null,
  status text not null, dataset_checksum text, candidate_checksum text, config_hash text, created_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.thinkforge_evaluation_rater_profiles(
  study_id text not null references public.thinkforge_research_studies(study_id) on delete cascade, rater_id uuid not null references auth.users(id) on delete cascade,
  expertise jsonb not null default '[]'::jsonb, training_version text, pilot_completed integer not null default 0, pilot_quality numeric, hidden_duplicate_consistency numeric,
  attention_check_rate numeric, qualification_status text not null default 'UNTRAINED', qualified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(study_id,rater_id)
);
create table if not exists public.thinkforge_evaluation_candidate_snapshots(
  study_id text primary key references public.thinkforge_research_studies(study_id) on delete cascade, dataset_checksum text not null, candidate_checksum text not null,
  model_config jsonb not null default '{}'::jsonb, immutable boolean not null default false, frozen_at timestamptz
);
create table if not exists public.thinkforge_evaluation_candidates_v2(
  study_id text not null references public.thinkforge_research_studies(study_id) on delete cascade, case_id text not null, module text not null, model text not null, prompt_version text, retriever_version text,
  output_json jsonb not null, request_id text, generated_at timestamptz not null default now(), checksum text not null, primary key(study_id,case_id)
);
create table if not exists public.thinkforge_evaluation_pairwise_v2(
  id uuid primary key default gen_random_uuid(), study_id text not null references public.thinkforge_research_studies(study_id) on delete cascade, case_id text not null, rater_id uuid not null references auth.users(id) on delete cascade,
  left_candidate text not null, preference text not null check(preference in ('A','B','TIE')), position_seed text not null, blinded boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_tf_cand_v2_study_case on public.thinkforge_evaluation_candidates_v2(study_id,case_id);
create index if not exists idx_tf_profile_status on public.thinkforge_evaluation_rater_profiles(study_id,qualification_status);
create index if not exists idx_tf_pairwise_v2_study on public.thinkforge_evaluation_pairwise_v2(study_id,created_at desc);
