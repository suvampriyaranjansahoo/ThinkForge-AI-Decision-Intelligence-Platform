# ThinkForge Stage 1 — Product Discovery 9.5 Implementation

## Purpose
Stage 1 is now an outcome-first, evidence-driven continuous discovery subsystem rather than a notes-only research page.

## Flow
Desired outcome → research question → method fit → research capture → raw evidence → coding/themes → contradiction detection → triangulation → opportunities → opportunity solution tree → assumptions → leap-of-faith risk → tests → discovery gate → decision.

## Contracts
- Facts, observations, interpretations, opportunities and hypotheses are distinct evidence levels.
- Every opportunity can carry evidence IDs.
- Method fit is explicit for exploratory, descriptive, evaluative, causal, predictive and generative questions.
- Contradictory evidence is surfaced rather than averaged away.
- Opportunity prioritization exposes separate dimensions instead of pretending one universal formula is objective.
- The discovery gate blocks missing core inputs and warns on weak evidence, unresolved contradictions, single-method evidence and high-risk/low-evidence assumptions.
- Analysis is deterministic and auditable; LLMs may later suggest codes/opportunities but must not silently fabricate evidence.

## API
`POST /api/discovery`

Actions:
- `analyze`: returns method fit, evidence normalization, codes/themes, contradictions, coverage, triangulation, opportunities, OST, assumption risk and gate.
- `save`: authenticated persistence hook for Supabase-backed deployments.

## Database
Migration `014_v11_product_discovery.sql` adds:
- `thinkforge_discoveries`
- `thinkforge_research_evidence`
- `thinkforge_research_codes`
- `thinkforge_opportunities`
- `thinkforge_discovery_tests`

All tables have RLS ownership policies.

## Evidence quality gate
Status values:
- `READY`
- `INVESTIGATE`
- `BLOCK`

A readiness status is a deterministic engineering gate, not an empirical research-quality claim.

## Stage 1 v4 — Continuous discovery hardening

The discovery layer now exposes additional deterministic controls:
- Discovery brief: desired outcome, target segments, constraints, decision and time horizon.
- Research-question quality scoring across specificity, decision relevance, measurability, falsifiability, bias risk, actionability and scope, with a suggested rewrite.
- Method recommendation with ranked alternatives and contextual trade-offs.
- Atomic evidence nuggets with explicit epistemic levels.
- Independence clustering so correlated evidence is not double-counted as triangulation.
- Advanced triangulation combining evidence quality, source independence, method diversity, segment coverage and contradiction rate.
- Segment-aware synthesis and a coverage matrix.
- Opportunity quality checks and feature-shaped/solution-shaped language detection.
- Opportunity saturation detection for continuous updates.
- Explicit discovery stop conditions and prioritized next actions.
- Additive `researchUpdate()` support for a living discovery loop.
- Confidence decomposition instead of a single opaque confidence number.

The Stage 1 frontend surfaces question quality, triangulation, independent evidence units, segment coverage, stop condition and next-best discovery actions. The semantic API remains fail-closed; heuristic mode is used only as a deterministic fallback.
