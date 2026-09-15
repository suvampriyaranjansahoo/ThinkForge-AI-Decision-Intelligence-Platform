# Stages 11/12/13 — Session Note, v14.7.3

## Scope of this session
Implemented the three-stage plan from the prior chat: Stage 13 (RAG), Stage 12 (LLMOps/Analytics),
Stage 11 (AI Evaluation). Each stage's changes are isolated to its own files; no shared file
(`app.js`, `lib/ai.js`, `api/ai.js`, `lib/contracts.js`) was modified for structural behavior.

## Baseline (verified before any edit)
`npm run check`: 49/49 files pass. `npm test`: 155 tests, 150 pass, 5 skipped (DB-integration,
needs a live database — unchanged all session), 0 fail.

## Final (verified after all edits)
`npm run check`: 50/50 files pass (one new file, `scripts/telemetry_health_check.js`, added to the
check chain). `npm test`: 168 tests, 163 pass, 5 skipped (same DB-integration skips), 0 fail.
**Net: +13 tests, all passing, 0 regressions.**

---

## Stage 13 — RAG (`api/rag.js`, `lib/ragMetrics.js`, `scripts/eval_rag.js`)

**Fixed:**
1. **Dedup was prefix-based and wrong on both sides.** `rerank()` compared only
   `text.slice(0,80)`. Two chunks with identical bodies but different openings passed through as
   distinct; two chunks with identical openings but diverging bodies got wrongly merged. Replaced
   with real near-duplicate detection: 5-word shingles + Jaccard similarity, threshold configurable
   via `RAG_DEDUP_JACCARD_THRESHOLD` (default 0.8).
2. **No fallback when no embedding provider is configured.** `search` previously hard-503'd
   (`EMBEDDING_NOT_CONFIGURED`) with no `AI_API_KEY`, unlike Assumptions/Discovery, which already
   have deterministic non-AI fallbacks. Added `lexicalOnlyCandidates()`: when embeddings aren't
   available, retrieval degrades to lexical-only ranking instead of failing outright. Every such
   response is explicitly labeled `degraded:true` and `strategy:'lexical-only (embedding model not
   configured)'` so no caller can mistake it for hybrid-quality retrieval.
3. Added `averagePrecision()` (MAP) to `lib/ragMetrics.js`, wired into `aggregate()` as a new
   `map10` field and into `scripts/eval_rag.js`'s per-case computation. MAP rewards ranking
   relevant chunks near the top, which plain recall doesn't capture. This is a metrics-quality
   improvement only — it does not touch or fabricate the underlying gold-label problem
   (`eval/rag_benchmark_synthetic.json` is still synthetic; that's a data problem, not fixed here).

**Verified isolation:** internal helpers exposed via `module.exports._internal` on the handler
(still a single callable function — Vercel routing is unaffected). No existing test referenced
`api/rag.js` before this session (confirmed by grep), so nothing could have silently broken
downstream from these edits; the existing `tests/rag_metrics.test.js` (pre-dating this session)
still passes unmodified.

**Tests added:** `tests/stage13_rag_enhancements.test.js` (7 tests) — near-duplicate rejection,
correct retention of genuinely-distinct-but-similarly-opening chunks, jaccard/shingle edge cases,
end-to-end lexical-only fallback behavior (stubbed DB, real handler), MAP ranking behavior,
additive `aggregate()` field.

---

## Stage 12 — LLMOps/Analytics (`lib/aiTelemetry.js`, `lib/llmOps.js`, `scripts/telemetry_health_check.js`)

**Fixed:**
1. **Silent telemetry loss.** `recordInteraction()`'s `catch{}` swallowed every write failure with
   no trace. Now failures are counted (`telemetryHealth()` exposes `writeFailures`,
   `lastFailureAt`, `lastSuccessAt`) and logged via `console.error`. The core guarantee is fully
   preserved: `recordInteraction()` still never throws, so an AI response can never fail because
   telemetry is down — the only change is that failure stops being invisible.
   **Caveat, stated honestly:** this in-memory counter is per-serverless-instance and won't
   survive a cold start, so it's a best-effort local signal, not a durable metric. The durable
   mechanism is (2) below.
2. Added `scripts/telemetry_health_check.js` — the exact enhancement the prior continuation brief
   named for this stage. Queries the most recent `thinkforge_ai_interactions` row via Supabase
   REST and reports `STALE` if the gap since the last write exceeds `TELEMETRY_STALE_MINUTES`
   (default 60). Reports `BLOCKED` (not a fabricated `PASS`) when credentials are missing or the
   table has zero rows — an empty table isn't proof of health, it's proof of no data.
3. Added `byModelDetail` to `aggregateTraces()` in `lib/llmOps.js`: per-model cost/latency/error
   breakdown, mirroring the existing `byModule` shape. **Purely additive** — the pre-existing
   `byModel` field (plain list of model names) is untouched byte-for-byte, since nothing outside
   this file reads it today but there was no reason to risk a shape change on it.

**Verified isolation:** grepped the whole repo (including `frontend/`) for `byModel` usage before
touching it — zero consumers outside `lib/llmOps.js` itself. The two pre-existing tests that
exercise `aggregateTraces()` (`tests/research_quality.test.js`,
`tests/stage1_stage2_hardening.test.js`) were re-run and pass unmodified.

**Tests added:** `tests/stage12_llmops_telemetry.test.js` (3 tests) — additive `byModelDetail`
correctness alongside untouched `byModel`/`byModule`, telemetry failure observability (stubbed DB
failure, real `aiTelemetry.js`, asserts non-throwing + logged + counted), and the health-check
script's honest `BLOCKED` behavior with no credentials.

---

## Stage 11 — AI Evaluation (`api/evaluate.js`)

Building on last session's finding (live mode already shares the exact production `callModel`
path with `api/ai.js`, and already fails loudly rather than fabricating scores):

