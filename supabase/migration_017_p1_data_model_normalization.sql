-- ThinkForge Stage 2 P1: domain normalization and decision-learning integrity.
-- Additive/idempotent. Preserves existing APIs and Stage 1/Stage 2/P0 data.
-- Goals: normalized opportunity/solution/assumption/experiment links,
-- research session/participant/observation model, contradiction records,
-- measurement provenance, decision context/tiering, domain events.

create extension if not exists pgcrypto;

-- 1. Normalize opportunity lifecycle/version metadata.
alter table public.thinkforge_opportunities add column if not exists client_id text;
alter table public.thinkforge_opportunities add column if not exists version bigint not null default 1;
alter table public.thinkforge_opportunities add column if not exists updated_at timestamptz not null default now();
alter table public.thinkforge_opportunities add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_opportunities add column if not exists archived_at timestamptz;
alter table public.thinkforge_opportunities add column if not exists problem_statement text;
alter table public.thinkforge_opportunities add column if not exists target_segment text;
alter table public.thinkforge_opportunities add column if not exists rationale text;
create unique index if not exists uq_tf_opportunity_client_org on public.thinkforge_opportunities(organization_id,client_id) where client_id is not null;

-- 2. First-class solutions. Solutions are reusable across opportunities/decisions.
create table if not exists public.thinkforge_solutions(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  discovery_id uuid references public.thinkforge_discoveries(id) on delete set null,
  opportunity_id uuid references public.thinkforge_opportunities(id) on delete set null,
  client_id text,
  title text not null,
  description text,
  status text not null default 'candidate' check(status in ('candidate','shortlisted','tested','selected','rejected','archived')),
  desirability_score numeric(5,2),
  feasibility_score numeric(5,2),
  viability_score numeric(5,2),
  risk_score numeric(5,2),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index if not exists uq_tf_solution_client_org on public.thinkforge_solutions(organization_id,client_id) where client_id is not null;
create index if not exists idx_tf_solution_opportunity on public.thinkforge_solutions(opportunity_id,updated_at desc);
create index if not exists idx_tf_solution_discovery on public.thinkforge_solutions(discovery_id,updated_at desc);

-- 3. Normalize assumption semantics for reusable risk reasoning.
alter table public.thinkforge_assumptions add column if not exists assumption_type text not null default 'desirability';
alter table public.thinkforge_assumptions add column if not exists source text;
alter table public.thinkforge_assumptions add column if not exists leap_of_faith boolean not null default false;
alter table public.thinkforge_assumptions add column if not exists criticality numeric(5,2);
alter table public.thinkforge_assumptions add column if not exists evidence_strength numeric(5,2);
alter table public.thinkforge_assumptions add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname='tf_assumptions_type_chk') then
    alter table public.thinkforge_assumptions add constraint tf_assumptions_type_chk check (assumption_type in ('desirability','usability','feasibility','viability','ethical','other'));
  end if;
end $$;

-- 4. Explicit experiment analysis-plan fields. Existing experiment APIs continue to work.
alter table public.thinkforge_experiments add column if not exists baseline_value numeric;
alter table public.thinkforge_experiments add column if not exists minimum_detectable_effect numeric;
alter table public.thinkforge_experiments add column if not exists alpha numeric(6,5);
alter table public.thinkforge_experiments add column if not exists power numeric(6,5);
alter table public.thinkforge_experiments add column if not exists required_sample_size integer;
alter table public.thinkforge_experiments add column if not exists randomization_unit text;
alter table public.thinkforge_experiments add column if not exists guardrails jsonb not null default '[]'::jsonb;
alter table public.thinkforge_experiments add column if not exists stopping_rule text;
alter table public.thinkforge_experiments add column if not exists analysis_plan jsonb not null default '{}'::jsonb;

