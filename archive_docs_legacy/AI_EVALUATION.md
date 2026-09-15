# ThinkForge AI Evaluation v2

## Principle

ThinkForge must never score a synthetic expected answer and present it as model quality. Evaluation runs must execute the actual ThinkForge AI modules.

## Benchmark structure

Initial benchmark harness: 5 executable seed cases for smoke/regression testing. Before making research claims, expand to 100–300+ cases with expert annotations across:

- assumption identification
- challenge relevance
- evidence grounding
- contradiction handling
- experiment alignment
- recommendation quality
- hallucination resistance
- prompt-injection resistance

## Scoring

### Contract layer

- schema validity
- field completeness
- business-rule validity
- evidence-reference integrity

### Retrieval layer

- Recall@5 / @10
- MRR
- nDCG
- citation precision / recall
- source coverage

### Generation layer

- groundedness
- unsupported-claim rate
- relevance
- actionability
- contradiction detection

### Outcome layer

- prediction error
- Brier score / ECE for probabilistic predictions when enough observations exist
- calibration curve

## Regression policy

Every model/prompt/retriever release records:

- model version
- prompt version
- retriever version
- dataset version
- latency
- token usage
- cost
- pass/fail by case
- failure category

A release should fail CI when critical quality metrics regress beyond configured tolerances.

## v6 research gate
A release cannot claim research-grade AI quality until at least 100 cases have validated expert gold labels. Recommended reporting includes confidence intervals, per-module metrics, difficulty/domain stratification, adversarial cases, and baseline/ablation comparisons. Five smoke cases or a 300-case unlabeled seed set are test infrastructure, not evidence of model quality.
