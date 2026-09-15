# Free Offline Demo Mode

ThinkForge can be demonstrated locally with no API keys, database, login, or paid provider.

## Run it

```powershell
npm install
npx vercel dev
```

Open the local URL printed by Vercel. Leave every environment variable empty.

## What works free

- Sample decisions, research workspace, evidence capture, experiments, outcomes, and analytics stored in browser local storage.
- Local lexical RAG for uploaded text, Markdown, CSV, JSON, and log files.
- Deterministic offline suggestions for assumptions, challenges, experiments, synthesis, and PRD outlines.
- Offline agent planning and approval-gated simulated research traces.
- Agent-policy, migration, and unit-test suites.

## What intentionally does not claim to work offline

- Live LLM calls, embeddings, Tavily/web retrieval, hosted authentication, tenant enforcement, and persistent agent telemetry.
- Offline suggestions are labeled `deterministic-demo`; they are not model outputs, user research, or verified product findings.

## Demo sequence

1. Open **Research agent** and create a plan without entering an organization ID.
2. Select **Approve & run** to show the explicit paid-research approval boundary and a simulated trace.
3. Open **Research**, add/inspect sample evidence, and run deterministic analysis.
4. Upload a `.txt` or `.csv` file in **Evidence RAG** and search it locally.
5. Open a decision, generate an offline experiment, then record an outcome.

Use the built-in data only as a product demonstration. Replace it with real, consented research before claiming user insights or business impact.
