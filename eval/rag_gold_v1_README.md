# ThinkForge RAG Gold v1

**Status: FROZEN**

This artifact contains the supplied 3-rater human annotation dataset:
- 150 queries
- 1,114 query-document judgments
- 3 independent rater label columns
- no unresolved cases
- no ThinkForge predictions

## Adjudication
Most records use unanimous or 2-of-3 majority labels.
The supplied dataset resolves:
- 97 relevance 0/1/2 ties using an ordinal-median tie-break
- 45 answerability 3-way ties using the ordinal median category

This makes the artifact a **frozen human-annotated RAG gold set with deterministic tie-break adjudication**.
It should not be described as having 141 cases independently reviewed by a separate human adjudicator.

The dataset SHA-256 is recorded in `FREEZE_MANIFEST.json`.
