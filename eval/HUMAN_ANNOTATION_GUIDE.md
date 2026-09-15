# ThinkForge Human Evaluation & Gold-Set Guide

The 300-case seed benchmark is deliberately **not** presented as expert-labeled ground truth. Each case starts with `pending_human_annotation`.

## Annotation protocol

Each case should be independently reviewed by at least two qualified evaluators before adjudication. Evaluators should score only the criteria relevant to the module:

- Decision relevance (1-5)
- Evidence grounding (1-5)
- Assumption quality (1-5)
- Challenge usefulness (1-5)
- Experiment quality (1-5)
- Actionability (1-5)
- Unsupported-claim severity (0-2)
- Citation/reference correctness (0-2)

Record a short rationale and the exact evidence IDs supporting any gold judgment. After independent annotation, adjudicate disagreements and mark the final record as `annotation_status: gold`.

## Research metrics

Calculate inter-rater agreement before reporting aggregate quality results. Suitable statistics depend on the label type; use an agreed protocol rather than selecting a statistic after seeing results.

Do not report the benchmark as “expert validated” until the annotation metadata and adjudication history are complete.
