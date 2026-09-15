# ThinkForge v4 Production Hardening

Implemented foundations in v4:

1. Server-side authentication for AI/Jira/workspace APIs.
2. Best-effort request rate limiting with request IDs.
3. Strict Zod AI contracts and business-rule validation.
4. Actual-AI evaluation mode; no synthetic quality scores.
5. Normalized Supabase entities for decisions, assumptions, evidence and AI interactions.
6. Audit-event persistence.
7. pgvector index foundation and bounded retrieval count.
8. Health endpoint with required environment checks.
9. Explicit Jira confirmation gate.
10. Contract unit tests.

Remaining enterprise work:

- durable distributed rate limiting/WAF
- full document extraction pipeline for PDF/DOCX
- object-storage retention/deletion workflows
- Atlassian OAuth for multi-tenant Jira
- full browser E2E test suite
- expert-annotated 100–300+ benchmark
- human evaluation and inter-rater reliability
- production tracing/error monitoring
- SOC2/privacy/compliance processes if handling enterprise-sensitive data

## v6 hardening additions
- Durable rate limiting can be enabled with Upstash Redis.
- AI interactions are persisted best-effort with model/prompt/retriever/latency/token/cost metadata.
- Workspace persistence now supports optimistic versioning and a transactional normalized projection RPC.
- Hybrid RAG uses lexical + vector retrieval with reciprocal-rank fusion.
- Evaluation annotations are stored separately from benchmark cases so expert labels are auditable rather than generated.
- Prediction/outcome utilities support Brier score, ECE, calibration buckets, MAE, RMSE and mean bias.
