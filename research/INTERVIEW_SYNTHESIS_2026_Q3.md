# ThinkForge discovery synthesis: 10 PM interviews

## Research overview

**Method:** Semi-structured interviews supplied as notes by the project owner. **Window:** 2026-07-22 to 2026-09-15. **Sample:** 10 product practitioners spanning pre-seed through public companies and 1–10 years of experience. Recruitment mixed cold outreach, referrals, panels, communities, and networks. This is a directional qualitative sample, not representative research.

**Research question:** Can PMs reconstruct why a decision was made, what evidence it relied on, and what happened afterward? What would make a decision record useful rather than process overhead?

## Findings

### 1. Every participant described missing a formal prediction-to-outcome review (10/10)

Participants often knew something happened after launch, but none described a documented comparison of the initial expectation with the observed outcome. The pattern appeared in decisions ranging from feature sunsets to enterprise compliance choices.

Consent-safe evidence: P1 said, "We just... moved on. Next fire, you know?" P10 said the team noticed different beta results but "didn't document whether it invalidated anything."

**Product implication:** Keep a prediction and success rule in the decision record, then create a visible 30-day outcome check-in. The outcome may be mixed or incomplete.

### 2. Decision evidence was fragmented across tools, private storage, or ephemeral conversations (10/10)

Each participant named at least one important source that was hard to retrieve, unshared, lost, buried in comments/DMs, stored locally, or subject to unclear retention and permissions. The issue was not the absence of data. It was the loss of traceability between the source and the decision.

Consent-safe evidence: P4 said, "Link the damn blog post in Jira. 'Source: industry research' is useless six months later." P10 had links but was unsure whether others could access them.

**Product implication:** An evidence record needs source, location/URL, owner, access status, and a link to the assumption or decision it supports. Do not promise that an uploaded source is broadly accessible.

### 3. Assumptions were often absent, hidden, partial, or stored in a non-durable place (7/10)

P1, P2, P5, P6, P7, P8, and P9 described assumptions that were undocumented, mixed into another field, kept verbally, thrown away, or difficult to use later. The remaining participants had at least some written assumptions, which is important disconfirming evidence: teams can create a record, but it is often incomplete.

Consent-safe evidence: P7 said, "Not labeled 'Assumptions.' Just in Success Metrics. So... written but hidden?"

**Product implication:** Ask for explicit assumptions in the framing step and keep them separate from goals, metrics, and notes. Make the field lightweight enough for a fast decision.

### 4. Five participants openly described overstating confidence (5/10)

P1, P2, P4, P5, and P6 gave a higher confidence number to stakeholders than the confidence they described privately. This is an early signal, not proof that PMs generally misrepresent confidence. P3, P8, P9, and P10 also described uncertainty, but did not report the same public/private gap.

Consent-safe evidence: P6 said, "You can't show doubt as a founder." He later described the call as a "Hail Mary."

**Product implication:** Separate confidence from recommendation. Let users record confidence, evidence gaps, and the condition that would change their mind.

### 5. All participants set a boundary around AI decision authority (10/10, prompted)

The AI question was asked directly, so this is a stated preference under prompting. Participants who had used AI described it for drafting, questionnaire help, whitepaper review, documentation, or mockups. They consistently rejected final autonomous decision-making.

Consent-safe evidence: P3 said, "Advisory only—compliance needs human sign-off." P1 said, "Never make the actual call."

**Product implication:** Keep AI advisory. Show sources and limitations, require human review, and make external writes unavailable in the MVP.

### 6. Time and commercial pressure shaped decisions for at least five participants (5/10)

P2, P4, P5, P6, and P10 explicitly named a launch, churn, runway, speed, or commercial deadline. The finding explains why a lighter workflow needs testing. It does not prove every PM will reject a fuller record.

Consent-safe evidence: P2 described a 48-hour decision under commercial pressure (P2 did not consent to publication of a direct quote).

**Product implication:** Support a rapid decision capture path. Test whether a template is sufficient for small decisions before adding more workflow.

### 7. Privacy and sharing constraints surfaced without being prompted for two participants (2/10)

P3 and P8 raised data-privacy constraints themselves. The count is low, but the risk is high because it constrains whether AI features can be used with sensitive evidence.

**Product implication:** Provide a clear data-handling explanation and an organization control that disables external retrieval/embeddings. Do not make external AI necessary for the MVP loop.

## Contradictions and limits

- P3, P7, P9, and P10 show that formal records already exist in larger or more structured settings. The problem is not simply “teams do not document.” It is that assumptions, decision rationale, and follow-up are distributed across systems.
- P7 described review process as overkill for a toggle. A full workflow may be wrong for small decisions.
- This study does not establish willingness to pay, actual adoption, time saved, or whether ThinkForge improves decision quality.

## Product decisions from the evidence

| Decision | Action | Evidence |
|---|---|---|
| Five-step loop | Keep | Fragmented evidence, hidden assumptions, and missing outcome checks were repeatedly described. |
| Assumption field | Keep visible in Frame | 7/10 described a weak or non-durable assumption record. |
| Evidence metadata and links | Build for MVP | 10/10 named fragmented, inaccessible, or ephemeral evidence. |
| Prediction and outcome check-in | Build for MVP | 10/10 lacked a documented prediction-to-outcome comparison. |
| AI recommendation | Keep advisory and reviewable | All 10 articulated a non-autonomous AI boundary when prompted. |
| External AI/RAG | Hide from PM MVP | Privacy concerns and the core problem do not require it. |
| Jira export, benchmarks, governance surfaces | Hide from PM MVP | No interview evidence supports these as the first user-facing workflow. |
| Lightweight path | Test in pilot | Pressure was common, while P7 explicitly warned against over-process. |

## Open questions for the pilot

1. Does the five-step loop improve a decision brief over a simple document template?
2. How long does it take for a small versus high-stakes decision?
3. Do users return to record an outcome without a reminder?
4. Which evidence metadata fields are worth the cost of entry?
5. Does a visible confidence/evidence-gap field change stakeholder discussion?
