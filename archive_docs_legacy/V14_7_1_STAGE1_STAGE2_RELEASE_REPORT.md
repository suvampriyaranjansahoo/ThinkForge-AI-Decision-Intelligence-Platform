# ThinkForge v14.7.1 — Stage 1/2 Hardening Release Report

## Scope
This release strengthens Stage 1 (Product Discovery / Research Intelligence) and Stage 2 (Canonical Data Model) while protecting the implementation surfaces of all 15 stages. The changes are additive and preserve prior API/database compatibility adapters.

## Stage 1 improvements
- Strict model-output contract with explicit enums, ranges, stable IDs, evidence-reference allowlisting, and fail-closed validation.
- Claim-level support semantics with deterministic hybrid lexical verification guardrail.
- Separate evidence dimensions for quality, segment breadth, method diversity, source independence, support/contradiction rate, and triangulation confidence.
- Versioned Stage 1 policy (`stage1-v3`) with explicit quality/coverage/triangulation gates.
- Discovery semantic outputs now retain verification metadata and evidence dimensions.

## Stage 2 improvements
- Additive `thinkforge_upsert_discovery_v3` canonical discovery writer.
- Research session/participant/observation canonical persistence with stable client IDs/versioning fields.
- First-class discovery claims and claim/evidence and theme/evidence relationships.
- Relational state remains authoritative; JSON analysis payload remains a compatibility/snapshot layer.
- Live database verifier exposed as `thinkforge_verify_stage1_stage2_live`.
- Relationship/integrity tests retained for existing P0/P1/P2 model behavior.

## Research/evaluation controls
- Frozen 60/60/180 development/validation/test split manifest.
- Research-readiness now checks split freezing in addition to existing qualification/adjudication gates.
- Existing benchmark audit remains honest about 120 template-signature duplicate signals and continues to require expert curation; no synthetic result is presented as human gold.

## Cross-stage protection
The 15-stage regression gate checks that protected implementation surfaces for Stages 1–15 remain present. Full project tests and targeted Stage 1/2 suites were executed after the changes.

## Validation executed
- `npm test`: 151 tests, 146 passed, 0 failed, 5 skipped.
- `npm run check`: PASS.
- `npm run stage1:check`: 19/19 PASS.
- `npm run stage2:check`: 26/26 PASS.
- `npm run quality:15-regression`: PASS.
- `npm run quality:stage-evidence`: all 15 stages at least 9.5 engineering-readiness according to the repository gate.
- `npm run research:readiness`: infrastructure ready for data collection; empirical counts remain zero.
- `npm run benchmark:audit`: PASS with expert-curation recommendation due to template-signature duplication.

## What is NOT yet proven
- Live Supabase/PostgreSQL execution has not been run in this environment because staging credentials/fixtures are not configured. The live DB tests remain skipped until credentials are supplied.
- Migration SQL has not been executed against a PostgreSQL engine in this environment. Static/syntax/unit checks pass.
- Expert human gold, real RAG gold, decision-impact participants, and real outcome records remain zero. Therefore this release does not claim empirical 9.6/9.5 AI quality.

## Target assessment
The implementation target is approximately **Stage 1: 9.6 engineering-readiness** and **Stage 2: 9.5 engineering-readiness**, contingent on live database verification. Empirical research quality remains data-gated.
