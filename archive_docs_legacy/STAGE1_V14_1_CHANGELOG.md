# ThinkForge v14.1 — Stage 1 Upgrade Changelog

## Scope
Upgrades Stage 1 Product Concept + Discovery and makes its outputs directly consumable by downstream decision, assumption and experiment workflows.

## Changes
- Added detailed research-question understanding with decision-impact classification.
- Added scored method-fit reasoning with recommended alternatives and tradeoffs.
- Added multidimensional evidence-quality scoring: source reliability, recency, directness, sample adequacy, provenance completeness and source confidence.
- Added typed evidence requirements and explicit evidence-gap detection.
- Expanded semantic/rule-assisted coding and theme synthesis with evidence lineage.
- Added contextual contradiction detection with mandatory human-review signal.
- Added triangulation metrics for method diversity, independent source count and convergence state.
- Reworked opportunity confidence to incorporate evidence quality, theme support, coverage, contradictions and gaps.
- Added reusable opportunity-derived assumptions and multiple solution paths.
- Added lowest-cost experiment seeds for leap-of-faith assumptions.
- Added downstream decision seed and promotion path in the Stage 1 UI.
- Added canonical discovery persistence v2 with first-class materialization of research codes, themes, opportunities and solutions.
- Added `analysis_version` and `analysis_payload` to canonical discoveries for replay/audit metadata.

## Regression status
- Full test suite: 80/80 passed.
- JavaScript syntax checks: passed.
- Stage 1 checks: 9/9 passed.
- Stage 2 data-model checks: passed.
- P1 data-model checks: passed.
- P2 data-model checks: passed.
- Stage evidence readiness audit: passed.

## Honest limitation
The Stage 1 semantic layer remains deterministic/rule-assisted. This release does not claim empirical human-level semantic coding performance. Research-grade performance claims remain gated on expert gold annotations, locked evaluation sets and baseline comparisons.

## Deployment
Apply `db/migrations/020_stage1_downstream_materialization.sql` (and the mirrored `supabase/migration_020_stage1_downstream_materialization.sql`) after the existing migrations through 019.
