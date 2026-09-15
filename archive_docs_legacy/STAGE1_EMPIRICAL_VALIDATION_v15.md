# Stage 1 empirical validation hardening — v15

## What changed
- Added a fail-closed Stage 1 empirical evaluator.
- Added an external-gold manifest for real qualitative studies with public provenance.
- Added explicit minimums for gold cases and independent evaluators.
- Strengthened source diversity using class entropy and publisher concentration.
- Strengthened high-impact human research readiness from one participant to a plan-dependent minimum.
- Added a release-safe empirical gate that never converts synthetic/structural tests into empirical claims.

## External evidence basis
The manifest references real-human qualitative datasets that publish anonymized transcripts and/or researcher-produced thematic analysis, including XAI-FUNGI (39 interview participants with codebook and MAXQDA thematic summary), the Qualitative Interview Corpus (343 transcripts / 16,940 participant responses from 14 real research projects), and TRIPLE (25 qualitative interview transcripts). These are validation inputs, not fabricated gold.

## Verification
- `npm run check` must pass.
- `npm test` must pass.
- `stage1_empirical_eval.js` intentionally exits with a blocked status until real adjudicated gold is imported.

## Empirical claim policy
An empirical Stage 1 score can only be emitted when the imported dataset contains the required number of real gold cases, at least two independent evaluators, and adjudication provenance. No synthetic benchmark is eligible.

## Frozen external-gold build

`npm run gold:external:build` converts a researcher/adjudicator-owned annotation export into `eval/external_gold/stage1_gold.json`. The importer refuses synthetic/model-generated labels, requires three independent evaluators, complete adjudication, three source-study provenance records, 100+ cases, and a frozen gold/codebook version. The generated artifact receives a SHA-256 hash of the source export.

The empirical evaluator continues to fail closed until that frozen artifact exists and satisfies all thresholds. This is deliberate: engineering tests and public dataset metadata cannot be turned into fabricated empirical performance.
