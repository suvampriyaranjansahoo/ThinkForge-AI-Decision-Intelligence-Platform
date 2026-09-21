# RAG Metric Definitions

## Recall@k

The proportion of gold-relevant items that appear in the top-k retrieved results.

**Question:** Did the retriever find the relevant evidence?

## Precision@k

The proportion of the top-k retrieved items that are relevant under the evaluation rule.

**Question:** How much of the retrieved top-k set is useful?

## Mean Reciprocal Rank (MRR)

The mean reciprocal rank of the first relevant result.

**Question:** How high is the first relevant evidence ranked?

## nDCG@k

Normalized discounted cumulative gain at k. Higher-ranked relevant items contribute more than lower-ranked items, and graded relevance can be represented.

**Question:** How well does the ranking order useful evidence?

## MAP@k

Mean average precision at k, summarizing precision across ranks where relevant items appear.

**Question:** How consistently are relevant items concentrated throughout the ranked list?

## Why metrics can disagree

A system can have high recall and high MRR while having lower precision. It may retrieve a relevant document very early while also returning several irrelevant documents in the remaining top-k positions.

For ThinkForge, finding the right evidence is necessary, while limiting distracting evidence is also important.

Use the complete metric set rather than selecting only the strongest metric.
