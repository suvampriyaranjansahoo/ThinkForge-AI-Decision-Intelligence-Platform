# Deploy ThinkForge to GitHub + Vercel

## 1. GitHub

Create a repository named `thinkforge` and push the extracted contents of this folder. Do not push `.env` or `.env.local`.

```bash
git init
git add .
git commit -m "Build ThinkForge 15-stage decision intelligence MVP"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2. Vercel

Import the GitHub repository into Vercel. The project requires no build command because the frontend is static and `/api/*.js` are Vercel serverless functions.

Or:

```bash
npm install -g vercel
vercel
vercel --prod
```

## 3. Environment variables

Set the following in Vercel → Project → Settings → Environment Variables:

```text
AI_API_KEY
AI_BASE_URL
AI_MODEL
AI_EMBEDDING_MODEL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
POSTHOG_KEY
POSTHOG_HOST
JIRA_BASE_URL
JIRA_EMAIL
JIRA_API_TOKEN
JIRA_PROJECT_KEY
```

### Secret handling

Do not expose:

- `AI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JIRA_API_TOKEN`

The browser only receives the Supabase anon key and PostHog project key where configured.

## 4. Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. Enable email confirmation in Auth settings for a public app. The schema contains row-level-security policies for user-owned workspace/document/chunk data.

## 5. RAG

For server-side vector retrieval, configure `AI_API_KEY`, `AI_EMBEDDING_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The `/api/rag` route verifies the user's access token through Supabase Auth before using the service-role connection for scoped writes/queries.

## 6. Jira

Configure Jira credentials only in Vercel. The current implementation is suitable for a portfolio deployment using a controlled Jira service account. A commercial multi-tenant SaaS should replace this with a proper Atlassian OAuth app and per-tenant connections.

## 7. Health check

After deployment, open:

`/api/health`

You should receive a JSON response showing which integrations are configured.

## 8. Manual smoke test

Create a decision and confirm:

1. Assumptions generate or can be entered.
2. Evidence can be attached.
3. Challenges generate.
4. Experiment can be saved.
5. Prediction and actual can be recorded.
6. Insights update.
7. Evaluation benchmark runs.
8. Analytics event count increments.
9. RAG indexes/searches text evidence.
10. PRD can be generated with AI configured.
11. Jira work can be created when Jira env vars are present.
