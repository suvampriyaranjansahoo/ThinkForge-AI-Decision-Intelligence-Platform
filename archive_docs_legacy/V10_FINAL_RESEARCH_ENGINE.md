# ThinkForge v10 — Final Research Engine

## What is implemented

ThinkForge v10 turns research evaluation into an explicit study-controlled subsystem rather than an ad-hoc benchmark script set.

### Study controls
- Versioned study, dataset, rubric, and protocol identifiers.
- Enforced rater lifecycle: UNTRAINED → TRAINING → PILOT → QUALIFICATION_REVIEW → CERTIFIED → MAIN_STUDY.
- Enforced study lifecycle from DRAFT through GOLD_LOCKED and EVALUATION_COMPLETE.
- Candidate-freeze policy with immutable checksums and no-lazy-generation production behavior.
- Study owner / configured research-admin controls for study transitions.

### Human ground truth
- 30-case pilot.
- Qualified independent raters.
- Hidden duplicate presentations for intra-rater consistency.
- Claim-level evidence labels.
- 1–5 subjective rubric dimensions plus explicit 0–2 objective labels.
- Reliability outputs: observed agreement, Cohen's κ, weighted κ, hidden-duplicate consistency, and disagreement matrices.
- Adjudication schema preserves raw rater judgments and records the adjudicator/rationale.
- Canonical gold-set generation requires two distinct raters; disagreement requires adjudication.

### Comparative evaluation
- Pairwise study schema with A/B/TIE preferences.
- Randomized left/right position seed.
- Blinding metadata.
- Human-only vs Human + ThinkForge decision-impact schema.

### RAG / grounding
- Real RAG gold-label template.
- Retrieval ablation infrastructure for vector, BM25, hybrid, and reranker comparisons.
- Claim/evidence grounding fields designed for supported, partially supported, unsupported, contradicted, and not-verifiable labels.

## Evidence policy

Synthetic fixtures and generated benchmark cases are development/evaluation infrastructure, not empirical evidence of model quality. Research claims remain blocked until real human labels, real RAG relevance labels, decision-impact observations, and/or real outcomes meet the thresholds in `eval/study_manifest.json`.

## Verification

Run:

```bash
npm test
npm run check
npm run research:protocol-audit
npm run study:validate
npm run annotation:report
npm run research:audit
```

The benchmark audit intentionally reports template-signature duplication signals and recommends expert curation. This is a research-quality guardrail, not a failure condition for the software infrastructure.
