-- ThinkForge Stage 1: evidence-driven product discovery. Additive/idempotent.
create table if not exists public.thinkforge_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desired_outcome text not null,
  research_question text not null,
  question_type text not null,
  method text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'DRAFT',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_discoveries_user_updated on public.thinkforge_discoveries(user_id,updated_at desc);
alter table public.thinkforge_discoveries enable row level security;
drop policy if exists "discoveries_own" on public.thinkforge_discoveries;
create policy "discoveries_own" on public.thinkforge_discoveries for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_research_evidence (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references public.thinkforge_discoveries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check(level in ('FACT','OBSERVATION','INTERPRETATION','OPPORTUNITY','HYPOTHESIS')),
  content text not null,
  source_type text not null,
  source_id text,
  participant_id text,
  segment text,
  quote text,
  stance text not null default 'neutral' check(stance in ('supports','contradicts','neutral')),
  strength text not null default 'medium' check(strength in ('weak','medium','strong')),
  collected_at date,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_research_evidence_discovery on public.thinkforge_research_evidence(discovery_id);
create index if not exists idx_tf_research_evidence_segment on public.thinkforge_research_evidence(discovery_id,segment);
alter table public.thinkforge_research_evidence enable row level security;
drop policy if exists "research_evidence_own" on public.thinkforge_research_evidence;
create policy "research_evidence_own" on public.thinkforge_research_evidence for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_research_codes (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references public.thinkforge_discoveries(id) on delete cascade,
  evidence_id uuid references public.thinkforge_research_evidence(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_type text not null,
  label text not null,
  researcher_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.thinkforge_research_codes enable row level security;
create policy "research_codes_own" on public.thinkforge_research_codes for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_opportunities (
  id uuid primary key default gen_random_uuid(),
  discovery_id uuid not null references public.thinkforge_discoveries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  customer_importance int check(customer_importance between 0 and 10),
  customer_reach int check(customer_reach between 0 and 10),
  strategic_relevance int check(strategic_relevance between 0 and 10),
  evidence_strength int check(evidence_strength between 0 and 10),
  market_relevance int check(market_relevance between 0 and 10),
  score numeric(5,2),
  status text not null default 'candidate',
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_opportunities_discovery on public.thinkforge_opportunities(discovery_id);
alter table public.thinkforge_opportunities enable row level security;
create policy "opportunities_own" on public.thinkforge_opportunities for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

create table if not exists public.thinkforge_discovery_tests (
  id uuid primary key default gen_random_uuid(), discovery_id uuid not null references public.thinkforge_discoveries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, target_type text not null, target_id text, test_type text not null,
  hypothesis text not null, result text, status text not null default 'planned', created_at timestamptz not null default now()
);
alter table public.thinkforge_discovery_tests enable row level security;
create policy "discovery_tests_own" on public.thinkforge_discovery_tests for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
