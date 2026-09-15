# ThinkForge Stage 4 — Governance Finalization v14.6

## Purpose

This release completes the Stage 4 governance consolidation without changing the Stage 1 or Stage 2 foundations.

## Canonical authority boundary

Runtime governance follows one direction:

`UI → /api/decision-governance → PostgreSQL canonical policy/RPC → transaction + audit`

`/api/decision` is retained only as a compatibility adapter and contains no direct legacy governance calls.

## Readiness

`thinkforge_decision_readiness_v4` is the authoritative readiness evaluator. v1/v2/v3 are forward-compatible adapters only. The canonical evaluator does not call a legacy readiness evaluator.

Readiness separates:

- evidence count
- evidence quality
- segment coverage
- assumption-evidence coverage
- evidence freshness
- critical assumption state
- contradiction state
- option coverage
- prediction/outcome/learning state

## Approval

`APPROVED` is reachable only through the dedicated approval RPC. General transition RPCs return `APPROVAL_ROUTE_REQUIRED` for the approval transition.

Approval requires a server-recorded review. Reviewer identity is taken from the authenticated review record rather than a client-supplied reviewer identifier.

## Version semantics

- `thinkforge_decisions.version`: canonical domain revision.
- `decision_revision`: mirrored canonical domain revision.
- `revision_number`: aggregate material revision, including governed child-graph mutations.
- `state_version`: workflow-transition counter.
- `approved_revision_number`: aggregate revision captured at approval.
- `governance_revision` on snapshots: aggregate decision revision represented by the snapshot.
- `policy_version`: governance rule version.

## Material mutation governance

Material decision inputs are locked for governed states. For approved/executing/observing/learned decisions, changes require explicit reopen rather than silently mutating the governed decision.

Material child mutations in review state record a governance revision and mark the review as requiring reconsideration.

## Transition policy

`thinkforge_decision_transition_policies` is the versioned table-backed transition policy. `thinkforge_decision_transition_policy_v2` reads this table. Application code does not define authoritative transition rules.

## Compatibility

Legacy v1 RPCs remain as forward adapters for compatibility. They delegate to the canonical v4 policy instead of maintaining independent governance semantics.

## Testing

The release includes static consolidation tests and optional live DB integration tests. Live tests require `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and, for fixture-dependent readiness checks, the test user/org/decision IDs.

This release does not claim live DB verification when those credentials are absent.
