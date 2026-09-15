# ThinkForge v8.1 — Human Ground Truth Changelog

## Implemented

- Anchored `tf-rubric-v3` with 1/3/5 behavioral anchors and annotation protocol metadata.
- 30-case pilot requirement before main annotation.
- 60 development / 60 validation / 180 locked-test split for the 300-case benchmark.
- Deterministic per-rater randomized annotation order.
- 5% hidden duplicate presentations for intra-rater consistency checks.
- Presentation IDs so hidden duplicates can be annotated without weakening duplicate-submission protection.
- Claim-level evidence labels: supported, partially supported, unsupported, contradicted, not verifiable.
- Rater confidence capture.
- Weighted and unweighted Cohen's kappa reporting plus disagreement matrices.
- Hidden-duplicate consistency reporting.
- Adjudication-aware gold dataset generation with rater provenance.
- Database migration for annotation provenance, adjudications, and pairwise-study storage.
- Tests for deterministic assignments and hidden-duplicate behavior.

## Explicit non-claims

The software does **not** create expert gold labels by itself. Human annotation, qualification, adjudication, and real evidence collection remain required. Synthetic fixtures are engineering tests only.
