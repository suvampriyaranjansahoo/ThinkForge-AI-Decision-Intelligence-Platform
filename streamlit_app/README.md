# ThinkForge Streamlit Deployment

This is a Streamlit deployment adapter for ThinkForge. It keeps the existing JavaScript/Vercel backend as the authoritative application/API layer and uses Streamlit as the presentation shell.

## Local run

```bash
cd streamlit_app
python -m pip install -r requirements.txt
streamlit run app.py
```

## Streamlit Cloud

Deploy `streamlit_app/app.py` from GitHub. Add these optional secrets/environment variables in the deployment settings:

- `THINKFORGE_API_URL`: deployed ThinkForge API base URL
- `THINKFORGE_AUTH_TOKEN`: optional bearer token for development/demo environments

For production, prefer your existing authentication/session layer rather than putting a long-lived user credential in a Streamlit secret.

## Architecture

```text
Streamlit UI
   ↓
ThinkForge Vercel API
   ↓
Supabase / Postgres
   ↓
LLM + RAG + governance + evaluation
```

The local benchmark pages load frozen project artifacts directly for demonstration. No synthetic benchmark is represented as human empirical evidence.

## Authentication boundary
The Streamlit shell does not implement identity management. For production, put authentication/session management in front of the ThinkForge API and use a short-lived session token. The UI token field is intended only for controlled development/demo use.
