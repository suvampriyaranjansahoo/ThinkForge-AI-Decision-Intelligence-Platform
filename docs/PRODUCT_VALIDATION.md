# ThinkForge Product Validation

**Study:** ThinkForge Decision Quality Validation Study  
**Version:** 2.0  
**Prepared:** 2026-09-21  
**Status:** Discovery evidence documented; supplied qualitative review provenance-sensitive; paired product-validation pilot pending  
**Population:** Early-career APM/PM practitioners  
**Target pilot:** 10–20 participants  

> **Evidence rule:** Real observations are separated from illustrative dry-run data. No pilot outcome is claimed until collected from participants.

---

## 1. Executive readout

ThinkForge is designed around a specific product-decision failure mode: a decision may be remembered, while the assumptions, evidence, alternatives, and expected outcome become difficult to retrieve or compare later.

The current discovery sample contains **10 PM/APM interview records**. It provides directional problem evidence, not proof of product impact. The next evidence step is a paired study comparing each participant's normal decision process with the ThinkForge workflow, followed by blinded artifact rating and outcome follow-up.

### Current evidence scoreboard

| Evidence layer | Status | What it supports |
|---|---|---|
| Problem discovery | **Observed** | Problem exists in the sampled interviews |
| Disconfirming evidence | **Observed** | Problem is not universal; workflow intensity needs testing |
| Product workflow | **Built** | Solution can be exercised in a controlled environment |
| Engineering reliability | **Tested** | Core software behavior has automated coverage |
| Retrieval evaluation infrastructure | **Built** | Search/RAG quality can be measured offline |
| Comparative decision-quality study | **Pending** | Whether ThinkForge outperforms normal workflow |
| Behavioral follow-up | **Pending** | Whether users revisit predictions/outcomes |
| Business impact | **Not established** | Requires real deployment and observed outcomes |

### Claim boundary

Before the paired study is run, the repository should **not** claim that ThinkForge improves decisions, saves time, increases adoption, or improves business outcomes.

---

## 2. Problem validation already available

The discovery synthesis reports these directional counts across **10 PM/APM interview records**:

| Finding | Observed |
|---|---:|
| Described fragmented/hidden/hard-to-retrieve source, assumption, or rationale | **10/10** |
| Named a source that was lost or access was uncertain | **7/10** |
| Lacked documented expected-vs-observed comparison | **10/10** |
| Had weak/non-durable assumption records | **7/10** |
| Strict subset where assumptions were effectively lost | **5/10** |
| Reported giving stakeholders higher confidence than privately held | **5/10** |
| Mentioned deadline/commercial pressure unprompted | **5/10** |
| Raised data privacy/sharing constraints unprompted | **2/10** |
| Accepted advisory-only AI boundary when prompted | **10/10** |

### Interpretation

The strongest repeated signal is **not** simply “PMs do not document decisions.” The more precise problem is that decision context is distributed and the learning loop is weak: sources, assumptions, rationale and expected-vs-observed outcomes can disappear across tools and over time.

That distinction matters because a heavy workflow could create more friction than value for small decisions.

---

## 3. Disconfirming evidence

The research also contains evidence against an overly broad problem statement:

- **4/10** participants already had structured formal records.
- **1 participant** described a review process as “overkill” for a small toggle.
- Therefore, the product hypothesis should not be “every decision needs a full decision record.”
- The narrower hypothesis is that a **lightweight, evidence-linked decision loop is valuable for consequential decisions where assumptions, trade-offs, or outcomes are otherwise likely to be lost.**

This is why the pilot measures **usefulness and friction**, not completion alone.

---

## 4. Product hypotheses

### Primary hypothesis

> For product decisions consequential enough to revisit later, ThinkForge will produce a more complete and traceable decision record than a participant's normal workflow without adding unacceptable process friction.

### Secondary hypotheses

**H1 — Evidence grounding:** key recommendations will be easier to trace to supplied evidence.

