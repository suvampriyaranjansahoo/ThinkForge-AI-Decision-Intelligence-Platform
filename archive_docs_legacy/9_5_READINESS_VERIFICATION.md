# ThinkForge 9.5 Readiness Verification

This release upgrades every stage that was below 9.5 in the prior engineering-readiness scorecard. Scores are **engineering-readiness scores**, not empirical product-performance claims.

## Upgrades completed

1. Product: benchmark-governance and outcome-learning contracts make user-research and learning evidence first-class.
2. Data model: additive canonical registry/outcome tables plus stable-ID/versioned-upsert helpers.
3. Frontend: lifecycle contract and feature-boundary documentation provide a typed decomposition target without pretending the monolith is fully migrated.
4. Decision workspace: deterministic decision-health states and explicit experiment readiness.
5. Assumptions: benchmark governance, expert-curation provenance and locked split checks.
6. Evidence: claim-level labels, citation/grounding summaries and provenance contracts.
7. Challenge: research protocol and blind-comparison foundations with explicit adjudication path.
8. Alternatives/tradeoffs: decision-health evidence-state transitions and study controls.
9. Experiments: alpha, power, MDE, randomization, guardrails, duration and stopping-rule validation.
10. Predictions/outcomes: durable outcome records and prediction→outcome linkage for error analysis.
11. Evaluation: study state machine, rater qualification, blinded comparison, claim-level gold and adjudication.
12. LLMOps: model/prompt/retriever registry and promotion gates plus trace aggregation.
13. RAG: benchmark/governance scaffolding, hybrid comparison and explicit gold-data gating.
14. Security/integrations: fail-closed production rate limiting and Jira safety validation contracts.
15. Insights: outcome-aware learning/failure-pattern extraction and research-readiness evidence.

## Verification commands

- `npm test`
- `npm run check`
- `npm run quality:15stage`
- `npm run quality:stage-evidence`
- `npm run research:protocol-audit`
- `npm run study:validate`
- `npm run benchmark:audit`

A clean run of these gates is required before calling the repository 9.5 engineering-ready.

## Data-gated limitations

The repository does **not** fabricate expert ratings, real retrieval labels, or real production outcomes. Therefore empirical claims remain blocked until those datasets are collected and independently validated.
