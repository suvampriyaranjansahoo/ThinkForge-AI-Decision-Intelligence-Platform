-- ThinkForge Stage 2 P2: canonical-domain integrity and source-of-truth hardening.
-- Additive and backwards-compatible. Does not delete or rewrite existing rows.
-- Goals: normalize tenant lineage, enforce cross-entity ownership, strengthen
-- decision snapshots/outcome integrity, and provide canonical graph diagnostics.

create extension if not exists pgcrypto;

-- 1. Canonical tenant keys on remaining top-level entities.
alter table public.thinkforge_research_sessions add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_sessions add column if not exists archived_at timestamptz;
alter table public.thinkforge_research_participants add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_participants add column if not exists archived_at timestamptz;
alter table public.thinkforge_research_observations add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_observations add column if not exists archived_at timestamptz;
alter table public.thinkforge_research_themes add column if not exists version bigint not null default 1;
alter table public.thinkforge_research_themes add column if not exists archived_at timestamptz;
alter table public.thinkforge_discoveries add column if not exists version bigint not null default 1;
alter table public.thinkforge_discoveries add column if not exists archived_at timestamptz;

-- 2. Stronger decision/outcome lifecycle metadata.
alter table public.thinkforge_decisions add column if not exists decision_state_version bigint not null default 1;
alter table public.thinkforge_decisions add column if not exists decision_locked_at timestamptz;
alter table public.thinkforge_decisions add column if not exists decision_locked_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_product_outcomes add column if not exists version bigint not null default 1;
alter table public.thinkforge_product_outcomes add column if not exists verified_at timestamptz;
alter table public.thinkforge_product_outcomes add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- 3. Canonical cross-tenant integrity helper.
create or replace function public.thinkforge_require_same_org(p_link_org uuid,p_parent_org uuid,p_label text)
returns void language plpgsql immutable as $$
begin
  if p_link_org is null or p_parent_org is null or p_link_org<>p_parent_org then
    raise exception using errcode='23514', message=coalesce(p_label,'Organization mismatch');
  end if;
end $$;

-- 4. Enforce decision -> initiative/outcome lineage.
create or replace function public.thinkforge_guard_decision_hierarchy()
returns trigger language plpgsql security definer set search_path=public as $$
declare o uuid;
begin
  if new.initiative_id is not null then
    select organization_id into o from public.thinkforge_initiatives where id=new.initiative_id;
    perform public.thinkforge_require_same_org(new.organization_id,o,'Decision/initiative organization mismatch');
  end if;
  if new.primary_outcome_id is not null then
    select organization_id into o from public.thinkforge_product_outcomes where id=new.primary_outcome_id;
    perform public.thinkforge_require_same_org(new.organization_id,o,'Decision/outcome organization mismatch');
  end if;
  return new;
end $$;
drop trigger if exists trg_tf_decision_hierarchy on public.thinkforge_decisions;
create trigger trg_tf_decision_hierarchy before insert or update on public.thinkforge_decisions for each row execute function public.thinkforge_guard_decision_hierarchy();

-- 5. Outcome -> initiative lineage.
create or replace function public.thinkforge_guard_outcome_hierarchy()
returns trigger language plpgsql security definer set search_path=public as $$
declare o uuid;
begin
  if new.initiative_id is not null then
    select organization_id into o from public.thinkforge_initiatives where id=new.initiative_id;
    perform public.thinkforge_require_same_org(new.organization_id,o,'Outcome/initiative organization mismatch');
  end if;
  return new;
end $$;
drop trigger if exists trg_tf_outcome_hierarchy on public.thinkforge_product_outcomes;
create trigger trg_tf_outcome_hierarchy before insert or update on public.thinkforge_product_outcomes for each row execute function public.thinkforge_guard_outcome_hierarchy();