**H2 — Experimentation:** participants will define smaller, more explicit reversible tests with measurable success rules.

**H3 — Learning:** participants will be more likely to record the original prediction and compare it with the observed outcome.

**H4 — Reuse:** the workflow will be lightweight enough that participants would use it again for similar decisions.

---

## 5. Study design

### Participants

Recruit **10–20 consenting PM/APM participants** with responsibility for making or defending product decisions.

Capture only the minimum necessary:
- participant ID;
- experience band;
- coarse product/team context;
- prior use of structured decision records;
- confidentiality constraints relevant to the task.

### Paired comparison

Each participant completes two difficulty-matched decision tasks:

**Control:** participant uses their normal process and normal tools.

**ThinkForge:** participant uses the five-step ThinkForge workflow.

Use different scenarios to reduce memory effects. Counterbalance the order:

| Cohort | First | Second |
|---|---|---|
| A | Control | ThinkForge |
| B | ThinkForge | Control |

The primary analysis unit is the **paired participant**.

---

## 6. Task construction

Every scenario should contain:
- one clear decision;
- enough evidence for a defensible call;
- at least two plausible alternatives;
- one meaningful uncertainty or trade-off;
- a feasible reversible test;
- a realistic observation window.

Avoid scenarios requiring confidential company data.

### Example scenario

> A mobile product sees a 14% abandonment rate at a particular onboarding step. The team is considering either simplifying the step or preserving it and adding contextual guidance. Decide what to do next.

Participants receive the same evidence packet. The ThinkForge condition gets the product workflow; the Control condition does not.

---

## 7. ThinkForge workflow under test

### Frame
State the decision, assumptions, confidence and context.

### Evidence
Attach sources with identifiable location and access status.

### Challenge & Recommend
Surface counterarguments and create an evidence-linked recommendation. AI assistance remains advisory; a human reviews the recommendation.

### Test
Define the smallest reversible experiment, prediction, metric, success rule and time horizon.

### Learn
Record the observed outcome, compare it against the prediction and state what changed.

---

## 8. Frozen evaluation rubric

Two independent blinded raters score each final artifact from **1–5** on eight dimensions.

| Dimension | 1 — Weak | 3 — Adequate | 5 — Strong |
|---|---|---|---|
| Problem clarity | Decision unclear | Understandable | Precise and bounded |
| Assumption quality | Missing/implicit | Main assumptions stated | Explicit and testable |
| Evidence traceability | Unsupported | Some support traceable | Key claims traceable |
| Trade-off clarity | Alternatives absent | Main trade-off stated | Alternatives + consequences explicit |
| Counterargument quality | No challenge | Plausible challenge | Disconfirming cases addressed |
| Experiment quality | No actionable test | Test exists but vague | Small, reversible, measurable |
| Prediction specificity | No prediction | Directional | Observable + time-bounded |
| Outcome plan | No follow-up | Follow-up mentioned | Owner/time/comparison defined |

**Maximum:** 40 points per rater.

### Grounding-failure flag

Flag an artifact separately if it invents or materially misrepresents:
- a source;
- a metric;
- a quote;
- an experiment result;
- an outcome;
- an evidence-supported claim.

A grounding failure is reported separately from the 40-point score.

---

## 9. Measures

### Primary outcome

**Blinded decision-artifact quality score.**

### Secondary workflow measures

- recommendation completion;
- evidence-link count;
- experiment creation;
- prediction recorded;
- outcome plan recorded;
- completion time;
- perceived effort;
- perceived usefulness;
- confidence before/after.

### Follow-up

At approximately **7 days**:
- decision acted on;
- experiment started;
- record revisited.

At approximately **30 days**:
- outcome observed;
- prediction compared with outcome;
- assumption changed;
- follow-up decision recorded.

Missing outcomes are `NOT_COLLECTED`, never estimated.

---

