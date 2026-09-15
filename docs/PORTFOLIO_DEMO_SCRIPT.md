# 4-minute portfolio demo script

Use the deployed version when it exists. Until then, say **offline demo** before starting and do not describe simulated output as AI research.

1. **Problem (20 sec):** “ThinkForge records the reasoning behind a product decision: evidence, uncertainty, experiment design, and outcomes.”
2. **Product analyst workflow (60 sec):** Open a decision; show an assumption, linked evidence, a challenge question, experiment success criteria, and the decision status.
3. **AI engineer workflow (60 sec):** Upload a small, non-sensitive text file. Search it. Point to the returned document/chunk citation. Explain whether the current response says `lexical_fallback` or `hybrid_rrf`; never imply embeddings are active if they are not.
4. **Agentic workflow (70 sec):** Create a research plan. Show that it stops at `AWAITING_APPROVAL`. Approve it, inspect the event trace and tool call, then show `NEEDS_HUMAN_REVIEW`. Explain that external writes are forbidden tools.
5. **Engineering proof (30 sec):** Show the Django architecture, tests, migration, CI workflow, and environment-variable boundary.

Close with: “The architecture and safety controls are implemented. Claims about research quality, user impact, or production reliability remain pending real users, staged traffic, and measured evaluation.”
