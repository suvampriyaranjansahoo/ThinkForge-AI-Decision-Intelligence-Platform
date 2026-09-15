# ThinkForge 6 — step-by-step build and verification

## Step 0 — create a safe branch
Use a dedicated `thinkforge-v6` branch. Never put provider secrets in Git.

## Step 1 — install and lint
```bash
npm install
npm run check
npm test
```
Expected: syntax checks pass and all local deterministic tests pass.

## Step 2 — configure Supabase
Run the original `supabase/schema.sql`, then `supabase/schema_v6.sql`. Verify RLS is enabled on every user-owned table. Verify the `thinkforge_sync_workspace` RPC exists.

## Step 3 — configure AI safely
Set `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_FALLBACK_MODEL`, `AI_EMBEDDING_MODEL`, and `RETRIEVER_VERSION` only in server environment variables. Never expose them to the client.

## Step 4 — verify AI contracts
Exercise assumptions, challenge, experiment, synthesize and PRD actions. Confirm invalid JSON, missing fields, unknown evidence IDs, and out-of-range values are rejected. Verify telemetry is recorded best-effort.

## Step 5 — verify authorization
Call `/api/ai`, `/api/rag`, `/api/evaluate`, `/api/workspace`, `/api/jira`, and `/api/annotations` without a token. Every protected endpoint must return 401.

## Step 6 — verify durable rate limiting
Configure Upstash Redis for production. Confirm repeated requests cross the configured threshold and return 429. Local memory limiting is a development fallback only.

## Step 7 — verify normalized persistence
Use `/api/workspace` with `expectedVersion`. Confirm a correct version increments. Confirm a stale version returns a conflict. Inspect relational decisions/assumptions/evidence after synchronization.

## Step 8 — verify audit integrity
Every important mutation should write an audit event with request ID, actor, previous hash, and event hash. Hash-chain verification should be part of operational monitoring.

## Step 9 — verify hybrid RAG
Ingest a corpus, store metadata and embeddings, then search through `/api/rag`. Verify both lexical and semantic retrieval contribute through RRF. Verify citations include document and source locator.

## Step 10 — build RAG gold data
For each benchmark query, have two independent reviewers assign gold chunk IDs. Only adjudicated labels may set `annotation_status=gold`.

## Step 11 — build the AI gold dataset
For the 300 decision cases, have two independent raters score the rubric. Calculate agreement, adjudicate disagreements, then attach structured gold labels. Never infer “expert” status from generated text.

## Step 12 — run AI evaluation
```bash
EVAL_LIMIT=20 npm run benchmark:live
npm run benchmark
```
The evaluation runner reports contract quality immediately. Gold-based quality metrics appear only for validated expert cases.

## Step 13 — run RAG evaluation and ablations
```bash
npm run rag:eval
```
Compare vector-only, lexical-only, hybrid and hybrid+rereanker configurations using Recall@5/10, MRR and nDCG.

## Step 14 — run calibration and experiment analysis
Create an outcome dataset and run:
```bash
npm run calibrate outcomes.json
```
For experiments, compute power/sample size before launch and estimate effect plus uncertainty after completion.

## Step 15 — production tests
Add and execute unit, integration, API, RAG, AI safety, security and E2E tests. The full decision journey is the primary E2E scenario.

## Step 16 — quality gate
A research release should require:
- >=100 adjudicated expert-gold cases
- documented rater agreement
- no accepted hallucinated evidence claims
- validated citation integrity
- retrieval metrics measured on gold queries
- no critical security test failures
- no E2E regressions
- known latency/cost budgets

## Step 17 — product study
Compare a baseline chat workflow with ThinkForge using the same decision tasks. Pre-register primary metrics and report confidence intervals. Do not publish a causal improvement claim until the study has actually been run.