1. Added `contractPassRateByModule` — a real per-module breakdown of the pass rate that was
   already being aggregated into one overall number. Computed from the same executed results,
   nothing new measured or claimed; it just stops a weak module from hiding inside a
   healthy-looking average.
2. Added `runTelemetry` — the run's own per-case `meta` (already produced by `callModel`, already
   present in each result) is now also fed through Stage 12's `aggregateTraces()`, giving p50/p95
   latency and total/average cost for the eval run itself. This is a genuine Stage 11 ↔ Stage 12
   integration, not new functionality invented from nothing.

**What did NOT change and why:** no attempt was made to produce a real `researchQualityScore` —
`eval/benchmark_300.json` still has **zero** expert-labeled cases (verified this session:
`annotation_status==='gold'` count is 0 across all 300 cases), so any such score would be
fabricated. `researchQualityScore` stays `null` and `researchQualityClaimAllowed` stays `false`,
exactly as before.

**Tests added:** extended `tests/stage11_ai_evaluation_integrity.test.js` with one new test (now
4 total) — stubs `lib/auth`, `lib/ai` (deterministic success), and `lib/contracts` to isolate this
from unrelated schema/business-rule logic, runs the real handler, and asserts
`contractPassRateByModule` and `runTelemetry` are populated correctly from the stubbed run.

---

## Rating updates
- **Stage 13 — RAG: 7.8, VERIFIED** (up from 7.5). Justification: two real correctness/robustness
  issues (dedup, no-embedding hard failure) fixed and regression-tested; MAP metric added. Still
  capped below 8: the underlying gold-label set remains synthetic, which no code change here can
  fix.
- **Stage 12 — LLMOps/Analytics: 8.2, VERIFIED** (up from 7.8). Justification: the brief's own
  flagged P1 gap (silent telemetry loss) is closed with both an in-process signal and a durable
  DB-based health check script.
- **Stage 11 — AI Evaluation: 7.7, VERIFIED** (up from 7.5). Justification: incremental,
  real, additive reporting improvements on top of last session's structural verification. Rating
  still capped by the same underlying data gap (zero expert-labeled gold cases), which is
  explicitly out of scope for a code-only session.

## What's still NOT empirically validated (unchanged by this session)
- RAG retrieval quality against real gold labels — `eval/rag_benchmark_synthetic.json` is still
  synthetic.
- AI output quality against real expert-labeled gold — `benchmark_300.json` still has 0 real
  annotations.
- The telemetry health-check script has not been run against a live Supabase instance in this
  session (no live DB credentials available in this environment) — its `BLOCKED` and `FAIL` paths
  are tested; its `PASS`/`STALE` paths depend on live data and should be exercised against a real
  environment before being trusted operationally.
