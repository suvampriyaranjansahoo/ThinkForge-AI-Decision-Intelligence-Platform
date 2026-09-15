# ThinkForge Stage 4 — Canonical Governance v3

Stage 4 governance now uses a single authoritative persistence boundary for readiness and authority:

`UI/API -> governance RPC -> PostgreSQL policy -> canonical result`

Application JavaScript remains a **pure preview/compatibility layer only**. It must never be trusted for authorization, approval, or persisted readiness.

## Canonical policy

`thinkforge_decision_governance_policy_v1()` stores the current Stage 4 policy version (`stage4-v3`) and rigor thresholds.

## Canonical authority

`thinkforge_decision_authorize_v1()` is the single action-authorization boundary for view/edit/review/approve/reopen/execute/archive.

## Canonical readiness

`thinkforge_decision_readiness_v2()` computes the persisted governance readiness result from database state and the versioned policy. The API returns this result directly.

## Mutation rules

Approved/active governed decisions are locked. Material edits require an explicit reopen. Governance events are append-only. Every transition carries policy/version context and request metadata.

## Compatibility

`lib/decisionWorkflow.js` delegates to `lib/decisionGovernance.js` for offline preview behavior and only adapts legacy response field names. It contains no independent governance policy.