-- 6. Canonical link integrity: every graph edge must stay inside one organization.
create or replace function public.thinkforge_guard_graph_link_org()
returns trigger language plpgsql security definer set search_path=public as $$
declare o uuid;
begin
  if tg_table_name='thinkforge_claim_evidence_links' then
    select organization_id into o from public.thinkforge_claims where id=new.claim_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Claim/evidence claim organization mismatch');
    select organization_id into o from public.thinkforge_evidence where id=new.evidence_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Claim/evidence evidence organization mismatch');
  elsif tg_table_name='thinkforge_evidence_provenance' then
    select organization_id into o from public.thinkforge_evidence where id=new.evidence_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Evidence provenance organization mismatch');
  elsif tg_table_name='thinkforge_assumption_evidence_links' then
    select organization_id into o from public.thinkforge_assumptions where id=new.assumption_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Assumption/evidence assumption organization mismatch');
    select organization_id into o from public.thinkforge_evidence where id=new.evidence_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Assumption/evidence evidence organization mismatch');
  elsif tg_table_name='thinkforge_opportunity_evidence_links' then
    select organization_id into o from public.thinkforge_opportunities where id=new.opportunity_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Opportunity/evidence opportunity organization mismatch');
    select organization_id into o from public.thinkforge_evidence where id=new.evidence_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Opportunity/evidence evidence organization mismatch');
  elsif tg_table_name='thinkforge_solution_assumptions' then
    select organization_id into o from public.thinkforge_solutions where id=new.solution_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Solution/assumption solution organization mismatch');
    select organization_id into o from public.thinkforge_assumptions where id=new.assumption_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Solution/assumption assumption organization mismatch');
  elsif tg_table_name='thinkforge_assumption_experiments' then
    select organization_id into o from public.thinkforge_assumptions where id=new.assumption_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Assumption/experiment assumption organization mismatch');
    select organization_id into o from public.thinkforge_experiments where id=new.experiment_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Assumption/experiment experiment organization mismatch');
  elsif tg_table_name='thinkforge_prediction_outcome_links' then
    select organization_id into o from public.thinkforge_predictions where id=new.prediction_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Prediction/outcome prediction organization mismatch');
    select organization_id into o from public.thinkforge_outcomes where id=new.outcome_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Prediction/outcome outcome organization mismatch');
  elsif tg_table_name='thinkforge_learning_evidence_links' then
    select organization_id into o from public.thinkforge_learnings where id=new.learning_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Learning/evidence learning organization mismatch');
    select organization_id into o from public.thinkforge_evidence where id=new.evidence_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Learning/evidence evidence organization mismatch');
  elsif tg_table_name='thinkforge_decision_learning_links' then
    select organization_id into o from public.thinkforge_decisions where id=new.decision_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Decision/learning decision organization mismatch');
    select organization_id into o from public.thinkforge_learnings where id=new.learning_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Decision/learning learning organization mismatch');
  end if;
  return new;
end $$;

drop trigger if exists trg_tf_claim_evidence_org on public.thinkforge_claim_evidence_links;
create trigger trg_tf_claim_evidence_org before insert or update on public.thinkforge_claim_evidence_links for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_evidence_provenance_org on public.thinkforge_evidence_provenance;
create trigger trg_tf_evidence_provenance_org before insert or update on public.thinkforge_evidence_provenance for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_assumption_evidence_org on public.thinkforge_assumption_evidence_links;
create trigger trg_tf_assumption_evidence_org before insert or update on public.thinkforge_assumption_evidence_links for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_opportunity_evidence_org on public.thinkforge_opportunity_evidence_links;
create trigger trg_tf_opportunity_evidence_org before insert or update on public.thinkforge_opportunity_evidence_links for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_solution_assumption_org on public.thinkforge_solution_assumptions;
create trigger trg_tf_solution_assumption_org before insert or update on public.thinkforge_solution_assumptions for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_assumption_experiment_org on public.thinkforge_assumption_experiments;
create trigger trg_tf_assumption_experiment_org before insert or update on public.thinkforge_assumption_experiments for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_prediction_outcome_org on public.thinkforge_prediction_outcome_links;
create trigger trg_tf_prediction_outcome_org before insert or update on public.thinkforge_prediction_outcome_links for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_learning_evidence_org on public.thinkforge_learning_evidence_links;
create trigger trg_tf_learning_evidence_org before insert or update on public.thinkforge_learning_evidence_links for each row execute function public.thinkforge_guard_graph_link_org();
drop trigger if exists trg_tf_decision_learning_org on public.thinkforge_decision_learning_links;
create trigger trg_tf_decision_learning_org before insert or update on public.thinkforge_decision_learning_links for each row execute function public.thinkforge_guard_graph_link_org();

-- 7. Research lineage integrity.
create or replace function public.thinkforge_guard_research_lineage()
returns trigger language plpgsql security definer set search_path=public as $$
declare o uuid;
begin
  if new.discovery_id is not null then
    select organization_id into o from public.thinkforge_discoveries where id=new.discovery_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Research entity/discovery organization mismatch');
  end if;
  if new.session_id is not null then
    select organization_id into o from public.thinkforge_research_sessions where id=new.session_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Observation/session organization mismatch');
  end if;
  if new.participant_id is not null then
    select organization_id into o from public.thinkforge_research_participants where id=new.participant_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Observation/participant organization mismatch');
  end if;
  return new;
end $$;
drop trigger if exists trg_tf_research_lineage on public.thinkforge_research_observations;
create trigger trg_tf_research_lineage before insert or update on public.thinkforge_research_observations for each row execute function public.thinkforge_guard_research_lineage();

