# ThinkForge v13.3 — Reasoning + Canonical Write-Path Fix

## Changes
- Added dedicated claim-level `reasoning` AI contract and prompt.
- Added structured reasoning context with candidate evidence ranking.
- Added post-LLM claim verification guardrails and explicit abstention when evidence is absent.
- Added reasoning benchmark seed covering support, contradiction, insufficiency, causal overreach and stale-evidence failure modes.
- Empirical reasoning evaluation is fail-closed until independent/adjudicated human gold exists.
- Added `lib/domainRepository.js` as the persistence facade for canonical domain writes.
- `/api/workspace` now writes through `thinkforge_sync_workspace_v3`.
- `/api/discovery` now writes through `thinkforge_upsert_discovery_v1` instead of direct table writes.
- Workspace relational graph is written before the JSON compatibility cache is refreshed, in the same database transaction.
- Discovery research evidence now supports stable UI/client IDs separately from UUID primary keys.
- Added migration 019 and mirrored it under `supabase/` and `db/migrations/`.
- Preserved all prior P0/P1/P2 migrations and existing APIs for compatibility.

## Verification
- 76/76 tests pass.
- JS syntax check passes.
- Stage 2 quality checks pass.
- P1/P2 checks pass.
- 15-stage engineering-readiness gate passes (all >= 9.5).
- Stage-evidence audit passes.
- Research protocol audit passes with 0 errors/0 warnings.
- Study validation passes.
- Benchmark audit passes.

## Honest limitations
- Human gold is not present yet, so reasoning empirical quality remains blocked by design.
- The new claim verifier is a deterministic guardrail, not a proof of semantic entailment. Production-grade semantic verification should use a validated entailment/contradiction model and human benchmark results.
- Live Supabase migration execution/rehearsal was not available in this environment.
- RAG and outcome empirical claims remain data-gated.
