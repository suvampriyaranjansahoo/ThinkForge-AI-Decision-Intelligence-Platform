-- v11: 9.5 engineering-readiness foundations. Idempotent additive migration.
create table if not exists thinkforge_artifact_registry (
  id text not null, type text not null, version text not null, checksum text not null,
  status text not null default 'candidate', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), promoted_at timestamptz,
  primary key(type,id,version)
);
create table if not exists thinkforge_outcomes (
  id text primary key, prediction_id text not null, decision_id text,
  actual numeric not null, source text not null, verified boolean not null default false,
  observed_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_tf_outcomes_prediction on thinkforge_outcomes(prediction_id);
create index if not exists idx_tf_artifacts_status on thinkforge_artifact_registry(status);
