# ThinkForge — Results

This is the single page that turns ThinkForge from "a system I built" into "a system I proved works."
It stays empty (structurally, not aspirationally) until real decisions have been run through it.
Do not fill numbers in here that weren't produced by running `npm run research readiness` /
`npm run stage1:empirical` / an actual `/api/decision` call against real input. That's the entire
point of the evidence-gate policy in the README — this file is bound by the same rule.

## How to fill this in (~2-3 hours, once)

1. Pick 10-15 real decisions — use your own other projects as the test cases:
   should MediFlowRT add feature X, was PlaceMate's scope right, is the bankruptcy
   screener worth extending, etc. Real questions you actually had to answer.
2. Run each one through the ThinkForge decision workspace (`vercel dev` locally is enough,
   you don't need it deployed for this).
3. For each case, record: the assumption ThinkForge surfaced, whether it was one you'd
   already considered or one it caught that you hadn't, the recommendation, and — for
   cases where you already know the outcome — whether the recommendation matched what
   actually happened.
4. Fill the table below. Leave rows blank rather than inventing numbers.

## Summary

| Metric | Value |
|---|---|
| Real decisions run | — |
| Decisions where ThinkForge surfaced an assumption you'd missed | — |
| Decisions where the evidence-strength score changed your call | — |
| Decisions where predicted vs. actual outcome was recorded | — |
| Decisions where the recommendation matched the actual outcome | — |

## Case log

| # | Decision | Assumption caught? | Recommendation | Actual outcome (if known) | Match? |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

## What this proved / didn't prove

_One paragraph, written after the real runs, not before. What surprised you. Where
ThinkForge's judgment was better than your own gut call, and where it wasn't. This
paragraph — not the table — is what you say out loud in an interview._

## Discovery evidence already collected

This project has a separately documented, user-provided qualitative discovery sample of 10 PM/APM interview records. It informed the five-step MVP scope: visible assumptions, traceable evidence, advisory recommendations, reversible experiments, and outcome review. It is directional research, not product-impact evidence. See `../research/INTERVIEW_EVIDENCE_LOG_2026_Q3.md` and `../research/INTERVIEW_SYNTHESIS_2026_Q3.md`.

## Relationship to the evaluation layer

This page is deliberately separate from `eval/external_gold/` and the human-annotation
gold-layer pipeline. The public repository contains its evaluation infrastructure and
some frozen assets; the confidential capstone layer is intentionally excluded. Treat
repository evaluation results as model-quality evidence only after their source assets
and integrity checks pass. This page answers a different, still-open product question:
whether *ThinkForge as a product* helps people make better calls day to day. Do not use
either type of evidence as a substitute for the other. See `../KNOWN_REPOSITORY_GAPS.md`.
