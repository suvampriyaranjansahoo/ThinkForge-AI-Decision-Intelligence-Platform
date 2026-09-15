# ThinkForge Stage 4 — Decision Workspace 9.5

## Objective

Turn the decision workspace from a set of tabs into a governed decision lifecycle without changing Stage 1 discovery or Stage 2 canonical foundations.

## What is implemented

- First-class decision workflow state: `DRAFT → INVESTIGATING → READY_FOR_REVIEW → APPROVED → EXECUTING → OBSERVING → LEARNED → ARCHIVED`.
- Readiness gates based on problem completeness, required evidence level, critical assumptions, contradictions, and options.
- Explicit transition authority for review, approval, and execution.
- Optimistic workflow-state versioning.
- Approval creates an immutable decision snapshot through the existing Stage 2/P0 snapshot RPC.
- Decision workflow transitions emit append-only domain events.
- Decision dossier and confidence decomposition for UX surfaces.
- API actions for readiness, governed transitions, and manual snapshots.

## Design principle

A healthy decision workspace should answer:

1. What are we deciding?
2. What prevents us from being ready?
3. Who can approve the decision?
4. What state is the decision in?
5. What changed since the last state transition?
6. What should happen next?

## Safety posture

The workflow is intentionally fail-closed. A decision cannot move to `READY_FOR_REVIEW` while a required gate is open. Approval is permissioned. Execution requires editor-level authority. `LEARNED` requires both an observed outcome and recorded learning.

## Remaining empirical work

The workflow is implemented and unit-tested, but real usability evidence and production telemetry are still required before claiming a fully validated 9.5 UX outcome.
