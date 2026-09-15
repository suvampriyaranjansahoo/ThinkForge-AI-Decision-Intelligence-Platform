-- ThinkForge v8 human ground-truth protocol: blinded presentations, adjudication provenance and reliability metadata.
create extension if not exists pgcrypto;

alter table public.thinkforge_evaluation_annotations
  add column if not exists presentation_id text,
  add column if not exists source_case_id text,
  add column if not exists is_hidden_duplicate boolean not null default false,
  add column if not exists rubric_version text,
  add column if not exists confidence smallint,
  add column if not exists claim_labels jsonb not null default '[]'::jsonb;

update public.thinkforge_evaluation_annotations
set presentation_id=coalesce(presentation_id, id::text),
    source_case_id=coalesce(source_case_id, case_id),
    rubric_version=coalesce(rubric_version,'tf-rubric-v3'),
    confidence=coalesce(confidence,3)
where presentation_id is null or source_case_id is null or rubric_version is null or confidence is null;

alter table public.thinkforge_evaluation_annotations
  alter column presentation_id set not null,
  alter column source_case_id set not null,
  alter column rubric_version set not null,
  alter column confidence set not null;

-- Hidden duplicate presentations must be allowed for intra-rater consistency checks.
drop index if exists uq_tf_annotation_case_rater_module;
create unique index if not exists uq_tf_annotation_presentation_rater
  on public.thinkforge_evaluation_annotations(presentation_id,rater_id);
create index if not exists idx_tf_annotations_source_case on public.thinkforge_evaluation_annotations(source_case_id,rater_id);

create table if not exists public.thinkforge_evaluation_adjudications(
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  module text not null,
  dimension text not null,
  rater_scores jsonb not null default '{}'::jsonb,
  final_score smallint not null check(final_score between 1 and 5),
  rationale text not null,
  adjudicator_id uuid not null references auth.users(id) on delete restrict,
  rubric_version text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_tf_adjudication_dimension
  on public.thinkforge_evaluation_adjudications(case_id,module,dimension,rubric_version);

alter table public.thinkforge_evaluation_adjudications enable row level security;
DROP POLICY IF EXISTS tf_adjudications_reviewer ON public.thinkforge_evaluation_adjudications;
-- Server-side service role should be used for adjudication writes; readers should be granted by the application authorization layer.
create policy tf_adjudications_reviewer on public.thinkforge_evaluation_adjudications
  for select using (auth.uid()=adjudicator_id);

create table if not exists public.thinkforge_evaluation_pairwise(
  id uuid primary key default gen_random_uuid(),
  comparison_id text not null,
  rater_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  left_system text not null,
  right_system text not null,
  preference text not null check(preference in ('left','right','tie')),
  created_at timestamptz not null default now(),
  unique(comparison_id,rater_id,case_id)
);
alter table public.thinkforge_evaluation_pairwise enable row level security;
DROP POLICY IF EXISTS tf_pairwise_own ON public.thinkforge_evaluation_pairwise;
create policy tf_pairwise_own on public.thinkforge_evaluation_pairwise
  for all using(rater_id=auth.uid()) with check(rater_id=auth.uid());