## 10. Analysis plan

Report paired observations before aggregate headlines.

Minimum readout:
- sample size;
- completion rate;
- mean/median quality-score difference;
- per-dimension differences;
- evidence-link rate;
- experiment rate;
- prediction rate;
- outcome-follow-up rate;
- grounding-failure count;
- completion-time difference;
- effort/usefulness;
- rater reliability and disagreement.

Where statistically appropriate, report a confidence interval and paired test. If assumptions for a statistical test are not met, use descriptive paired analysis and state the limitation.

### Missing-data policy

Use:
- `NOT_STARTED`
- `NOT_COMPLETED`
- `NOT_APPLICABLE`
- `NOT_COLLECTED`

Do not convert missing observations into zero.

---

## 11. Predefined product decision rules

These are **interpretation rules, not current results**.

### Continue / build

Consider this interpretation only when:
- ThinkForge is rated higher on at least 3 of 5 core quality dimensions in at least 7/10 paired cases; **and**
- at least 3/10 participants independently record a real outcome without researcher prompting.

### Narrow to lighter template

Consider this interpretation when:
- quality is similar to a strong normal/template workflow;
- participants prefer a lighter process;
- added friction is not justified by observed benefit.

### Stop / rethink

Consider this interpretation when:
- predefined quality dimensions show no meaningful advantage;
- grounding failures are recurrent;
- workflow completion is unreliable;
- or follow-up behavior does not support the learning-loop hypothesis.

The actual conclusion must follow the collected evidence, including contradictory evidence.

---

## 12. Quality controls

### Before collection
Freeze task wording, rubric, eligibility, randomization, evidence-link rules, completion criteria and anonymized artifact IDs.

### During collection
Do not coach participants toward a preferred decision. Record deviations and preserve original artifacts.

### After collection
Lock the raw dataset, document exclusions, compute from raw observations and record protocol amendments.

---

## 13. Evidence hierarchy

The repository should distinguish:

**Observed → Built → Evaluated → Compared → Outcome-validated**

Current position:

**Observed:** discovery evidence  
**Built:** workflow + evaluation infrastructure  
**Evaluated:** software/RAG quality infrastructure  
**Compared:** pending participant study  
**Outcome-validated:** pending real-world follow-up

---

## 14. Repository evidence map

| Artifact | Purpose |
|---|---|
| `research/INTERVIEW_SYNTHESIS_2026_Q3.md` | Discovery synthesis |
| `research/INTERVIEW_EVIDENCE_LOG_2026_Q3.md` | Interview evidence trail |
| `docs/PM_CASE_STUDY.md` | Product reasoning and decisions |
| `PILOT_PROTOCOL.md` | Participant study protocol |
| `PM_RICE_ROADMAP.md` | Prioritization rationale |
| `docs/PRODUCT_VALIDATION.md` | Full validation framework |
| `eval/product_validation_rubric.md` | Blinded scoring |
| `eval/discovery_evidence.csv` | Populated discovery evidence |
| `eval/product_validation_template.csv` | Real pilot capture |
| `eval/product_validation_dry_run.csv` | Synthetic operational test only |
| `docs/VALIDATION_READOUT_TEMPLATE.md` | Results reporting |

---

## 15. Current status

| Item | Status |
|---|---|
| Problem evidence | **Documented** |
| Disconfirming evidence | **Documented** |
| Study design | **Defined** |
| Rubric | **Defined** |
| Data schema | **Defined** |
| Dry run | **Completed as synthetic data only** |
| Participant pilot | **Pending** |
| Blinded ratings | **Pending** |
| 30-day outcomes | **Pending** |
| Validated product impact | **Not established** |


---

## Provenance guardrail

The 10-record discovery synthesis is distinct from the supplied P1–P10 qualitative product-review materials. Do not merge those evidence layers. The paired Control-vs-ThinkForge pilot is still required for comparative product-effectiveness claims.
