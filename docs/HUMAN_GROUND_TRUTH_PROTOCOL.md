# ThinkForge Human Ground Truth Protocol v3

## Purpose

Create an independently annotated, versioned, auditable gold set for evaluating ThinkForge. Human labels are treated as **adjudicated ground truth for defined tasks**, not as an absolute truth about all possible decisions.

## Study design

1. **Pilot:** 30 cases across modules, domains, difficulty, and evidence conditions.
2. **Rubric calibration:** raters independently score the pilot, then review disagreements and clarify ambiguous rubric anchors.
3. **Main annotation:** at least two independent raters score the locked annotation pool without seeing the other rater's scores.
4. **Blinding:** comparative evaluations must hide system/model identity and randomize presentation order.
5. **Hidden duplicates:** approximately 5% of presentations repeat a prior case without telling the rater. These estimate intra-rater consistency.
6. **Adjudication:** disagreements are resolved by a qualified adjudicator; do not average disagreeing scores into gold.
7. **Gold release:** only records with sufficient independent ratings and completed adjudication receive `annotation_status=gold`.

## Case splits

For the 300-case seed benchmark:

- 60 development cases
- 60 validation cases
- 180 locked-test cases

Development can be used to refine prompts and rubrics. Validation can be used for model/prompt selection. Locked-test cases must not be tuned against.

## Rating dimensions

The module-specific dimensions are defined in `eval/rubrics.json`. Each 1–5 dimension has anchored descriptions. Raters should use evidence and task instructions, not stylistic preference.

## Evidence and claim labels

When factual claims are present, optionally label each claim as:

- `SUPPORTED`
- `PARTIALLY_SUPPORTED`
- `UNSUPPORTED`
- `CONTRADICTED`
- `NOT_VERIFIABLE`

Record exact evidence IDs where possible.

## Reliability reporting

Report, at minimum:

- number of annotated cases and dimensions
- observed exact agreement
- weighted Cohen's kappa for ordinal 1–5 ratings
- category-level confusion/disagreement matrices
- adjudication rate
- hidden-duplicate consistency
- missing/invalid annotations

Do not interpret kappa without considering prevalence and rater behavior. Define reliability review rules before examining the locked-test results.

## Gold provenance

Every gold record must preserve:

- case ID
- presentation ID
- source benchmark version
- rubric version
- independent rater IDs
- original scores
- adjudicator ID when used
- final score
- rationale/evidence references
- timestamps
- annotation and adjudication status

## LLM judge policy

LLM judges may scale evaluation only **after** alignment is measured against human gold. Automated judges must never silently become the source of gold labels.

## Reporting policy

Do not describe the benchmark as “expert validated” until the required human annotation, reliability, and adjudication evidence exists. Synthetic fixtures may validate evaluation plumbing but are not evidence of product quality.
