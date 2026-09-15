# ThinkForge v14.9.4 — Capstone Gold-Scope Consistency Fix

## Fixed

- Rebuilt `eval/external_gold/stage1_gold.json` from the full 146 confirmed capstone records instead of the accidental 136-case subset.
- The frozen artifact now contains exactly **146 confirmed cases**.
- The four pending cases remain excluded and are explicitly recorded in `scope.excludedPendingCaseIds`.
- Added scope metadata tying the frozen artifact to the 150-case source bank, 146 confirmed cases, 4 pending cases, and 146 included cases.
- Preserved ten documented-prior-adjudication cases that lack person-level adjudicator IDs without fabricating identities. Their provenance points to the supplied `confirmed_gold_eligible.json` artifact.
- Strengthened the capstone audit to verify that frozen gold is exactly the confirmed subset and excludes only pending cases.
- Strengthened Rater-03 integrity checking by using the normalized 150-row file for case-set comparison.
- Changed research readiness wording to `READY_FOR_BLIND_CANDIDATE_EVALUATION`, which accurately describes the state when frozen gold exists but a separate candidate run does not.
- Changed the Stage 1 evaluator's failure status to `BLOCKED_UNTIL_SEPARATE_CANDIDATE_RUN` when gold exists but candidate predictions have not been supplied.
- Added the frozen-gold dataset hash to the final gold artifact so future candidate runs can be version-bound to the exact gold bytes.
- Added regression tests covering the 150 → 146 → 4 scope split and documented-prior-adjudication handling.

## Intentionally still blocked

- Four cases still require genuine human adjudication in the capstone layer.
- The supplied pilot raw annotation artifact still contains placeholder values, so pilot completion remains `NOT_EVIDENCED`.
- No empirical performance result is claimed until a separate, blind ThinkForge candidate run is supplied.
