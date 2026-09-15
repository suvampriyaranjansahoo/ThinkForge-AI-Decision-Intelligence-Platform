-- v10 pairwise and decision-impact study records.
create table if not exists public.thinkforge_decision_impact_records(
  id uuid primary key default gen_random_uuid(),
  study_id text not null,
  participant_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null,
  condition text not null check(condition in ('HUMAN_ONLY','HUMAN_PLUS_THINKFORGE')),
  decision_quality numeric not null check(decision_quality between 1 and 5),
  decision_time_seconds numeric not null default 0 check(decision_time_seconds>=0),
  assumptions_found integer not null default 0 check(assumptions_found>=0),
  evidence_used integer not null default 0 check(evidence_used>=0),
  confidence numeric not null default 3 check(confidence between 1 and 5),
  notes text not null default '',
  created_at timestamptz not null default now()
);
alter table public.thinkforge_decision_impact_records enable row level security;
drop policy if exists tf_impact_own on public.thinkforge_decision_impact_records;
create policy tf_impact_own on public.thinkforge_decision_impact_records for all using(participant_id=auth.uid()) with check(participant_id=auth.uid());
create index if not exists idx_tf_impact_study_condition on public.thinkforge_decision_impact_records(study_id,condition);
