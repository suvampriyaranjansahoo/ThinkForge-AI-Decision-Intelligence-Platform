# ThinkForge portfolio guide

## What this project is

ThinkForge is an evidence-backed decision workspace for product teams. A user frames a decision, names assumptions, attaches evidence, reviews challenges, chooses a small experiment, and records what happened later.

The AI is advisory. It cannot make a product decision, create external work, or turn an unknown source into a citation. High-risk research waits for explicit approval and a human review step.

## Product Analyst story

### Problem evidence

Ten user-provided PM/APM interview records from 2026 Q3 were synthesized in `research/INTERVIEW_SYNTHESIS_2026_Q3.md`. The sample is mixed-recruitment qualitative research, so counts are directional rather than market estimates.

- 10/10 described no documented prediction-to-outcome review.
- 10/10 named fragmented, private, inaccessible, or ephemeral evidence.
- 7/10 described an assumption record that was missing, hidden, partial, or non-durable.

These findings shaped the five-step MVP in `PRD.md`. They do not prove product adoption or impact. The paired pilot in `PILOT_PROTOCOL.md` is the next test.

### Product decisions made from research

| Research signal | Product choice |
|---|---|
| Evidence gets scattered across systems | Make evidence links, source metadata, and access context part of the decision record. |
| Teams do not revisit original expectations | Keep prediction, success rule, outcome, and learning together. |
| Process can become too heavy | Test a lightweight path before adding more governance. |
| Participants rejected autonomous AI decisions | Keep AI advisory and reviewable. |

## AI Engineer story

The Django target backend provides:

- organization-scoped roles and JWT authentication;
- PostgreSQL/pgvector-ready chunks with optional server-side embeddings;
- Celery/Redis indexing and lexical fallback when embeddings are unavailable;
- a tool policy with role, approval, per-run, and organization rolling-hour limits;
- explicit reviewer assignment, SLA timestamps, review outcomes, and audit events;
- deterministic shared policy and state-machine fixtures across Node and Django.

Verified locally on 2026-09-21:

```text
py -3.12 manage.py test apps.core.tests
Ran 18 tests ... OK

py -3.12 manage.py check
System check identified no issues

node scripts/eval_agent_policy.js
17 / 17 cases passed

node scripts/eval_agent_state_machine.js
15 cases; no declared Node/Django divergences
```

The system has not executed a real provider-backed agent run in this evidence set. It also has no production traffic, deployment SLO, or live retrieval metric. Those limits are deliberate and documented.

## Demo order

1. Use `PM_DEMO_RUNBOOK.md` for the product workflow.
2. Show `research/INTERVIEW_SYNTHESIS_2026_Q3.md` and explain the scope decisions it caused.
3. Open `docs/DJANGO_ARCHITECTURE.md` and the agent trace/review workflow.
4. End with the pilot plan and clear evidence limits, rather than invented impact metrics.
