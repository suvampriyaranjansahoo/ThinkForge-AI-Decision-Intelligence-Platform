-- ThinkForge v10 research integrity hardening
-- Align database enum/status values with the application-level study lifecycle.
alter table if exists public.thinkforge_research_studies
  drop constraint if exists thinkforge_research_studies_status_check;

-- Backfill/standardize rows created by earlier drafts before enforcing the new check.
update public.thinkforge_research_studies set status=upper(status) where status is not null;

alter table if exists public.thinkforge_research_studies
  add constraint thinkforge_research_studies_status_check
  check(status in ('DRAFT','REGISTERED','DATASET_FROZEN','CANDIDATES_FROZEN','PILOT','QUALIFICATION','MAIN_ANNOTATION','ADJUDICATION','GOLD_LOCKED','EVALUATION_COMPLETE','PUBLISHED'));

alter table public.thinkforge_research_studies add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_research_studies add column if not exists idempotency_key text;
alter table public.thinkforge_research_studies add column if not exists config_hash text;
alter table public.thinkforge_research_studies add column if not exists updated_at timestamptz not null default now();
create unique index if not exists uq_tf_research_study_idempotency on public.thinkforge_research_studies(idempotency_key) where idempotency_key is not null;

alter table public.thinkforge_evaluation_raters add column if not exists attention_check_rate numeric check(attention_check_rate between 0 and 1);
alter table public.thinkforge_evaluation_raters add column if not exists pilot_quality_status text;

alter table public.thinkforge_evaluation_pairwise_v2 add column if not exists blinded boolean not null default true;

-- Canonical provenance on annotations.
alter table public.thinkforge_evaluation_annotations add column if not exists study_version text;
alter table public.thinkforge_evaluation_annotations add column if not exists protocol_version text;
alter table public.thinkforge_evaluation_annotations add column if not exists candidate_checksum text;
create index if not exists idx_tf_annotations_rater_case on public.thinkforge_evaluation_annotations(study_id,rater_id,case_id);


-- Tighten write access for study metadata; participants may read, owners may mutate.
drop policy if exists tf_studies_insert_owner on public.thinkforge_research_studies;
create policy tf_studies_insert_owner on public.thinkforge_research_studies for insert with check(created_by=auth.uid());
drop policy if exists tf_studies_update_owner on public.thinkforge_research_studies;
create policy tf_studies_update_owner on public.thinkforge_research_studies for update using(created_by=auth.uid()) with check(created_by=auth.uid());
