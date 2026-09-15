# ThinkForge Stage 2 — Canonical Data Model 9.5 Engineering Readiness

## Objective
Make PostgreSQL the canonical relational source of truth for the product decision graph without breaking existing Stage 1 discovery behavior.

## Implemented
- Stable client IDs for all decision-domain entities.
- Organization-aware ownership metadata and indexes.
- Monotonic per-entity version fields plus `updated_at`/`updated_by`.
- Append-only `thinkforge_entity_versions` snapshots for historical reconstruction.
- Transactional `thinkforge_upsert_decision_graph_v2` for atomic graph persistence.
- Optimistic decision-version conflict protection.
- Archive semantics instead of destructive child-row deletion during workspace sync.
- Canonical graph read API.
- Workspace JSON retained as a compatibility cache, while relational rows become the persistence source of truth.
- Stage 1 discovery entities backfilled with organization ownership fields.
- Role-aware membership checks at the canonical write boundary.
- Stable-ID uniqueness indexes across child entity types.
- Regression tests for stable identity, versioning, duplicate detection and bounded graph validation.

## Backward compatibility
The existing `/api/workspace` contract is preserved. It now calls `thinkforge_sync_workspace_v2`, so existing local UI state and expected-version semantics continue to work while persistence moves to the canonical relational writer.

## Data integrity model
`UPSERT` keeps identity stable; updates increment versions; removed graph nodes are archived rather than hard-deleted. Historical snapshots are written to `thinkforge_entity_versions` inside the same database transaction.

## Honest limitation
The migration must be applied to the target Supabase environment before database behavior is live. Repository-level tests validate the contracts and migration shape; they do not substitute for a live Postgres integration test against a deployed Supabase project.


## P0 Data Model Hardening

Migration 016 adds the organization → initiative → outcome → decision hierarchy, explicit claim/evidence/provenance relationships, immutable decision snapshots, and prediction locking while preserving Stage 1/Stage 2 compatibility. See `docs/STAGE2_P0_IMPLEMENTATION.md`.
