# ThinkForge v14.9.3 — Capstone Gold Integration Changelog

## 1. Integrated the supplied confidential capstone gold layer

Copied the complete supplied `ThinkForge_Gold_Layer_v1` package into
`eval/external_gold/capstone_gold_layer_v1/` so the repository can audit the
study artifacts locally and reproducibly. The data remains marked as private
capstone material.

## 2. Added a deterministic Rater-03 normalizer

`FULL150_RATER-03_audited(3).csv` does not contain explicit `case_id` or
`rater_id` columns. `scripts/normalize_capstone_rater3.js` binds rows to the
audited 150-case source using title/source alignment and writes an explicit
normalized file without changing annotation values.

## 3. Added capstone-layer integrity auditing

`scripts/audit_capstone_gold_layer.js` checks case counts, rater counts,
locked-test share, candidate-gold state, placeholder pilot data, prediction
separation, duplicate IDs, and stable input hashes. It does not silently
promote candidate data into final empirical gold.

## 4. Added human reliability reporting for the supplied rater data

`scripts/capstone_reliability_report.js` calculates pairwise agreement and
Cohen's kappa for the categorical dimensions that exist in the supplied rater
schema. This gives descriptive human agreement evidence without inventing
labels or adjudication.

## 5. Removed a gold/prediction integrity weakness

`aggregate_external_gold.js` no longer places ThinkForge predictions inside
the human annotation artifact. The human annotation export is now explicitly
`goldFrozen: false` and the freeze step creates the immutable gold artifact.

## 6. Enforced separate candidate runs

`stage1_empirical_eval.js` now requires a separate candidate-run artifact bound
to the frozen gold version/hash. Embedded predictions are rejected. This makes
the evaluation chain materially harder to contaminate.

## 7. Added candidate-run schema

`eval/external_gold/candidate_run.schema.json` defines the separate ThinkForge
candidate contract.

## 8. Improved research readiness reporting

`research_readiness.js` now reports the supplied capstone layer separately:
150 cases, 450 rater rows, 90 locked cases, and 4 pending adjudications. It
keeps the main empirical-gold gate blocked until a true frozen gold exists.

## 9. Corrected project version/documentation drift

README release text now matches package version `14.9.3` and explicitly
distinguishes the private capstone evidence layer from synthetic simulation and
from final empirical validation.

## 10. Added a reproducible full-project audit

`scripts/full_project_audit.js` and `docs/FULL_PROJECT_AUDIT_LATEST.md` combine
syntax/tests, 15-stage protected-surface checks, engineering readiness, and
capstone gold-layer status in one auditable release check.

## 11. Regression coverage

Added `tests/capstone_gold_layer.test.js` and updated Stage 1 empirical tests
to exercise separate human-gold and candidate-run artifacts.
