# ThinkForge v6 implementation guide

## Step 1 — Database
Run `supabase/schema.sql` first on a fresh project, then `supabase/schema_v6.sql`. The v6 migration adds organizations/memberships, experiments, challenges, alternatives, predictions, outcomes, learnings, annotation storage, audit hashes, hybrid retrieval, and the transactional workspace sync RPC.

## Step 2 — AI orchestration
`lib/ai.js` now provides module policies, context budgets, retry/backoff, model fallback, circuit breaking, prompt/retriever versions, cost estimation and structured telemetry. Keep provider secrets server-side.

## Step 3 — Contracts
`lib/contracts.js` is the canonical runtime contract layer. It performs structural validation plus decision-context business-rule validation. A future TypeScript client can mirror these contracts; do not claim Zod is installed unless the dependency is added.

## Step 4 — Hybrid RAG
Use `/api/rag` with authenticated `search`. Retrieval combines Postgres lexical rank and pgvector semantic rank via RRF. `eval/rag_benchmark.json` intentionally blocks quality claims until gold chunk annotations are supplied.

## Step 5 — Human evaluation
`eval/annotate.html` and `/api/annotations` provide an annotation workflow. Expert status must be earned by independent annotation + adjudication; the seed benchmark is not labeled as expert data.

## Step 6 — AI evaluation
Run `npm run benchmark:live` after configuring an AI provider. The evaluation runner measures contract/business-rule outcomes and computes gold-based metrics only for cases with validated labels.

## Step 7 — Calibration
Provide a JSON array containing probabilistic rows (`probability`, `outcome`) and/or effect rows (`predicted`, `actual`) to `npm run calibrate outcomes.json`. The utility reports Brier, ECE, calibration buckets, MAE, RMSE and bias.

## Step 8 — Security
Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for durable rate limiting. Keep local rate limiting as development fallback only. Review the Jira OAuth migration before enabling commercial multi-tenant use.

## Step 9 — Frontend migration
The current static application remains functional for compatibility. The `frontend/src` structure is the migration boundary for a React/TypeScript component architecture; progressively move stages into feature modules and keep API contracts independent of UI state.

## Step 10 — Research protocol
Do not publish invented AI quality numbers. Populate expert gold labels, measure inter-rater agreement, run retrieval ablations, run baseline-vs-ThinkForge comparisons, and report uncertainty around estimates.
