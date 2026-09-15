create table if not exists public.thinkforge_agent_runs(
  id uuid primary key, organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, request_id text not null, status text not null,
  agent_version text not null, goal text not null, trace jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_tf_agent_runs_org_created on public.thinkforge_agent_runs(organization_id,created_at desc);
alter table public.thinkforge_agent_runs enable row level security;
drop policy if exists tf_agent_runs_member_read on public.thinkforge_agent_runs;
create policy tf_agent_runs_member_read on public.thinkforge_agent_runs for select using(exists(select 1 from public.thinkforge_memberships m where m.organization_id=thinkforge_agent_runs.organization_id and m.user_id=auth.uid()));
