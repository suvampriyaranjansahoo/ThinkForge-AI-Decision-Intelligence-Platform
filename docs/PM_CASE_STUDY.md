# ThinkForge: a five-step decision record for early-career PMs

**Role:** solo product owner, research, and builder · **Status:** MVP built, discovery done, pilot not yet run
**Read time:** about 5 minutes

## In one paragraph

Early-career PMs make decisions from scattered notes, chat threads and gut feel. I worked from 10 PM/APM interview records and found the same pattern in every one: a decision where a source, assumption or rationale was hard to retrieve, and no documented comparison of what they expected with what happened. I scoped an MVP that keeps one decision's reasoning trail in a five-step loop, cut everything the interviews did not support, and wrote a paired pilot to test whether it beats a plain template. I have **not** yet shown that it improves decisions. This page separates what I learned from what I still have to prove.

## The problem

A PM who owns a decision usually cannot later answer three questions: why did we decide this, what did we rely on, and were we right? The discovery sample describes exactly that gap.

## What I learned (10 interview records, directional only)

The records were supplied by the project owner; recruitment, identity and consent have not been independently verified, and I say so wherever I cite them.

The sample mixes cold outreach, referrals, panels and communities, spans pre-seed to public companies and 1–10 years of experience, and is not representative. Counts are descriptive.

| Finding | Count |
|---|---:|
| Had a decision with a fragmented, hidden or hard-to-retrieve source, assumption or rationale | 10/10 |
| Named a source as confirmed lost or with uncertain access | 7/10 |
| Had no *documented* comparison of expected vs. observed outcome | 10/10 (8 made no comparison at all; 2 noticed informally and never recorded it) |
| Had a weak or non-durable assumption record | 7/10 (5/10 under the stricter "effectively lost" reading) |
| Described giving stakeholders higher confidence than they held privately | 5/10 |
| Named deadline or commercial pressure unprompted | 5/10 |
| Raised a data-privacy constraint unprompted | 2/10 |
| Set an advisory-only boundary on AI (asked directly, so prompted) | 10/10 |

Consented quotes I can use: "We just... moved on. Next fire, you know?" (P1) and "Link the damn blog post in Jira. 'Source: industry research' is useless six months later." (P4). Three participants declined quote attribution, so their words are paraphrased or omitted.

**Disconfirming evidence:** four participants worked in structured environments where formal records already existed, and one called review process "overkill" for a small toggle. The problem is not that teams do not document. It is that assumptions, rationale and follow-up are spread across systems, and a heavy workflow may be wrong for small decisions.

Full method, coding rules and limits: [evidence log](../research/INTERVIEW_EVIDENCE_LOG_2026_Q3.md) and [synthesis](../research/INTERVIEW_SYNTHESIS_2026_Q3.md).

## What I decided, and why

| Decision | Choice | Evidence |
|---|---|---|
| Core workflow | Five steps: frame, evidence, challenge and recommend, test, learn | Fragmented evidence, hidden assumptions and missing outcome checks recurred |
| Assumptions | A visible field, separate from goals and metrics | 7/10 had a weak or non-durable record |
| Evidence | Record source, location, owner, access status and link to the assumption | 10/10 named fragmented or inaccessible evidence |
| Outcomes | Store a prediction and success rule, then a 30-day check-in | 10/10 lacked a documented comparison |
| AI | Advisory only, reviewable, no external writes | 10/10 said so when asked |
| RAG, benchmarks, Jira export | Hidden from the PM workflow | No interviewee asked; privacy raised by 2/10; external writes are a non-goal |
| Lightweight path | Test in the pilot rather than assume | Pressure was common, and P7 warned against over-process |

The prioritization table is in [PM_RICE_ROADMAP.md](../PM_RICE_ROADMAP.md). Its reach scores come straight from the interview counts; impact, confidence and effort are my judgment and are labeled as such.

## What I chose not to build

The repository also contains substantial technical infrastructure (an approval-gated agent runtime, an audit chain, retrieval, an evaluation layer). The interview records did not support any of it as the first PM-facing workflow, so I hid it from the MVP instead of selling it. The cost is that the repository holds far more than the MVP needs, and a reviewer has to look past it to find the product.

## How I will know if it works

North Star: **recorded decision outcomes per active PM per month.** Pilot targets are 60% of started decisions reaching a recommendation, 80% of recommendations with two or more linked evidence items, 50% with an experiment, and 30% of experiments with an outcome within 30 days. These are thresholds to revise, not forecasts; the reasoning for each is in the [PRD](../PRD.md).

The pilot is a 10-person paired comparison against the participant's usual process, scored by two blinded raters on a fixed rubric, with decision rules written before any data exists. Protocol: [PILOT_PROTOCOL.md](../PILOT_PROTOCOL.md). Rubric, consent brief and data template: [pilot/](../pilot/).

## Status

| Item | Status |
|---|---|
| Discovery interviews (10) | Done |
| PRD, RICE roadmap, positioning, funnel metrics | Done |
| MVP workflow in the app | Built; demo data only |
| Two-minute walkthrough video | Not yet recorded |
| Paired pilot | Protocol and kit ready; no participants yet |
| Any claim about decision quality, time saved or adoption | **None made** |

## Pilot results

_To be filled in from `docs/RESULTS.md` after the pilot. Until then, no result is claimed._

## What I would do next

1. Record the walkthrough and put the link at the top of the README.
2. Run the pilot exactly as written, then apply the pre-committed decision rules, including the option to conclude that a template is enough.
3. Ask the questions the interviews did not: who pays, who owns the tool in a team, and how often decisions of each size occur.

## What I learned about my own process

The strongest evidence I have is negative-space evidence: nobody documented outcomes. The weakest thing I could do is claim the tool fixes that before a single person has used it. Keeping that line visible, in every document, is the discipline this project is meant to show.
