# ThinkForge Human-Ground-Truth Dataset Card

## Motivation
Evaluate whether ThinkForge produces evidence-backed, uncertainty-aware decision support.

## Composition
300 decision cases across six evaluation modules, ten domains, four difficulty tiers, and multiple evidence conditions.

## Splits
60 development, 60 validation, 180 locked test.

## Annotation
Two independent raters are required for the main study. A 30-case pilot is used for training and rubric calibration. Five percent hidden duplicate presentations support intra-rater consistency checks.

## Gold policy
Agreement can directly produce a gold label. Disagreement must go to expert adjudication. Raw ratings are preserved. Gold is never fabricated from model self-scores or synthetic fixtures.

## Intended use
Controlled evaluation of ThinkForge reasoning quality and evidence grounding.

## Limitations
The current benchmark remains partly synthetic/template-derived. Human expertise, actual annotation, adjudication, and outcome studies have not yet been collected in this repository.
