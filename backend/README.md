# ThinkForge Django backend

This directory is the Django/DRF source of truth for the ThinkForge product backend. It replaces the product domain, RAG, agent runtime, tenant permissions, and background processing progressively while the existing frontend remains unchanged.

## What is implemented

- Django 5 + Django REST Framework API with JWT authentication.
- PostgreSQL data model for organizations, memberships, decisions, evidence, experiments, documents, chunks, audit events, agent runs, tool calls, and feedback.
- Server-side organization-role enforcement; clients cannot select their own tenant or role.
- pgvector-ready chunks and Celery/Redis document chunking.
- An auditable, approval-gated research agent. Paid/external research stays simulated until a provider adapter is deliberately configured; it never makes autonomous external writes and ends in human review.
- Optimistic workspace and decision version checks to avoid silent overwrites.

## Run locally

First install Python 3.12+ and Docker Desktop. Copy `.env.example` to `.env`, change the development secret, then from the repository root run:

```powershell
docker compose up --build
```

The API starts at `http://localhost:8000/api/health/`. Docker runs the Django migrations before starting the web service.

For a non-Docker development setup, create a virtual environment from `backend`, install `requirements.txt`, start PostgreSQL with the pgvector extension and Redis, then run:

```powershell
python manage.py migrate
python manage.py test apps.core.tests
python manage.py runserver
celery -A config worker --loglevel=INFO
```

`python manage.py test apps.core.tests` uses an isolated SQLite database automatically, so it can run before PostgreSQL is installed. Running the app, migrations, RAG vector search, or Celery against the production configuration still requires PostgreSQL with pgvector and Redis.

## Frontend cutover

Leave `djangoApiBase` blank when Django is reverse-proxied at the same origin (`/api`). For a separately served frontend, set `state.settings.djangoApiBase` to `http://localhost:8000` once in browser storage or add an equivalent Settings field. The existing Offline Demo Mode continues to work with no services or paid API keys.

Do not remove the Node/Vercel API directory until these checks pass in staging: data import verified, frontend API contract smoke tests pass, and a rollback deployment is available. The compatibility routes introduced here cover the core Django migration; discovery, evaluation, Jira, and Supabase-auth replacement should be cut over only after their data contracts have been migrated and tested.

## Production checklist

- Use a managed PostgreSQL service with pgvector, a managed Redis service, backups, and point-in-time restore.
- Set `DJANGO_DEBUG=false`, a strong unique `DJANGO_SECRET_KEY`, explicit `DJANGO_ALLOWED_HOSTS`, HTTPS, secure cookies, and restrictive CORS origins.
- Put Django behind a TLS reverse proxy and serve the current static frontend from the same origin.
- Create a proper server-side AI provider adapter only after deciding on data-retention, cost caps, rate limits, prompt-injection handling, and evaluation gates.
- Add S3-compatible object storage and malware scanning before accepting arbitrary production uploads.