create or replace function public.thinkforge_guard_theme_observation_org()
returns trigger language plpgsql security definer set search_path=public as $$
declare o uuid;
begin
  select organization_id into o from public.thinkforge_research_themes where id=new.theme_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Theme/observation theme organization mismatch');
  select organization_id into o from public.thinkforge_research_observations where id=new.observation_id; perform public.thinkforge_require_same_org(new.organization_id,o,'Theme/observation observation organization mismatch');
  return new;
end $$;
drop trigger if exists trg_tf_theme_observation_org on public.thinkforge_theme_observations;
create trigger trg_tf_theme_observation_org before insert or update on public.thinkforge_theme_observations for each row execute function public.thinkforge_guard_theme_observation_org();

-- 8. Immutable prediction values once locked.
create or replace function public.thinkforge_guard_prediction_lock_v2()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(old.locked_at is not null,false) then
    if row_to_json(new)::jsonb - 'updated_at' - 'updated_by' - 'version' - 'lock_reason' <> row_to_json(old)::jsonb - 'updated_at' - 'updated_by' - 'version' - 'lock_reason' then
      raise exception using errcode='55000',message='Locked prediction is immutable';
    end if;
  end if;
  if old.locked_at is not null and new.locked_at is null then raise exception using errcode='55000',message='Locked prediction cannot be unlocked'; end if;
  return new;
end $$;
drop trigger if exists trg_tf_prediction_lock_v2 on public.thinkforge_predictions;
create trigger trg_tf_prediction_lock_v2 before update on public.thinkforge_predictions for each row execute function public.thinkforge_guard_prediction_lock_v2();

-- 9. Immutable decision snapshot rows: no update/delete through normal client access.
create or replace function public.thinkforge_reject_snapshot_mutation()
returns trigger language plpgsql as $$ begin raise exception using errcode='55000',message='Decision snapshots are immutable'; end $$;
drop trigger if exists trg_tf_snapshot_immutable_update on public.thinkforge_decision_snapshots;
create trigger trg_tf_snapshot_immutable_update before update on public.thinkforge_decision_snapshots for each row execute function public.thinkforge_reject_snapshot_mutation();
drop trigger if exists trg_tf_snapshot_immutable_delete on public.thinkforge_decision_snapshots;
create trigger trg_tf_snapshot_immutable_delete before delete on public.thinkforge_decision_snapshots for each row execute function public.thinkforge_reject_snapshot_mutation();

-- 10. Canonical diagnostic views: discover legacy relationship drift instead of hiding it.
create or replace view public.thinkforge_canonical_integrity_v1 as
select
  d.id as decision_id,
  d.organization_id,
  d.initiative_id,
  d.primary_outcome_id,
  coalesce((select count(*) from public.thinkforge_assumptions a where a.decision_id=d.id and a.archived_at is null),0) as assumptions_count,
  coalesce((select count(*) from public.thinkforge_evidence e where e.decision_id=d.id and e.archived_at is null),0) as evidence_count,
  coalesce((select count(*) from public.thinkforge_predictions p where p.decision_id=d.id and p.archived_at is null),0) as predictions_count,
  coalesce((select count(*) from public.thinkforge_outcomes o where o.decision_id=d.id and o.archived_at is null),0) as outcomes_count,
  coalesce((select count(*) from public.thinkforge_learnings l where l.decision_id=d.id and l.archived_at is null),0) as learnings_count,
  coalesce((select count(*) from public.thinkforge_decision_snapshots s where s.decision_id=d.id),0) as snapshots_count,
  exists(select 1 from public.thinkforge_decision_snapshots s where s.decision_id=d.id and s.decision_version=coalesce(d.version,1)) as has_current_snapshot,
  case when d.organization_id is null then 'LEGACY_OWNER_ONLY' else 'CANONICAL_TENANT' end as tenancy_state
from public.thinkforge_decisions d;

create or replace view public.thinkforge_relationship_drift_v1 as
select 'claim_evidence'::text as relation_kind,count(*) filter (where c.organization_id is distinct from e.organization_id) as mismatch_count from public.thinkforge_claim_evidence_links l join public.thinkforge_claims c on c.id=l.claim_id join public.thinkforge_evidence e on e.id=l.evidence_id
union all
select 'assumption_evidence',count(*) filter (where a.organization_id is distinct from e.organization_id) from public.thinkforge_assumption_evidence_links l join public.thinkforge_assumptions a on a.id=l.assumption_id join public.thinkforge_evidence e on e.id=l.evidence_id
union all
select 'opportunity_evidence',count(*) filter (where o.organization_id is distinct from e.organization_id) from public.thinkforge_opportunity_evidence_links l join public.thinkforge_opportunities o on o.id=l.opportunity_id join public.thinkforge_evidence e on e.id=l.evidence_id;

grant select on public.thinkforge_canonical_integrity_v1 to service_role;
grant select on public.thinkforge_relationship_drift_v1 to service_role;
