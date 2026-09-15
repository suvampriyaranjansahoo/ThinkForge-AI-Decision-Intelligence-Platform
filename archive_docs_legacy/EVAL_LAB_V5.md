# ThinkForge Evaluation Lab v5

## What changed

ThinkForge now ships a 300-case benchmark **seed dataset** covering assumptions, challenges, experiments, synthesis, PRDs and insights. The cases are intentionally marked `pending_human_annotation`; they are not represented as expert truth.

The evaluation API can execute the actual ThinkForge model over the benchmark and reports:

- contract pass rate
- business-rule failures
- execution failures
- model/latency metadata
- annotation status
- expert-gold count

It does **not** fabricate a quality score when expert gold labels are absent.

## Gold-set path

1. Review cases independently with at least two qualified annotators.
2. Record module-specific labels and evidence references.
3. Adjudicate disagreements.
4. Mark final records as `annotation_status: gold` and `provenance.is_expert_labeled: true`.
5. Run evaluation and add semantic quality metrics.
6. Store result artifacts under `eval/runs/` and run the regression gate in CI.

## RAG benchmark

`eval/rag_benchmark.json` provides retrieval queries, but gold chunk IDs remain empty until a real corpus is annotated. This prevents fake Recall@k/MRR/nDCG numbers.

## Release policy

The regression gate intentionally blocks a research-quality release while expert gold labels are missing. Contract tests can pass independently, but contract validity is not equivalent to answer quality.
