# Stage 1 v14.9.1 — Deep Research Hardening

## Scope
This release hardens Stage 1 only. No Stage 2–15 business logic was intentionally changed.

## Implemented
- 60-source deep-research target with 40-source minimum safety floor.
- Multi-query deep web sweep expanded to source-class and segment-specific queries.
- Provider source-class propagation rather than defaulting all live results to `other`.
- Source normalization with canonical URL keys, publisher keys, topic terms, quality dimensions, and provenance.
- Duplicate detection plus a separate related-content signal so similar reporting is visible without silently collapsing distinct URLs.
- Publisher diversity measurement in addition to source-class diversity.
- Human evidence now requires participant, segment, method, source/session provenance, and explicit consent before it can be used for empirical claims.
- Synthetic human responses remain explicitly labelled and excluded from empirical synthesis.
- Rolling-window research-saturation logic now uses source topic terms when explicit themes are unavailable.
- Deep-research readiness requires the 60-source target, publisher diversity, minimum quality, contradiction safety, and (for high-impact plans) real human evidence.
- Regression tests cover source-class propagation, consent/provenance gating, saturation metadata, and question-quality controls.

## Verification
- `npm run check` — PASS
- `npm test` — 197 tests, 192 passed, 0 failed, 5 skipped
- `npm run quality:15stage` — all 15 stages 9.5 engineering-ready
- `npm run quality:stage-evidence` — PASS
- `npm run quality:15-regression` — PASS

## Honest validation boundary
The 60-source protocol and all controls above are engineering capabilities, not empirical proof that discovery outputs are correct. Real expert-labelled discovery cases remain required before claiming empirical discovery accuracy.
