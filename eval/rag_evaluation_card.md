# ThinkForge RAG Evaluation Card

**Run:** `rag_blind_candidate_v1`  
**Status:** measured  
**Evaluated cases:** 124  
**Gold:** 150-query frozen human-annotated set

## Results

- Recall@5: **90.12%**
- Recall@10: **95.36%**
- Precision@5: **24.68%**
- MRR: **94.89%**
- nDCG@10: **90.30%**
- MAP@10: **85.43%**

## Evidence basis

The result is stored in `eval/rag_blind_candidate_v1_results.json`. Every evaluated detail row is marked `real_human_annotation_frozen_with_deterministic_tiebreak`.

The gold artifact contains 150 queries, 1,114 judgments and three rater columns. It is frozen; documented ties use the ordinal-median rule.

## Caveats

This is **retrieval/model-quality evidence**, product-impact evidence.

The candidate run covers 124 cases, not all 150 queries in the gold artifact.

The result also shows a precision weakness at k=5, so future work should focus on selectivity/reranking rather than reporting recall alone.
