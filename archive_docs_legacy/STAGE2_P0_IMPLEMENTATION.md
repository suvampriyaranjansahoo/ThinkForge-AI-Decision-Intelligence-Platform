# ThinkForge Stage 2 — P0 Data Model Hardening

## Purpose

P0 changes preserve the existing Stage 1/Stage 2 behavior while making the canonical domain model capable of reconstructing decision context and preserving evidence lineage.

## P0 deliverables

1. **Organization → initiative → outcome → decision hierarchy**
   - `thinkforge_initiatives`
   - `thinkforge_product_outcomes`
   - `thinkforge_decisions.initiative_id`
   - `thinkforge_decisions.primary_outcome_id`

2. **Explicit claim/evidence/provenance graph**
   - `thinkforge_claims`
   - `thinkforge_claim_evidence_links`
   - `thinkforge_evidence_provenance`

3. **Explicit cross-domain relationships**
   - assumption ↔ evidence
   - opportunity ↔ evidence
   - solution ↔ assumption
   - assumption ↔ experiment
   - prediction ↔ outcome
   - learning ↔ evidence
   - decision ↔ learning

4. **Immutable decision snapshots**
   - `thinkforge_decision_snapshots`
   - `thinkforge_create_decision_snapshot_v1`
   - snapshot hash for integrity verification

5. **Prediction locking**
   - `locked_by`, `lock_reason`
   - trigger blocks mutation of measured prediction fields after lock
   - `thinkforge_lock_prediction_v1`

6. **Tenant protection**
   - every new relational object carries `organization_id`
   - RLS uses the canonical organization membership helper

## Compatibility rule

The legacy JSON workspace remains supported as a compatibility/cache path. No Stage 1 discovery entity is removed or renamed. The new P0 graph is additive and can be populated incrementally.

## API additions

`POST /api/domain` now accepts:

- `action: snapshot`
- `action: lock_prediction`

Both operations require authenticated organization membership and return request IDs for audit correlation.
