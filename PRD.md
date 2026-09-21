# ThinkForge MVP PRD

**Status:** Draft v1 · **Owner:** Suvam Priyaranjan Sahoo

Interview findings below come from a user-provided, mixed-recruitment sample of 10 PM/APM interview records. They are directional qualitative evidence, not representative market estimates. Pilot targets remain hypotheses until measured.

## Problem

Early-career product managers make decisions from scattered notes, chat threads, and gut feel. Assumptions stay hidden, evidence is not connected to a recommendation, and outcomes are not recorded—so teams cannot learn whether a call was right# ThinkForge MVP PRD

**Status:** Draft v1 · **Owner:** Suvam Priyaranjan Sahoo

Interview findings below come from a user-provided, mixed-recruitment sample of 10 PM/APM interview records. They are directional qualitative evidence, not representative market estimates. Pilot targets remain hypotheses until measured.

## Problem

Early-career product managers make decisions from scattered notes, chat threads, and gut feel. Assumptions stay hidden, evidence is not connected to a recommendation, and outcomes are not recorded—so teams cannot learn whether a call was right.

**Discovery signal:** All 10 interview records included a decision where at least one material source, assumption, or rationale was fragmented, hidden, private, or hard to retrieve — and for 7 of 10, a specific source was confirmed lost or its access confirmed uncertain, not merely scattered. All 10 also lacked a *documented* comparison of their original expectation with the outcome (8 of 10 made no comparison at all; the other 2 noticed an informal signal but explicitly never checked or recorded whether it changed their original assumption). See `research/INTERVIEW_SYNTHESIS_2026_Q3.md`.

## User and job

**Primary user:** An APM or PM at an early-stage or mid-size product team who owns and must defend a product decision.

**Job to be done:** “When I need to make a product decision, help me state my assumptions, connect approved evidence, and set up a small test, so I can defend the call and check it later.”

## Five-step MVP loop

1. **Frame** — state the decision and assumptions.
2. **Evidence** — attach supplied or approved sources.
3. **Challenge and recommend** — inspect counterarguments and an evidence-linked recommendation.
4. **Test** — design the smallest reversible experiment.
5. **Learn** — compare prediction with outcome and record learning.

## Non-goals

- Automatic or irreversible decisions.
- Writes to Jira or other external tools.
- Team analytics dashboards, multi-org administration, visible benchmark tooling, or RAG tuning in the PM-facing workflow.
- Claims of improved decisions before the pilot measures them.

## Success and guardrails

North Star: **recorded decision outcomes per active PM per month**.

Initial pilot targets, to be revised after data:

| Measure | Initial target |
|---|---:|
| Started decisions reaching a recommendation | 60% |
| Recommendations with at least two linked evidence items | 80% |
| Recommendations with an experiment | 50% |
| Experiments with an outcome within 30 days | 30% |

Guardrails: no citations to an unknown evidence record; human review before a recommendation counts; cost per decision remains under an approved cap; zero confirmed cross-organization exposure.

## Why these targets (and what they are not)

No baseline exists for these measures, so the targets are thresholds to revise after the first ten pilot decisions, not forecasts. The logic behind each:

| Target | Reasoning | What would change it |
|---|---|---|
| 60% of started decisions reach a recommendation | A decision that never reaches a recommendation is abandoned, so this measures whether the loop is light enough to finish. Interviewees under deadline pressure (5/10) are the stress case. | If small decisions stall, add the lightweight path before adding features. |
| 80% of recommendations have at least two linked evidence items | One source is an anecdote; two is the minimum for the traceability claim. 10/10 participants had fragmented evidence, so this is the core promise. | If users link one item and stop, test whether the evidence form is too costly. |
| 50% of recommendations have an experiment | Not every decision needs a test; a majority should. | If it is far lower, check whether experiments feel disproportionate for small decisions. |
| 30% of experiments have an outcome within 30 days | The hardest step. In the discovery sample 0 of 10 had a documented prediction-to-outcome comparison, so any non-zero rate is an improvement on the observed baseline. | If users never return unprompted, the Learn step needs a reminder or a different trigger. |

## Acceptance criteria by step

| Step | Done when |
|---|---|
| Frame | A decision has a statement, an owner, at least one assumption stored separately from goals and metrics, and a stated confidence. |
| Evidence | Each evidence item has a source, location or URL, owner, access status, and a link to the assumption or decision it supports. |
| Challenge and recommend | The recommendation cites only existing evidence records, shows at least one counterargument, and cannot count until a human reviews it. |
| Test | An experiment has a prediction, a success rule, a guardrail, and a review date. |
| Learn | An observed result is recorded against the prediction, with a mixed or incomplete result allowed, and a note on what changes next. |

## Risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Process overhead outweighs value | P7 called review process overkill for a small decision; 5/10 named deadline pressure. | Test a lightweight path in the pilot; compare against a plain template, not against nothing. |
| Nobody returns to record outcomes | Outcome capture is the North Star and the least-practiced behavior in the sample. | Visible 30-day check-in; measure unprompted returns separately from reminded ones. |
| Sensitive evidence cannot go through AI | P3 and P8 raised privacy constraints unprompted. | The loop must work without external AI; organization control disables external retrieval. |
| Sample is not representative | 10 mixed-recruitment records supplied by the project owner, not independently verified; a prompted AI question. | Treat findings as directional; do not extrapolate to market size or adoption. |
| The tool gives a false sense of rigor | Structured fields can make weak reasoning look defensible. | Show evidence gaps and confidence alongside the recommendation; keep AI advisory. |

## Pilot decision rules (proposed, to be confirmed before data collection)

These are written before any data exists so the result cannot be reinterpreted afterward. The owner should confirm or change the thresholds before the first session.

- **Continue and build:** blind raters score ThinkForge briefs higher than the participant's usual process on at least three of five rubric dimensions in at least 7 of 10 pairs, and at least 3 of 10 participants record an outcome without a reminder.
- **Narrow to a template:** briefs are rated about the same as a good template, but participants prefer the lighter format. Ship the template and drop the workflow.
- **Stop or rethink:** briefs are not rated higher, or fewer than 2 of 10 return to record an outcome even when reminded.
- Any result with ten participants is descriptive. It is not causal, representative, or statistically conclusive.

## Hypotheses not yet tested

These are open hypotheses, not plans. No interview asked about them.

- **Buyer and pricing:** unknown. The interviews did not cover willingness to pay or who would pay.
- **Distribution:** unknown. A team-level or individual entry point has not been tested.
- **Alternatives:** positioning against ChatGPT, docs and roadmap tools is in `PM_POSITIONING.md` and is a hypothesis, not a finding.

## Validation plan

Completed: 10 interviews, analyzed in `research/INTERVIEW_SYNTHESIS_2026_Q3.md`.

Next: demo the five-step loop and record a two-minute walkthrough.

Next: run a 10-person paired pilot using `PILOT_PROTOCOL.md`.

Then: enter pilot and outcome results in `docs/RESULTS.md` and replace case-study placeholders..

**Discovery signal:** All 10 interview records included a decision where at least one material source, assumption, or rationale was fragmented, hidden, private, or hard to retrieve. Ten also lacked a documented comparison of their original expectation with the outcome. See `research/INTERVIEW_SYNTHESIS_2026_Q3.md`.

## User and job

**Primary user:** An APM or PM at an early-stage or mid-size product team who owns and must defend a product decision.

**Job to be done:** “When I need to make a product decision, help me state my assumptions, connect approved evidence, and set up a small test, so I can defend the call and check it later.”

## Five-step MVP loop

1. **Frame** — state the decision and assumptions.
2. **Evidence** — attach supplied or approved sources.
3. **Challenge and recommend** — inspect counterarguments and an evidence-linked recommendation.
4. **Test** — design the smallest reversible experiment.
5. **Learn** — compare prediction with outcome and record learning.

## Non-goals

- Automatic or irreversible decisions.
- Writes to Jira or other external tools.
- Team analytics dashboards, multi-org administration, visible benchmark tooling, or RAG tuning in the PM-facing workflow.
- Claims of improved decisions before the pilot measures them.

## Success and guardrails

North Star: **recorded decision outcomes per active PM per month**.

Initial pilot targets, to be revised after data:

| Measure | Initial target |
|---|---:|
| Started decisions reaching a recommendation | 60% |
| Recommendations with at least two linked evidence items | 80% |
| Recommendations with an experiment | 50% |
| Experiments with an outcome within 30 days | 30% |

Guardrails: no citations to an unknown evidence record; human review before a recommendation counts; cost per decision remains under an approved cap; zero confirmed cross-organization exposure.

## Validation plan

Completed: 10 interviews, analyzed in `research/INTERVIEW_SYNTHESIS_2026_Q3.md`.

Next: demo the five-step loop and record a two-minute walkthrough.

Next: run a 10-person paired pilot using `PILOT_PROTOCOL.md`.

Then: enter pilot and outcome results in `docs/RESULTS.md` and replace case-study placeholders.
