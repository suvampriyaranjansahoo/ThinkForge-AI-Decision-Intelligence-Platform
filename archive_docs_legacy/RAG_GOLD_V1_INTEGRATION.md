# RAG Gold v1 Integration

This release integrates the supplied frozen RAG evaluation artifact into ThinkForge.

## Included
- `eval/rag_gold_v1.csv`: 1,114 query-document judgments across 150 queries.
- `eval/rag_benchmark_real_human_v1.json`: 150-query benchmark adapter for the existing RAG metrics engine.
- `eval/rag_gold_v1_freeze_manifest.json`: freeze metadata and SHA-256.
- `scripts/eval_rag_gold.js`: loads the frozen benchmark and refuses to report scores until candidate retrieval results are supplied.

## Evaluation boundary
Retrieval scoring uses `final_relevance == 2` as strict binary relevance. Partial relevance (`final_relevance >= 1`) is preserved in the source gold and benchmark metadata but is not silently treated as binary relevance.

The gold contains three rater label sets. The supplied source resolves its three-way ties with a documented ordinal-median rule; therefore this is a frozen human-annotated evaluation gold set with deterministic tie-break adjudication, not independently reviewed adjudicator gold.

ThinkForge predictions are intentionally absent from the gold artifact.
