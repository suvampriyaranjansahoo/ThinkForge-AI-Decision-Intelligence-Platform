-- ThinkForge v8 quality hardening: annotation integrity, audit immutability and evaluation uniqueness.
create extension if not exists pgcrypto;

create unique index if not exists uq_tf_annotation_case_rater_module
  on public.thinkforge_evaluation_annotations(case_id,rater_id,module);

alter table public.thinkforge_evaluation_candidates
  add column if not exists status text not null default 'frozen' check(status in ('frozen','invalidated')),
  add column if not exists checksum_algo text not null default 'sha256';

create or replace function public.prevent_tf_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ThinkForge audit events are append-only';
end $$;

drop trigger if exists trg_tf_audit_no_update on public.thinkforge_audit_events;
create trigger trg_tf_audit_no_update before update or delete on public.thinkforge_audit_events
for each row execute function public.prevent_tf_audit_mutation();

create index if not exists idx_tf_audit_request on public.thinkforge_audit_events(request_id);
create index if not exists idx_tf_eval_candidates_module on public.thinkforge_evaluation_candidates(module,generated_at desc);