-- 5. Research session, participant, observation, theme model.
create table if not exists public.thinkforge_research_sessions(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  discovery_id uuid references public.thinkforge_discoveries(id) on delete set null,
  session_type text not null check(session_type in ('interview','usability','survey','analytics','support','experiment','contextual_inquiry','other')),
  title text,
  method text,
  started_at timestamptz,
  ended_at timestamptz,
  researcher_id uuid references auth.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_research_sessions_discovery on public.thinkforge_research_sessions(discovery_id,started_at desc);

create table if not exists public.thinkforge_research_participants(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  external_ref text,
  segment text,
  persona text,
  experience_level text,
  attributes jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_tf_participant_ref_org on public.thinkforge_research_participants(organization_id,external_ref) where external_ref is not null;

create table if not exists public.thinkforge_research_observations(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  discovery_id uuid references public.thinkforge_discoveries(id) on delete set null,
  session_id uuid references public.thinkforge_research_sessions(id) on delete set null,
  participant_id uuid references public.thinkforge_research_participants(id) on delete set null,
  source_evidence_id uuid references public.thinkforge_research_evidence(id) on delete set null,
  kind text not null check(kind in ('fact','observation','behavior','quote','inference')),
  content text not null,
  confidence numeric(5,4) check(confidence between 0 and 1),
  researcher_confirmed boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_observations_discovery on public.thinkforge_research_observations(discovery_id,created_at desc);
create index if not exists idx_tf_observations_session on public.thinkforge_research_observations(session_id,created_at desc);

create table if not exists public.thinkforge_research_themes(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  discovery_id uuid references public.thinkforge_discoveries(id) on delete set null,
  label text not null,
  description text,
  status text not null default 'candidate' check(status in ('candidate','confirmed','rejected','archived')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_themes_discovery on public.thinkforge_research_themes(discovery_id,updated_at desc);

create table if not exists public.thinkforge_theme_observations(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  theme_id uuid not null references public.thinkforge_research_themes(id) on delete cascade,
  observation_id uuid not null references public.thinkforge_research_observations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(theme_id,observation_id)
);

-- 6. Decision context + tiering. Tier determines expected rigor.
create table if not exists public.thinkforge_decision_contexts(
  decision_id uuid primary key references public.thinkforge_decisions(id) on delete cascade,
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  trigger text,
  decision_type text,
  reversibility text check(reversibility in ('high','medium','low','irreversible')),
  decision_tier smallint not null default 2 check(decision_tier between 1 and 4),
  deadline_at timestamptz,
  cost_of_delay numeric,
  stakeholders jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  required_evidence_level text not null default 'moderate' check(required_evidence_level in ('minimal','moderate','high','maximum')),
  rationale text,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thinkforge_decision_participants(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','contributor','reviewer','approver','observer')),
  created_at timestamptz not null default now(),
  primary key(decision_id,user_id)
);
create index if not exists idx_tf_decision_participants_org on public.thinkforge_decision_participants(organization_id,decision_id);

-- 7. First-class contradictions. Preserve disagreement instead of averaging it away.
create table if not exists public.thinkforge_contradictions(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  discovery_id uuid references public.thinkforge_discoveries(id) on delete set null,
  decision_id uuid references public.thinkforge_decisions(id) on delete set null,
  claim_a_id uuid references public.thinkforge_claims(id) on delete set null,
  claim_b_id uuid references public.thinkforge_claims(id) on delete set null,
  evidence_a_id uuid references public.thinkforge_evidence(id) on delete set null,
  evidence_b_id uuid references public.thinkforge_evidence(id) on delete set null,
  contradiction_type text not null check(contradiction_type in ('direct','segment','context','temporal','method','measurement','other')),
  severity text not null default 'medium' check(severity in ('low','medium','high','critical')),
  explanation text,
  resolution text,
  status text not null default 'open' check(status in ('open','investigating','resolved','accepted','dismissed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_contradictions_discovery on public.thinkforge_contradictions(discovery_id,status,created_at desc);
create index if not exists idx_tf_contradictions_decision on public.thinkforge_contradictions(decision_id,status,created_at desc);

-- 8. Measurement provenance on outcomes. Actuals must be attributable and time-scoped.
alter table public.thinkforge_outcomes add column if not exists measurement_source text;
alter table public.thinkforge_outcomes add column if not exists measurement_method text;
alter table public.thinkforge_outcomes add column if not exists source_event_ref text;
alter table public.thinkforge_outcomes add column if not exists measurement_window_start timestamptz;
alter table public.thinkforge_outcomes add column if not exists measurement_window_end timestamptz;
alter table public.thinkforge_outcomes add column if not exists aggregation_method text;
alter table public.thinkforge_outcomes add column if not exists verified_at timestamptz;
alter table public.thinkforge_outcomes add column if not exists verified_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_outcomes add column if not exists verification_status text not null default 'unverified';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tf_outcome_verification_chk') then
    alter table public.thinkforge_outcomes add constraint tf_outcome_verification_chk check (verification_status in ('unverified','verified','disputed','locked'));
  end if;
end $$;

-- 9. Reusable domain events. These are append-only facts, not mutable state.
create table if not exists public.thinkforge_domain_events(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version bigint,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  request_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_tf_domain_events_aggregate on public.thinkforge_domain_events(organization_id,aggregate_type,aggregate_id,created_at desc);
create index if not exists idx_tf_domain_events_type on public.thinkforge_domain_events(organization_id,event_type,created_at desc);

-- 10. Cross-tenant/link integrity triggers. Child/link organization must match its parents.
create or replace function public.thinkforge_guard_org_match(p_link_org uuid,p_parent_org uuid,p_label text)
returns void language plpgsql immutable as $$
begin
  if p_link_org is null or p_parent_org is null or p_link_org<>p_parent_org then
    raise exception using errcode='23514',message=coalesce(p_label,'Organization mismatch');
  end if;
end $$;

create or replace function public.thinkforge_guard_solution_org()
returns trigger language plpgsql security definer set search_path=public as $$
declare parent_org uuid; begin
  if new.opportunity_id is not null then select organization_id into parent_org from public.thinkforge_opportunities where id=new.opportunity_id; perform public.thinkforge_guard_org_match(new.organization_id,parent_org,'Solution/opportunity organization mismatch'); end if;
  if new.discovery_id is not null then select organization_id into parent_org from public.thinkforge_discoveries where id=new.discovery_id; perform public.thinkforge_guard_org_match(new.organization_id,parent_org,'Solution/discovery organization mismatch'); end if;
  return new;
end $$;
drop trigger if exists trg_tf_solution_org on public.thinkforge_solutions;
create trigger trg_tf_solution_org before insert or update on public.thinkforge_solutions for each row execute function public.thinkforge_guard_solution_org();

create or replace function public.thinkforge_guard_observation_org()
returns trigger language plpgsql security definer set search_path=public as $$
declare parent_org uuid; begin
  if new.discovery_id is not null then select organization_id into parent_org from public.thinkforge_discoveries where id=new.discovery_id; perform public.thinkforge_guard_org_match(new.organization_id,parent_org,'Observation/discovery organization mismatch'); end if;
  if new.session_id is not null then select organization_id into parent_org from public.thinkforge_research_sessions where id=new.session_id; perform public.thinkforge_guard_org_match(new.organization_id,parent_org,'Observation/session organization mismatch'); end if;
  if new.participant_id is not null then select organization_id into parent_org from public.thinkforge_research_participants where id=new.participant_id; perform public.thinkforge_guard_org_match(new.organization_id,parent_org,'Observation/participant organization mismatch'); end if;
  return new;
end $$;
drop trigger if exists trg_tf_observation_org on public.thinkforge_research_observations;
create trigger trg_tf_observation_org before insert or update on public.thinkforge_research_observations for each row execute function public.thinkforge_guard_observation_org();

create or replace function public.thinkforge_guard_decision_context_org()
returns trigger language plpgsql security definer set search_path=public as $$
declare parent_org uuid; begin
  select organization_id into parent_org from public.thinkforge_decisions where id=new.decision_id; perform public.thinkforge_guard_org_match(new.organization_id,parent_org,'Decision context organization mismatch'); return new;
end $$;
drop trigger if exists trg_tf_decision_context_org on public.thinkforge_decision_contexts;
create trigger trg_tf_decision_context_org before insert or update on public.thinkforge_decision_contexts for each row execute function public.thinkforge_guard_decision_context_org();

-- 11. Tenant RLS for all P1 tables.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['thinkforge_solutions','thinkforge_research_sessions','thinkforge_research_participants','thinkforge_research_observations','thinkforge_research_themes','thinkforge_theme_observations','thinkforge_decision_contexts','thinkforge_decision_participants','thinkforge_contradictions','thinkforge_domain_events'] LOOP
    EXECUTE format('alter table public.%I enable row level security',t);
  END LOOP;
END $$;

create policy tf_solutions_org on public.thinkforge_solutions for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_research_sessions_org on public.thinkforge_research_sessions for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_research_participants_org on public.thinkforge_research_participants for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_research_observations_org on public.thinkforge_research_observations for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_research_themes_org on public.thinkforge_research_themes for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_theme_observations_org on public.thinkforge_theme_observations for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_decision_contexts_org on public.thinkforge_decision_contexts for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_decision_participants_org on public.thinkforge_decision_participants for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_contradictions_org on public.thinkforge_contradictions for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_domain_events_select on public.thinkforge_domain_events for select using(public.thinkforge_has_org_role(organization_id,'viewer'));
create policy tf_domain_events_insert on public.thinkforge_domain_events for insert with check(public.thinkforge_has_org_role(organization_id,'editor'));

-- 12. Read model for reconstructing discovery lineage.
create or replace view public.thinkforge_discovery_lineage_v1 as
select
  o.id as opportunity_id,
  o.organization_id,
  o.discovery_id,
  o.label as opportunity_label,
  o.status as opportunity_status,
  s.id as solution_id,
  s.title as solution_title,
  s.status as solution_status,
  s.desirability_score,
  s.feasibility_score,
  s.viability_score,
  a.id as assumption_id,
  a.text as assumption_text,
  a.assumption_type,
  a.leap_of_faith,
  a.criticality,
  a.evidence_strength
from public.thinkforge_opportunities o
left join public.thinkforge_solutions s on s.opportunity_id=o.id and s.organization_id=o.organization_id and s.archived_at is null
left join public.thinkforge_solution_assumptions sa on sa.solution_id=s.id and sa.organization_id=s.organization_id
left join public.thinkforge_assumptions a on a.id=sa.assumption_id and a.organization_id=s.organization_id and a.archived_at is null;

-- 13. Keep JSON arrays as compatibility metadata, but expose normalized counts.
create or replace view public.thinkforge_opportunity_evidence_health_v1 as
select
  o.id as opportunity_id,
  o.organization_id,
  count(distinct l.evidence_id) as normalized_evidence_count,
  coalesce(jsonb_array_length(o.evidence_ids),0) as legacy_evidence_ref_count
from public.thinkforge_opportunities o
left join public.thinkforge_opportunity_evidence_links l on l.opportunity_id=o.id and l.organization_id=o.organization_id
group by o.id,o.organization_id,o.evidence_ids;

-- Grants for service-role based migrations/functions; RLS still governs normal client access.
grant select on public.thinkforge_discovery_lineage_v1 to service_role;
grant select on public.thinkforge_opportunity_evidence_health_v1 to service_role;
