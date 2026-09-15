# ThinkForge Stage 3 UX Hardening — v15

## Goal
Apply the Stage 3 UI/UX acceptance criteria without changing protected Stage 1–15 domain behavior or replacing the existing visual language.

## Applied
- Decision-centric reasoning lineage: Evidence → Assumption → Challenge → Opportunity → Experiment → Outcome.
- First-class Opportunity → Solution Tree surface with evidence/importance metadata.
- Responsive shell improvements for tablet and mobile, including access to advanced tools and system actions.
- Consistent touch targets, focus states, reduced-motion behavior, forced-colors safeguards, and sticky decision journey.
- Web Vitals instrumentation for LCP, CLS, and INP; telemetry failures are non-blocking.
- UX metric boundary for view renders and performance signals.
- Component extraction for new Stage 3 UX surfaces rather than enlarging `app.js` further.

## Regression policy
No protected Stage 1–15 implementation surface was removed or replaced. Run the existing test suite and `npm run quality:15-regression` before release.

## Evidence boundary
This release does **not** claim empirical usability validation, real browser execution, or visual baseline approval. Those require an actual browser/device environment and human participants. The repository now contains the UX implementation and instrumentation needed to perform those validations without pretending they occurred.
