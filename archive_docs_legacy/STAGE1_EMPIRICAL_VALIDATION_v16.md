# Stage 1 Empirical Validation v16

## Delivered
- Frozen external-gold schema with explicit provenance, codebook version, dataset hash and adjudication status.
- External-gold builder that refuses synthetic/model-generated labels.
- Minimum 100 cases, 3 independent evaluators, 3 source-study records, and complete Stage 1 dimension coverage.
- Empirical evaluator with per-dimension precision/recall/F1, abstention calibration, deterministic bootstrap 95% intervals, preset thresholds and a fail-closed result state.
- No empirical score is emitted until the frozen external gold artifact exists and satisfies the protocol.

## Why the gate remains blocked in this repository
The repository does not currently contain the required real adjudicated annotation export. Public datasets can be used as source material only where licensing and study semantics permit, and their original researcher coding must be preserved rather than converted into invented ThinkForge labels.

Useful public sources include XAI-FUNGI (39 real interview participants with anonymized transcripts, codebook and MAXQDA thematic summary), the Qualitative Interview Corpus (343 transcripts / 16,940 participant responses from 14 real research projects), and TRIPLE (25 qualitative interview transcripts about user needs for a discovery platform).

## Reproducible procedure
1. Collect legally reusable/anonymized study material.
2. Preserve original study DOI/repository provenance and original researcher codebook.
3. Obtain 3 independent expert labels for the Stage 1 dimensions used in the study.
4. Adjudicate disagreements and freeze the gold + codebook versions.
5. Run `npm run gold:external:build <researcher_export.json> <stage1_gold.json>`.
6. Run `npm run stage1:empirical`.

The empirical gate is intentionally fail-closed. A synthetic benchmark, model-generated participant, or invented annotation can never unlock the empirical claim.
