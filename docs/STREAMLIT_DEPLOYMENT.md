# Streamlit Deployment

ThinkForge uses Streamlit as a presentation/deployment shell while the existing JavaScript API/domain layer remains authoritative.

## Entry point
`streamlit_app/app.py`

## Local
```bash
python -m pip install -r streamlit_app/requirements.txt
streamlit run streamlit_app/app.py
```

## Streamlit Community Cloud
Deploy `streamlit_app/app.py` from the repository. Configure `THINKFORGE_API_URL` through Streamlit secrets/environment configuration.

The API bearer token field is intentionally for controlled development/demo use only. For production, authentication/session management must be enforced at the API or an upstream identity-aware proxy, and long-lived user credentials must not be committed to the repository.

## Packaging
The deployment artifact intentionally excludes `node_modules/`, Python bytecode caches, local environment files, and other build-time noise. Node dependencies are installed with `npm ci` from the committed lockfile when the JavaScript backend is deployed separately.
