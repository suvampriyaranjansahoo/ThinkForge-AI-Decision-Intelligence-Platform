-- ThinkForge v9: research study controls, immutable candidate snapshots, rater qualification, adjudication and pairwise evaluation.
create table if not exists public.thinkforge_research_studies(
  id text primary key,
  version text not null,
  dataset_version text not null,
  rubric_version text not null,
  protocol_version text not null,
  candidate_snapshot text not null,
  status text not null default 'draft' check(status in ('draft','pilot','main','locked','completed','archived')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  locked_at timestamptz
);
create table if not exists public.thinkforge_evaluation_raters(
  study_id text not null references public.thinkforge_research_studies(id) on delete cascade,
  rater_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'UNTRAINED' check(state in ('UNTRAINED','TRAINING','PILOT','QUALIFICATION_REVIEW','CERTIFIED','MAIN_STUDY','SUSPENDED')),
  expertise jsonb not null default '[]'::jsonb,
  pilot_completed int not null default 0,
  quality_score numeric,
  hidden_duplicate_consistency numeric,
  certified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(study_id,rater_id)
);
create table if not exists public.thinkforge_evaluation_candidates_v2(
  study_id text not null references public.thinkforge_research_studies(id) on delete cascade,
  case_id text not null,
  module text not null,
  model text,
  prompt_version text,
  retriever_version text,
  output_json jsonb not null,
  request_id text not null,
  generated_at timestamptz not null default now(),
  checksum text not null,
  primary key(study_id,case_id)
);
create table if not exists public.thinkforge_evaluation_adjudications_v2(
  id uuid primary key default gen_random_uuid(),
  study_id text not null references public.thinkforge_research_studies(id) on delete cascade,
  case_id text not null,
  module text not null,
  dimension text not null,
  rater_a_score numeric,
  rater_b_score numeric,
  final_score numeric check(final_score between 1 and 5),
  disagreement_type text,
  rationale text not null,
  adjudicator_id uuid not null references auth.users(id) on delete restrict,
  rubric_version text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.thinkforge_evaluation_pairwise_v2(
  id uuid primary key default gen_random_uuid(),
  study_id text not null references public.thinkforge_research_studies(id) on delete cascade,
  case_id text not null,
  rater_id uuid not null references auth.users(id) on delete cascade,
  left_candidate text not null check(left_candidate in ('A','B')),
  preference text not null check(preference in ('A','B','TIE')),
  position_seed text not null,
  blinded boolean not null default true,
  created_at timestamptz not null default now(),
  unique(study_id,case_id,rater_id)
);
alter table public.thinkforge_research_studies enable row level security;
alter table public.thinkforge_evaluation_raters enable row level security;
alter table public.thinkforge_evaluation_candidates_v2 enable row level security;
alter table public.thinkforge_evaluation_adjudications_v2 enable row level security;
alter table public.thinkforge_evaluation_pairwise_v2 enable row level security;
drop policy if exists tf_studies_read on public.thinkforge_research_studies;
create policy tf_studies_read on public.thinkforge_research_studies for select using(auth.uid() is not null);
drop policy if exists tf_raters_self on public.thinkforge_evaluation_raters;
create policy tf_raters_self on public.thinkforge_evaluation_raters for all using(rater_id=auth.uid()) with check(rater_id=auth.uid());
drop policy if exists tf_candidates_read on public.thinkforge_evaluation_candidates_v2;
create policy tf_candidates_read on public.thinkforge_evaluation_candidates_v2 for select using(auth.uid() is not null);
drop policy if exists tf_pairwise_self on public.thinkforge_evaluation_pairwise_v2;
create policy tf_pairwise_self on public.thinkforge_evaluation_pairwise_v2 for all using(rater_id=auth.uid()) with check(rater_id=auth.uid());
create index if not exists idx_tf_raters_state on public.thinkforge_evaluation_raters(study_id,state);
create index if not exists idx_tf_adj_study_case on public.thinkforge_evaluation_adjudications_v2(study_id,case_id);

-- Extend existing annotation/candidate tables used by the API so study identity and freeze state are explicit.
alter table public.thinkforge_evaluation_annotations add column if not exists study_id text;
alter table public.thinkforge_evaluation_annotations add column if not exists candidate_frozen boolean not null default false;
alter table public.thinkforge_evaluation_annotations add column if not exists unsupported_claim_severity numeric check(unsupported_claim_severity between 0 and 2);
alter table public.thinkforge_evaluation_annotations add column if not exists citation_correctness numeric check(citation_correctness between 0 and 2);
alter table public.thinkforge_evaluation_annotations add column if not exists confidence numeric check(confidence between 1 and 5);
alter table public.thinkforge_evaluation_annotations add column if not exists claim_labels jsonb not null default '[]'::jsonb;
create index if not exists idx_tf_annotations_study_case on public.thinkforge_evaluation_annotations(study_id,case_id);
create index if not exists idx_tf_pairwise_study on public.thinkforge_evaluation_pairwise_v2(study_id,created_at desc);
