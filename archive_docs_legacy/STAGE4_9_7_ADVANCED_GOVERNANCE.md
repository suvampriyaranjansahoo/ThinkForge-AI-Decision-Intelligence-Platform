# ThinkForge Stage 4 — 9.7 Advanced Decision Governance

Stage 4 is the governance spine of a ThinkForge decision. It controls readiness, authority, approval, revision, evidence quality, material change, conditions, dissent, expiry, and the decision contract while keeping AI advisory rather than authoritative.

## Implemented capabilities

1. Authoritative readiness policy with quality-aware evidence gates.
2. Four decision rigor levels: quick, standard, significant, high-stakes.
3. Explicit decision lifecycle and controlled transitions.
4. Decision authority/capability matrix.
5. Human-only approval boundary.
6. Approval snapshot and governance contract.
7. Approved-state mutation guard requiring reopen for material changes.
8. Structured reopen reasons.
9. Separate reopen semantics from rollback semantics.
10. Material-change detection for confidence, readiness, assumptions, contradictions, recommendation, option, and evidence quality/coverage.
11. Decision version/history support.
12. Explainable confidence decomposition.
13. Separate confidence and readiness concepts.
14. Decision-health dimensions.
15. Explicit blocker explanations and next-best action.
16. What-would-change-my-mind conditions.
17. Approval conditions with pending/met/not-met state.
18. Alternative/option governance.
19. Reviewer / approver roles through existing decision participants.
20. Stakeholder dissent capture.
21. Decision expiry and review-due dates.
22. Decision contract.
23. Append-only governance history.
24. AI governance boundary: AI can recommend and flag; it cannot approve.
25. E2E-compatible governance API actions.
26. Backend RPC contract for readiness, approval, reopen and history.
27. Frontend governance workspace embedded inside the Decision Workspace.
28. Governance-specific regression tests.
29. Evidence quality dimensions and freshness risk.
30. Cross-stage linkage points to evidence, assumptions, experiments, predictions and outcomes.

## Important integrity rule

`Stage 1` and `Stage 2` remain foundations. Stage 4 may consume their canonical entities but should not introduce alternate sources of truth.

## Validation

Run:

```bash
npm test
npm run check
```

The Stage 4-specific suite should be green before release. Empirical claims remain separate from engineering readiness and require real human decisions/outcomes.
