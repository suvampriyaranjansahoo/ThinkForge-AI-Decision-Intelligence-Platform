# ThinkForge v4 — Target Production Architecture

## Product loop

Decision → Assumptions → Evidence → Challenge → Alternatives → Decision → Experiment → Prediction → Outcome → Learning.

## AI quality loop

Benchmark → Ground truth → Real model execution → Contract validation → Grounding checks → Human evaluation → Regression gate.

## Platform

- Frontend: current static UI can remain the portfolio shell; migrate feature boundaries to React/TypeScript when team-scale iteration is needed.
- API: server-side AI, RAG, Jira, workspace persistence.
- Data: normalized decision entities + JSON payload for forward-compatible metadata.
- AI interaction store: model/prompt/retriever versions, latency, tokens, validation and failure codes.
- Audit: immutable event history for decision and execution actions.
- RAG: persisted documents/chunks with pgvector foundation and provenance.

## Non-negotiable controls

1. No anonymous access to provider-backed AI or Jira in production.
2. No AI output enters product state without schema + business-rule validation.
3. No generated citation may reference an unknown evidence record.
4. No evaluation score is reported unless the actual system under test was executed.
5. Outcome analytics must distinguish deterministic prediction gaps from probabilistic calibration.
6. Sensitive documents require retention/deletion controls and a security review.
