# ThinkForge v14.9.5 — Finalize 146-Case Gold Scope

## Change
Finalized Stage 1 empirical gold at 146 cases by explicit study-owner scope decision.

## Scope
- Source corpus: 150 cases
- Frozen Stage 1 gold: 146 cases
- Excluded unavailable cases: CASE-002, CASE-005, CASE-065, CASE-142
- Active pending adjudication: 0 within the finalized scope

## Integrity
The four excluded cases remain preserved in the original capstone source/rater artifacts and in an archived adjudication queue. No human labels, adjudications, outcomes, or model predictions were synthesized for them.

## Evaluation state
The frozen gold is ready for a **separate blinded ThinkForge candidate run**. Empirical performance is still not claimed until such a candidate run is provided and evaluated against the frozen 146-case gold.

## Verification
- npm test: expected 0 failures
- npm run check: PASS
- npm run quality:15-regression: PASS
- npm run capstone:audit: PASS
- npm run capstone:reliability: PASS
- npm run research:readiness: READY_FOR_BLIND_CANDIDATE_EVALUATION
