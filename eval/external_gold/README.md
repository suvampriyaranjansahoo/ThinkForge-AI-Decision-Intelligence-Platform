# Stage 1 External Empirical Gold

This directory intentionally contains **no fabricated labels**. The empirical gate is fail-closed.

## Required gold study

Import a frozen dataset built from real, legally reusable/anonymized research material and researcher/expert labels. The importer must preserve the original study provenance and codebook; do not paraphrase or generate labels with an LLM.

The current gate requires:

- at least **100 gold cases**;
- at least **3 independent human evaluators**;
- adjudication of disagreements;
- at least **3 independent source studies** represented in the gold manifest;
- a frozen gold version and codebook version;
- complete coverage of evidence, themes, opportunities, and contradictions for the evaluated cases;
- synthetic/model-generated gold explicitly prohibited.

See `stage1_gold.schema.json` for the structural contract.

## Recommended corpus sources

The external benchmark manifest records public sources that can support different dimensions. XAI-FUNGI contains anonymized interview transcripts, a thematic-analysis codebook, and MAXQDA summaries for 39 interviewed participants across three participant groups. The Qualitative Interview Corpus contains 343 interview transcripts and 16,940 participant responses from 14 real research projects and provides reproducibility code. TRIPLE provides 25 qualitative interview transcripts about user needs for a discovery platform. These are **source inputs, not pre-built ThinkForge gold labels**.

Source provenance:
- XAI-FUNGI: https://zenodo.org/records/15222484
- Qualitative Interview Corpus: https://github.com/jonathanivey/interview-quality
- TRIPLE: https://zenodo.org/records/10513763


## Theme-vocabulary enforcement

If a source in `studyManifest.sources` declares a `themeCodebookFile` (a
relative path to a real, published codebook CSV with a `code` column),
`build_external_stage1_gold.js` mechanically rejects any case from that
source whose `gold.themes` or `prediction.themes` contains a value not
present in that file — not a lint warning, a hard `BLOCKED` exit before
gold is frozen. `eval/external_gold/reference/xai_fungi_codebook.csv` is
one such file (real, CC-BY-4.0, DOI 10.5281/zenodo.15222484) and is wired
in automatically by `generate_case_bank_skeleton.js` whenever `XAI-FUNGI`
is one of your source IDs. This exists so "real research material" means
labels actually drawn from a real codebook, not just cases *sourced from*
somewhere real while the labels themselves are invented.

## External study bootstrap

The external human study is separate from `eval/benchmark_300.json`, which is a synthetic/template benchmark. Do not use that benchmark as human-gold input.

1. Create `case_bank.json` from real, legally reusable/anonymized research material using `case_bank.schema.json`. `npm run gold:external:case-bank-skeleton -- 120 SOURCE-1,SOURCE-2,SOURCE-3` generates a correctly-shaped blank file to fill in by hand (never auto-fill `input.prompt` or `prediction`).
2. Run:

```bash
npm run external:study:bootstrap -- eval/external_gold/case_bank.json eval/external_gold/study rater-1,rater-2,rater-3
```

3. Generate blank per-rater sheets so each rater only sees their assigned cases, in rubric order: `npm run gold:external:rating-sheets -- eval/external_gold/case_bank.json eval/external_gold/study <module> eval/external_gold/sheets` (`<module>` is one of the keys in `eval/rubrics.json` `dimensions`, e.g. `assumptions`).
4. Have all three qualified raters independently fill in their sheet's `scores`, `confidence`, `timeSeconds`, and `proposedGold` while blind to ThinkForge candidate output and to each other's sheets. Preserve every raw sheet — never overwrite a rater's original submission.
5. Where all three raters' `proposedGold` disagree, a senior adjudicator resolves it into an `adjudications.json` record (`caseId`, `adjudicatorId`, `rationale`, `finalGold`, `finalScores`) — see `aggregate_external_gold.js`'s header comment for the exact shape. Raw ratings are never averaged into gold.
6. Merge sheets + adjudications into `researcher_annotations.json`: `npm run gold:external:aggregate -- eval/external_gold/case_bank.json eval/external_gold/study eval/external_gold/sheets/rater-1.sheet.json eval/external_gold/sheets/rater-2.sheet.json eval/external_gold/sheets/rater-3.sheet.json eval/external_gold/adjudications.json`. This is the step that previously had no script — it fails closed and lists every case still missing a rating or adjudication rather than silently dropping it.
7. Freeze only after every disagreement is adjudicated (or has an explicit documented-prior-adjudication provenance record) and at least 50% of resolved cases are `locked_test`. Build `researcher_annotations.json` into `stage1_gold.json` with `npm run gold:external:build`. The frozen artifact records its scope explicitly; a partial 146-case freeze must not be mislabeled as a 150-case complete study.
8. Run `npm run stage1:empirical`.

The bootstrap creates **assignments only**. It never creates human labels, candidate predictions, or empirical scores. `gold:external:aggregate` never fabricates a label either — every case in its output is either a genuine 3-rater agreement or a completed, attributed adjudication record.

## Current embedded capstone scope

The repository currently contains a **146-case frozen Stage 1 gold** derived from the 146 confirmed capstone records and explicitly excludes the **4 pending adjudication cases**. The capstone audit and frozen-gold scope metadata must agree on these counts.


## Final 146-case scope (2026-09-09)
The Stage 1 frozen gold scope is finalized at **146 cases**. The four unavailable source cases — CASE-002, CASE-005, CASE-065, and CASE-142 — are explicitly excluded from this evaluation scope. They remain preserved in the source/rater artifacts and are not adjudicated or scored. This is a scope decision, not a fabricated resolution.


## Current final gold scope
The repository now treats the **146-case Stage 1 gold as complete for the finalized evaluation scope**. Four source cases (CASE-002, CASE-005, CASE-065, CASE-142) are explicitly excluded because they were unavailable for completion. This does not imply adjudication of those four cases and does not fabricate labels. The original 150-case source/rater artifacts remain preserved for provenance.
