# Stage 2 P0 Strict Verification

## Scope

P0 hardens the canonical data model without removing or renaming any existing Stage 1/Stage 2 domain objects.

## Implemented

- Organization → initiative → desired product outcome → decision hierarchy.
- Explicit claim/evidence and evidence-provenance tables.
- Explicit assumption/evidence, opportunity/evidence, solution/assumption, assumption/experiment, prediction/outcome, learning/evidence, and decision/learning relationships.
- Immutable, version-keyed decision snapshots with SHA-256 hashes.
- Prediction locking with a database trigger that prevents changing the locked measurement fields or unlocking a locked prediction.
- Authenticated API operations for snapshot creation and prediction locking.
- Organization-scoped RLS policies for every new table.

## Compatibility protections

- Existing Stage 1 discovery tables remain intact.
- Existing `/api/domain` `save` and `read` actions remain unchanged.
- Existing `/api/workspace` compatibility sync remains available.
- Existing tests and stage gates were rerun after the P0 changes.

## Evidence level

This verification proves implementation/static and regression behavior in the repository. It does not prove a live Supabase deployment has executed migration 016. Live database verification remains a deployment-stage gate.
