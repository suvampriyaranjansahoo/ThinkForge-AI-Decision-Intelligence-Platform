# ThinkForge — evidence-backed product decisions

## Portfolio positioning

ThinkForge is an approval-gated research and decision-support system. It helps a product team move from an uncertain question to traceable evidence, a bounded recommendation, an experiment, and an outcome review. It is advisory software: it does not make or execute irreversible product decisions.

## Problem

Product teams often keep customer evidence, assumptions, recommendations, and outcomes in separate tools. This makes it hard to see why a decision was made, what uncertainty remained, and whether the result supported the original prediction.

### What discovery currently supports

A user-provided, mixed-recruitment sample of 10 PM/APM interview records points to a
directional problem: participants described decision rationale, evidence and follow-up
as fragmented across tools. They also described time pressure and the need for an
advisory workflow rather than an automated decision-maker. The full evidence log,
consent handling and disconfirming evidence are in
`../research/INTERVIEW_EVIDENCE_LOG_2026_Q3.md` and
`../research/INTERVIEW_SYNTHESIS_2026_Q3.md`.

This is qualitative discovery, not evidence that ThinkForge improves outcomes. A
paired pilot is still required before making an impact claim.

## Research method

1. Maintain an anonymized evidence log with date, segment, recruitment route and quote-consent status.
2. Synthesize themes with counts, disconfirming evidence, and only consented direct quotes.
3. Use ThinkForge to preserve evidence provenance, identify assumptions and contradictions, and propose the smallest reversible experiment.
4. Have an accountable product owner review the recommendation before acting.
5. Run the preregistered paired pilot before reporting decision-quality, time-to-decision or funnel results.

Do not claim user research, validation, or impact until it has actually happened. Synthetic examples must remain labeled synthetic and are excluded from empirical claims.

## Agent workflow

```text
Question → plan → human approval → public/supplied evidence → synthesis → human review → experiment → outcome
```

The agent exposes its planned tools, waits before paid external research, logs each state transition, and ends in `NEEDS_HUMAN_REVIEW` or `COMPLETED`; it cannot publish, create external work, or approve a decision.

## Metrics to report after staging deployment

| Metric | Target | Actual |
|---|---:|---:|
| Agent runs completed without unhandled error | ≥ 95% | [fill from staging] |
| Evidence-backed claim validation pass rate | ≥ 95% | [fill from evaluation] |
| P95 agent latency | [define SLO] | [fill from telemetry] |
| Cost per completed research run | [define budget] | [fill from telemetry] |
| Cross-tenant access attempts denied | 100% | [fill from staging test] |

## Trade-offs and limitations

- Retrieval quality depends on supplied documents and public-source quality.
- The heuristic injection signal is telemetry, not an input-safety verdict.
- Automation speeds investigation but does not replace accountable product judgment.
- Claims of product impact require real usage and outcome data.

## Demo outline

1. Show a research question and the agent plan.
2. Explain why the system pauses for approval before external research.
3. Inspect sources, contradictions, and evidence gaps in the trace.
4. Show the recommendation and proposed reversible experiment.
5. Close with observed outcomes and what the team changed.
