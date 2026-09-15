-- Normalized runtime records make agent behavior queryable without parsing a
-- monolithic JSON trace. All rows remain organization-scoped through RLS.
create table if not exists public.thinkforge_agent_steps(
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.thinkforge_agent_runs(id) on delete cascade,
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  sequence_no integer not null check(sequence_no>=0), state text not null, event_type text not null,
  detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(run_id,sequence_no)
);
create table if not exists public.thinkforge_agent_tool_calls(
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.thinkforge_agent_runs(id) on delete cascade,
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  tool_name text not null, status text not null, attempt integer not null default 1 check(attempt>0),
  input_hash text, output_hash text, latency_ms integer check(latency_ms>=0), cost_usd numeric not null default 0 check(cost_usd>=0),
  error_code text, created_at timestamptz not null default now()
);
create table if not exists public.thinkforge_agent_feedback(
  id uuid primary key default gen_random_uuid(), run_id uuid not null references public.thinkforge_agent_runs(id) on delete cascade,
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, rating integer check(rating between 1 and 5),
  outcome text not null check(outcome in ('accepted','rejected','edited','inconclusive')), note text, created_at timestamptz not null default now()
);
create index if not exists idx_tf_agent_steps_run on public.thinkforge_agent_steps(run_id,sequence_no);
create index if not exists idx_tf_agent_tools_run on public.thinkforge_agent_tool_calls(run_id,created_at);
create index if not exists idx_tf_agent_feedback_run on public.thinkforge_agent_feedback(run_id,created_at);
alter table public.thinkforge_agent_steps enable row level security;
alter table public.thinkforge_agent_tool_calls enable row level security;
alter table public.thinkforge_agent_feedback enable row level security;
drop policy if exists tf_agent_steps_member_read on public.thinkforge_agent_steps;
create policy tf_agent_steps_member_read on public.thinkforge_agent_steps for select using(exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_agent_steps.organization_id and m.user_id=auth.uid()));
drop policy if exists tf_agent_tools_member_read on public.thinkforge_agent_tool_calls;
create policy tf_agent_tools_member_read on public.thinkforge_agent_tool_calls for select using(exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_agent_tool_calls.organization_id and m.user_id=auth.uid()));
drop policy if exists tf_agent_feedback_member_access on public.thinkforge_agent_feedback;
create policy tf_agent_feedback_member_access on public.thinkforge_agent_feedback for all using(exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_agent_feedback.organization_id and m.user_id=auth.uid())) with check(user_id=auth.uid() and exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_agent_feedback.organization_id and m.user_id=auth.uid()));

create or replace function public.thinkforge_guard_agent_run_org_match()
returns trigger language plpgsql security definer set search_path=public as $$
declare expected_org uuid;
begin
  select organization_id into expected_org from public.thinkforge_agent_runs where id=new.run_id;
  if expected_org is null or expected_org<>new.organization_id then raise exception using errcode='23514',message='agent runtime record organization does not match run'; end if;
  return new;
end $$;
drop trigger if exists tf_agent_step_org_match on public.thinkforge_agent_steps;
create trigger tf_agent_step_org_match before insert or update on public.thinkforge_agent_steps for each row execute function public.thinkforge_guard_agent_run_org_match();
drop trigger if exists tf_agent_tool_org_match on public.thinkforge_agent_tool_calls;
create trigger tf_agent_tool_org_match before insert or update on public.thinkforge_agent_tool_calls for each row execute function public.thinkforge_guard_agent_run_org_match();
drop trigger if exists tf_agent_feedback_org_match on public.thinkforge_agent_feedback;
create trigger tf_agent_feedback_org_match before insert or update on public.thinkforge_agent_feedback for each row execute function public.thinkforge_guard_agent_run_org_match();
