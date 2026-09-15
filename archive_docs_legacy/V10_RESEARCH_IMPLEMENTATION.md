# ThinkForge v10 — Research / Evaluation Implementation

## Objective
Turn the research/evaluation layer from annotation infrastructure into a controlled, reproducible study system.

## Implemented controls

1. Study state machine with explicit freeze/annotation/adjudication states.
2. Versioned dataset, rubric, protocol and candidate snapshot metadata.
3. Candidate snapshot manifest with immutable checksum and no-lazy-generation policy.
4. Rater state machine with pilot and qualification gates.
5. Deterministic pilot/main/duplicate assignment generation.
6. 5% hidden duplicate presentations for intra-rater consistency.
7. Claim-level evidence labels.
8. Reliability reporting including exact agreement, Cohen's kappa, weighted kappa and disagreement matrices.
9. Adjudication-aware canonical gold-set architecture.
10. Blinded comparative-study metadata and randomized presentation support.
11. Benchmark audit for evidence-condition labels and duplicate/template signals.
12. Research claim gates that remain blocked until real human/RAG/outcome evidence exists.

## What remains empirical

The repository does not manufacture expert labels, real RAG relevance labels, participant decisions or real-world outcomes. Those must be collected from actual study participants and source data.

## Recommended study execution

`register study → freeze benchmark → freeze candidates → train raters → 30-case pilot → qualify raters → double annotation → reliability → adjudication → lock gold → benchmark models → validate LLM judge → blinded pairwise comparison → human-vs-ThinkForge study → outcome follow-up → publish report`
