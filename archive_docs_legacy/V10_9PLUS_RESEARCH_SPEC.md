# ThinkForge v10 — 9.5 Research / Evaluation Specification

## Research claim principle

A research claim is publishable only when its evidence is derived from a locked study, independent human labels or independently generated objective labels, reproducible evaluation code, and the applicable empirical gate.

## Controlled lifecycle

`REGISTERED → DATASET_FROZEN → CANDIDATES_FROZEN → PILOT → QUALIFICATION → MAIN_ANNOTATION → ADJUDICATION → GOLD_LOCKED → EVALUATION_COMPLETE`

## Human ground truth

- Two independent raters minimum.
- 30-case pilot before main annotation.
- Qualification required.
- 5% hidden duplicates.
- Raw ratings preserved.
- Disagreements adjudicated; never averaged into gold.
- Claim-level evidence labels supported.
- Confidence captured.

## Comparative evaluation

Comparisons should hide model identity, randomize left/right position, and retain the underlying candidate IDs and study version for auditability.

## RAG evaluation

Real retrieval claims require independently labeled relevant chunks. Synthetic RAG fixtures are for testing metric plumbing only.

## Decision impact

The preferred product-level study compares `HUMAN_ONLY` with `HUMAN_PLUS_THINKFORGE` on decision quality, decision time, assumption discovery and evidence usage.

## Publication gate

The software must continue to report empirical readiness as blocked until actual expert gold, real RAG gold and the configured decision-impact/outcome evidence thresholds are met.
