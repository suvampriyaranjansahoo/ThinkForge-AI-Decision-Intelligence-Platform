# ThinkForge v10 — Consolidated 9.5 Build Plan

This document supersedes the v9 implementation plan as the consolidated engineering roadmap.

# ThinkForge v9 — Build & Research Protocol

## Goal
Move ThinkForge from evaluation infrastructure toward a controlled, reproducible human-ground-truth study.

## Controlled study lifecycle
1. Study registration
2. Dataset/rubric freeze
3. Candidate snapshot freeze
4. Rater training
5. 30-case pilot
6. Qualification review
7. Double independent annotation
8. Hidden duplicate consistency checks
9. Reliability analysis
10. Expert adjudication
11. Canonical gold release
12. AI/LLM-judge alignment
13. Blind pairwise evaluation
14. Human-only vs ThinkForge study
15. Outcome validation

## Evidence rules
- Human labels are never replaced by model self-scores.
- Disagreements are never averaged into gold.
- Synthetic RAG fixtures are code-validation fixtures, not product evidence.
- Research claims require an explicit locked study version and real labels.

## Candidate freezing
`npm run study:freeze` creates an immutable study snapshot for the configured model/prompt/retriever. Production annotation rejects lazy candidate generation when no frozen candidate exists.

## Rater qualification
Raters progress through `UNTRAINED → TRAINING → PILOT → QUALIFICATION_REVIEW → CERTIFIED → MAIN_STUDY`.

## Main-study design
- 300 benchmark cases
- 60 development / 60 validation / 180 locked test
- 5% hidden duplicates per rater
- minimum 2 independent raters
- adjudication on disagreement
- claim-level evidence labels

## Reliability reporting
Report observed agreement, Cohen's κ, weighted κ for ordinal dimensions, hidden-duplicate consistency, disagreement matrices, adjudication rate, and rater-level diagnostics. Add multi-rater reliability only when the study design actually contains >2 raters.

## What remains empirical
The software does not create expert labels. Actual human recruitment, annotation, adjudication, real RAG relevance labels, decision-impact studies, and observed outcomes must be collected and analyzed separately.
