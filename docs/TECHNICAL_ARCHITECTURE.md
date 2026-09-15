# ThinkForge technical architecture

```text
Browser workspace
  → authenticated API routes
    → organization membership / role check
      → agent policy and budget checks
        → RAG, web research, or structured AI generation
          → validation, telemetry, audit and human review
            → Supabase/Postgres tenant-scoped records
```

## Agent runtime

The research agent is intentionally bounded. It plans only registered tools, requires explicit approval for paid external research, blocks external writes, and returns a trace for human review. Its valid state transitions are in `lib/agentState.js`; tool risk, role, approval, and budget controls are in `lib/agentPolicy.js`.

The durable schema separates a run from individual steps, tool calls, and reviewer feedback. A database trigger ensures every child runtime record has the same organization as its parent run.

## Retrieval and AI generation

RAG uses tenant-bound lexical and embedding retrieval, reciprocal-rank fusion, light reranking, near-duplicate filtering, and citation-ready source metadata. Model outputs are validated against structured contracts and evidence-reference allowlists before acceptance.

## Evaluation and release gates

- Unit tests cover contracts, policy, RAG integrity, tenancy structures, and agent approval behavior.
- `npm run eval:agent-policy` executes deterministic policy fixtures.
- `npm run migrations:check` verifies mirrored migration trees.
- Live tenant isolation, real model evaluation, and production telemetry remain deliberately blocked until staging credentials and real traffic exist.

## Non-goals

ThinkForge does not claim to autonomously make product decisions, approve external actions, or validate unsupported evidence. A “successful” run is not proof that a recommendation is correct.
