# Stage 11 (AI Evaluation) — Session Note, v14.7.2

## What this session did
Resolved the highest-priority open question flagged for Stage 11 in the continuation brief:

> Does `api/evaluate.js`'s live mode call the same production path as `lib/ai.js`'s
> `callModel()`, or a separate/simplified path?

## What was verified (read the actual files, not the docs)
- `api/ai.js` (the real user-facing AI endpoint) imports `callModel` via
  `const { callModel } = require('../lib/ai');` and calls it directly with no wrapper.
- `api/evaluate.js`'s live branch (`mode !== 'offline'`) imports and calls the exact same
  `callModel` from the exact same module, with no intermediate mock, simplified re-implementation,
  or separate "eval-only" code path.
- **Conclusion: CONFIRMED, not INFERRED.** Live-mode evaluation results reflect the real
  production model-calling path (same prompts, same schema validation via `lib/contracts.js`,
  same circuit breaker, same retry/repair logic, same cost/budget checks). There is no separate
  simplified path that could silently diverge from what real users experience.
- Offline mode (the default) never calls `callModel` at all — confirmed by reading the branch;
  it returns a `not_run` status per case with an explicit "does not fabricate AI quality scores"
  reason string. This was already honest; now it's covered by a regression test instead of just
  being true by inspection.
- On execution failure in live mode (schema validation failure, business-rule failure, provider
  error, etc.), `api/evaluate.js` already reported `status: 'failed_execution'` with the real
  error message, and never fabricated a `goldScores` or `researchQualityScore` value in that case.
  This was correct behavior already present in the code — this session added a test that locks
  it in and would fail loudly if a future change tried to paper over a broken model layer with a
  placeholder score.

## What changed
- **No production code changed.** This session's finding was that Stage 11's flagged risk does
  not currently exist in the code — the two paths were already unified and failures were already
  surfaced honestly. Per the operating rules ("verify by reading the actual file," "don't inflate
  scores," "don't rewrite something that already works"), the correct action was to add proof,
  not to "fix" something that isn't broken.
- Added `tests/stage11_ai_evaluation_integrity.test.js` (3 new `node:test` tests):
  1. Source-level check that both `api/ai.js` and `api/evaluate.js` destructure `callModel` from
     the identical `../lib/ai` module — guards against a future refactor quietly forking the path.
  2. Source-level check that the offline-mode branch never references `callModel`.
  3. Behavioral test: stubs `lib/auth` (to reach live mode without a real Supabase session) and
     `lib/ai` (to force an `AI_SCHEMA_INVALID`-style failure, the same shape a real schema
     validation failure produces), leaves rate limiting/security/contracts/scoring modules real,
     invokes the actual `api/evaluate.js` handler, and asserts: `researchQualityScore` stays
     `null`, `researchQualityClaimAllowed` stays `false`, the case is reported as
     `failed_execution` with the real error message, and no `goldScores` field is fabricated.

## Test counts (verified this session)
- Before: `npm run check` — 49/49 files pass. `npm test` — 155 tests, 150 pass, 5 skipped
  (DB-integration tests that require a live database), 0 fail.
- After: `npm run check` — 49/49 files pass (unchanged, new test file doesn't need to be in the
  check list since `npm test` runs `tests/*.test.js` directly via glob). `npm test` — 158 tests,
  153 pass, 5 skipped (same DB-integration skips), 0 fail. Net +3 tests, all passing, no
  regressions.

## Rating update
- **Stage 11 — AI Evaluation: 7.5, VERIFIED** (up from 7.0, NOT YET VERIFIED).
  Justification: the one open structural question blocking a higher confidence rating is now
  resolved with evidence (source read + passing behavioral test), not inference. Rating stays
  below 8 because the underlying gold-label set (`eval/benchmark_300.json`) is still
  template-generated/synthetic for most cases, not expert-labeled at scale — that's a data
  problem, not a code-path problem, and is unchanged by this session's work.

## What's still NOT empirically validated
- The quality of AI outputs themselves against real expert-labeled gold data — untouched by this
  session, and explicitly out of scope (would require real annotation work, not code changes).
- Whether the circuit breaker, retry, and repair logic in `lib/ai.js` behave correctly against a
  *real* flaky provider (this session's test simulates the failure at the `callModel` boundary,
  it does not exercise `rawCall`'s internal retry/circuit logic against a real or mocked HTTP
  provider). That remains a candidate for a future session if it becomes a priority.
