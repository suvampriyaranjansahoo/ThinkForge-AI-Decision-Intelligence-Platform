# ThinkForge v7 — 9+ Implementation Track

## Implemented in this build

- Decision-first product surface retained while the main inline script and stylesheet were moved into `frontend/src/app.js` and `frontend/src/styles.css`.
- AI orchestration now has per-module policies, model fallback, retry/backoff, per-model circuit breakers, cost budgets, structured repair attempts, prompt/model/retriever version metadata, and AI interaction telemetry.
- Security includes authenticated API access, request-size limits, security headers, injection signal detection, durable Upstash rate limiting when configured, explicit Jira confirmation, and idempotency keys.
- RAG includes document ingestion, optional PDF parsing, deterministic chunking, dense + lexical hybrid retrieval, reciprocal-rank fusion, light reranking/deduplication, source locators, parser/version provenance, and a separate RAG benchmark harness.
- Evaluation includes 300 stratified benchmark seeds, per-module annotation rubrics, independent two-rater workflow, duplicate-submission prevention, annotation metrics, bootstrap confidence intervals, gold-gated research claims, and a regression gate.
- Statistics includes Brier score, ECE, calibration buckets, MAE/RMSE/bias, Wilson intervals, two-proportion comparison, sample-size planning, and bootstrap intervals.
- Database schema adds organizations/memberships, annotation assignments/adjudications, evaluation runs, prompt/model registries, document versions, privacy requests, prediction/outcome structures, and audit hash-chain fields.

## Not falsely claimed

The project does not claim expert gold labels, RAG retrieval quality, user-study lift, real production usage, or calibrated outcome performance until actual data is supplied.

## Required evidence to cross the 9+ empirical bar

1. Complete independent annotation of the 300 benchmark cases.
2. Adjudicate disagreements and lock the gold set.
3. Annotate real corpus retrieval targets for the RAG benchmark.
4. Run AI and RAG evaluations with confidence intervals.
5. Compare baseline LLM vs ThinkForge and vector-only vs hybrid vs reranked retrieval.
6. Record real experiment outcomes and run calibration/error analysis.
7. Promote only releases that satisfy the regression policy.
