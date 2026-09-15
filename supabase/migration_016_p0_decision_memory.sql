-- ThinkForge P0 Data Model hardening.
-- Additive migration: preserves existing Stage 1/Stage 2 data and APIs.
-- Goals: product hierarchy, first-class outcomes, explicit evidence graph,
-- immutable decision snapshots, and prediction locking.

create extension if not exists pgcrypto;

-- 1. Product hierarchy: organization -> initiative -> desired outcome -> decision.
create table if not exists public.thinkforge_initiatives(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check(status in ('active','paused','completed','archived')),
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_initiatives_org on public.thinkforge_initiatives(organization_id,updated_at desc);

create table if not exists public.thinkforge_product_outcomes(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  initiative_id uuid references public.thinkforge_initiatives(id) on delete set null,
  name text not null,
  description text,
  metric_name text not null,
  baseline numeric,
  target numeric,
  unit text,
  timeframe_start timestamptz,
  timeframe_end timestamptz,
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check(status in ('draft','active','achieved','missed','retired')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_product_outcomes_org on public.thinkforge_product_outcomes(organization_id,updated_at desc);

alter table public.thinkforge_decisions add column if not exists initiative_id uuid references public.thinkforge_initiatives(id) on delete set null;
alter table public.thinkforge_decisions add column if not exists primary_outcome_id uuid references public.thinkforge_product_outcomes(id) on delete set null;
alter table public.thinkforge_decisions add column if not exists decision_type text;
alter table public.thinkforge_decisions add column if not exists reversibility text;
alter table public.thinkforge_decisions add column if not exists cost_of_delay numeric;
alter table public.thinkforge_decisions add column if not exists deadline_at timestamptz;
alter table public.thinkforge_decisions add column if not exists owner_id uuid references auth.users(id) on delete set null;

-- 2. Explicit claim/evidence/provenance graph.
create table if not exists public.thinkforge_claims(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid references public.thinkforge_decisions(id) on delete set null,
  claim_type text not null default 'research' check(claim_type in ('research','ai','product','metric','hypothesis','other')),
  text text not null,
  status text not null default 'active' check(status in ('active','superseded','rejected','archived')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tf_claims_org_decision on public.thinkforge_claims(organization_id,decision_id,created_at desc);

create table if not exists public.thinkforge_claim_evidence_links(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  claim_id uuid not null references public.thinkforge_claims(id) on delete cascade,
  evidence_id uuid not null references public.thinkforge_evidence(id) on delete cascade,
  relationship text not null check(relationship in ('supports','partially_supports','contradicts','contextualizes','insufficient')),
  confidence numeric(5,4) check(confidence between 0 and 1),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(claim_id,evidence_id)
);
create index if not exists idx_tf_claim_evidence_org on public.thinkforge_claim_evidence_links(organization_id,evidence_id);

create table if not exists public.thinkforge_evidence_provenance(
  evidence_id uuid primary key references public.thinkforge_evidence(id) on delete cascade,
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  source_kind text not null check(source_kind in ('interview','survey','analytics','support','document','experiment','market','manual','other')),
  source_id text,
  research_session_id uuid,
  participant_id text,
  collected_at timestamptz,
  locator text,
  collector_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Critical relationship tables. These keep graph semantics queryable and stable.
create table if not exists public.thinkforge_assumption_evidence_links(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  assumption_id uuid not null references public.thinkforge_assumptions(id) on delete cascade,
  evidence_id uuid not null references public.thinkforge_evidence(id) on delete cascade,
  relationship text not null check(relationship in ('supports','contradicts','contextualizes','insufficient')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(assumption_id,evidence_id)
);

create table if not exists public.thinkforge_opportunity_evidence_links(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  opportunity_id uuid not null references public.thinkforge_opportunities(id) on delete cascade,
  evidence_id uuid not null references public.thinkforge_evidence(id) on delete cascade,
  relationship text not null default 'supports' check(relationship in ('supports','contradicts','contextualizes','insufficient')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(opportunity_id,evidence_id)
);

create table if not exists public.thinkforge_solution_assumptions(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  solution_id uuid not null,
  assumption_id uuid not null references public.thinkforge_assumptions(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(solution_id,assumption_id)
);

create table if not exists public.thinkforge_assumption_experiments(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  assumption_id uuid not null references public.thinkforge_assumptions(id) on delete cascade,
  experiment_id uuid not null references public.thinkforge_experiments(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(assumption_id,experiment_id)
);

create table if not exists public.thinkforge_prediction_outcome_links(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  prediction_id uuid not null references public.thinkforge_predictions(id) on delete cascade,
  outcome_id uuid not null references public.thinkforge_outcomes(id) on delete cascade,
  metric_name text,
  measurement_window_start timestamptz,
  measurement_window_end timestamptz,
  created_at timestamptz not null default now(),
  primary key(prediction_id,outcome_id)
);

create table if not exists public.thinkforge_learning_evidence_links(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  learning_id uuid not null references public.thinkforge_learnings(id) on delete cascade,
  evidence_id uuid not null references public.thinkforge_evidence(id) on delete cascade,
  relationship text not null default 'supports' check(relationship in ('supports','contradicts','contextualizes','insufficient')),
  created_at timestamptz not null default now(),
  primary key(learning_id,evidence_id)
);

create table if not exists public.thinkforge_decision_learning_links(
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  learning_id uuid not null references public.thinkforge_learnings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(decision_id,learning_id)
);

-- 4. First-class decision snapshots: reconstruct the decision exactly as known at the time.
create table if not exists public.thinkforge_decision_snapshots(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.thinkforge_organizations(id) on delete cascade,
  decision_id uuid not null references public.thinkforge_decisions(id) on delete cascade,
  decision_version bigint not null,
  snapshot jsonb not null,
  snapshot_hash text not null,
  reason text not null default 'decision_state_capture',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(decision_id,decision_version)
);
create index if not exists idx_tf_decision_snapshots_lookup on public.thinkforge_decision_snapshots(organization_id,decision_id,decision_version desc);

-- 5. Strengthen prediction integrity. A locked prediction may not change its measured fields.
alter table public.thinkforge_predictions add column if not exists locked_by uuid references auth.users(id) on delete set null;
alter table public.thinkforge_predictions add column if not exists lock_reason text;

create or replace function public.thinkforge_guard_locked_prediction()
returns trigger language plpgsql as $$
begin
  if old.locked_at is not null then
    if new.locked_at is distinct from old.locked_at
       or new.locked_by is distinct from old.locked_by
       or new.lock_reason is distinct from old.lock_reason
       or new.decision_id is distinct from old.decision_id
       or new.metric is distinct from old.metric
       or new.prediction_type is distinct from old.prediction_type
       or new.predicted_value is distinct from old.predicted_value
       or new.lower_bound is distinct from old.lower_bound
       or new.upper_bound is distinct from old.upper_bound
       or new.probability is distinct from old.probability
       or new.client_id is distinct from old.client_id then
      raise exception using errcode='55000', message='Locked prediction is immutable';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_tf_locked_prediction on public.thinkforge_predictions;
create trigger trg_tf_locked_prediction before update on public.thinkforge_predictions for each row execute function public.thinkforge_guard_locked_prediction();

create or replace function public.thinkforge_lock_prediction_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_prediction_id uuid,
  p_request_id text default null,
  p_reason text default 'decision_prediction_lock'
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.thinkforge_predictions%rowtype;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'editor');
  select * into p from public.thinkforge_predictions where id=p_prediction_id and organization_id=p_organization_id for update;
  if p.id is null then raise exception using errcode='P0002',message='Prediction not found'; end if;
  if p.locked_at is not null then
    return jsonb_build_object('predictionId',p.id,'lockedAt',p.locked_at,'version',p.version,'alreadyLocked',true);
  end if;
  update public.thinkforge_predictions set locked_at=now(),locked_by=p_user_id,lock_reason=p_reason,version=p.version+1,updated_at=now(),updated_by=p_user_id where id=p.id;
  insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id)
  select p_organization_id,p_user_id,'prediction',q.id,q.version,'LOCK',to_jsonb(q),p_request_id
  from public.thinkforge_predictions q where q.id=p.id;
  return (select jsonb_build_object('predictionId',q.id,'lockedAt',q.locked_at,'version',q.version,'alreadyLocked',false) from public.thinkforge_predictions q where q.id=p.id);
end $$;

-- 6. Snapshot writer captures the complete decision graph in one transaction.
create or replace function public.thinkforge_create_decision_snapshot_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_decision_id uuid,
  p_reason text default 'decision_state_capture',
  p_request_id text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d public.thinkforge_decisions%rowtype;
s jsonb;
h text;
sid uuid;
begin
  perform public.thinkforge_require_membership(p_user_id,p_organization_id,'viewer');
  select * into d from public.thinkforge_decisions where id=p_decision_id and organization_id=p_organization_id and deleted_at is null for share;
  if d.id is null then raise exception using errcode='P0002',message='Decision not found'; end if;
  s:=jsonb_build_object(
    'decision',to_jsonb(d),
    'assumptions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_assumptions q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_evidence q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'challenges',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_challenges q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'alternatives',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_alternatives q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'experiments',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_experiments q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'predictions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_predictions q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'outcomes',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_outcomes q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb),
    'learnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.thinkforge_learnings q where q.decision_id=d.id and q.organization_id=p_organization_id and q.archived_at is null),'[]'::jsonb)
  );
  h:=encode(digest(s::text,'sha256'),'hex');
  insert into public.thinkforge_decision_snapshots(organization_id,decision_id,decision_version,snapshot,snapshot_hash,reason,created_by)
  values(p_organization_id,d.id,coalesce(d.version,1),s,h,p_reason,p_user_id)
  on conflict(decision_id,decision_version) do nothing;
  select id into sid from public.thinkforge_decision_snapshots where decision_id=d.id and decision_version=coalesce(d.version,1);
  insert into public.thinkforge_entity_versions(organization_id,user_id,entity_type,entity_id,version,operation,snapshot,request_id)
  values(p_organization_id,p_user_id,'decision_snapshot',sid,coalesce(d.version,1),'SNAPSHOT',s,p_request_id);
  return jsonb_build_object('snapshotId',sid,'decisionId',d.id,'decisionVersion',coalesce(d.version,1),'snapshotHash',h);
end $$;

-- 7. First-class outcome query view linking product outcomes to decisions.
create or replace view public.thinkforge_decision_outcome_context as
select d.id as decision_id,
       d.organization_id,
       d.initiative_id,
       d.primary_outcome_id as outcome_id,
       o.name as outcome_name,
       o.metric_name,
       o.baseline,
       o.target,
       o.timeframe_start,
       o.timeframe_end,
       o.status as outcome_status
from public.thinkforge_decisions d
left join public.thinkforge_product_outcomes o on o.id=d.primary_outcome_id and o.organization_id=d.organization_id;

-- 8. RLS. Organization access is always checked through the canonical membership helper.
alter table public.thinkforge_initiatives enable row level security;
alter table public.thinkforge_product_outcomes enable row level security;
alter table public.thinkforge_claims enable row level security;
alter table public.thinkforge_claim_evidence_links enable row level security;
alter table public.thinkforge_evidence_provenance enable row level security;
alter table public.thinkforge_assumption_evidence_links enable row level security;
alter table public.thinkforge_opportunity_evidence_links enable row level security;
alter table public.thinkforge_solution_assumptions enable row level security;
alter table public.thinkforge_assumption_experiments enable row level security;
alter table public.thinkforge_prediction_outcome_links enable row level security;
alter table public.thinkforge_learning_evidence_links enable row level security;
alter table public.thinkforge_decision_learning_links enable row level security;
alter table public.thinkforge_decision_snapshots enable row level security;

create policy tf_initiatives_org on public.thinkforge_initiatives for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_product_outcomes_org on public.thinkforge_product_outcomes for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_claims_org on public.thinkforge_claims for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_claim_evidence_org on public.thinkforge_claim_evidence_links for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_evidence_provenance_org on public.thinkforge_evidence_provenance for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_assumption_evidence_org on public.thinkforge_assumption_evidence_links for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_opportunity_evidence_org on public.thinkforge_opportunity_evidence_links for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_solution_assumptions_org on public.thinkforge_solution_assumptions for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_assumption_experiments_org on public.thinkforge_assumption_experiments for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_prediction_outcome_org on public.thinkforge_prediction_outcome_links for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_learning_evidence_org on public.thinkforge_learning_evidence_links for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_decision_learning_org on public.thinkforge_decision_learning_links for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));
create policy tf_decision_snapshots_org on public.thinkforge_decision_snapshots for all using(public.thinkforge_has_org_role(organization_id,'viewer')) with check(public.thinkforge_has_org_role(organization_id,'editor'));

grant execute on function public.thinkforge_lock_prediction_v1(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.thinkforge_create_decision_snapshot_v1(uuid,uuid,uuid,text,text) to service_role;

