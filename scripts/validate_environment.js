'use strict';

const strict = process.argv.includes('--strict');
const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const optional = ['AI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'];
const configured = Object.fromEntries([...required, ...optional].map((key) => [key, Boolean(process.env[key])]))
const missing = required.filter((key) => !configured[key]);
const issues = [];

if (Boolean(process.env.UPSTASH_REDIS_REST_URL) !== Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)) issues.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together.');
const jira = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'];
if (jira.some((key) => configured[key]) && jira.some((key) => !configured[key])) issues.push('All Jira variables must be configured together.');
if (strict) {
  if (missing.length) issues.push(`Missing required production variables: ${missing.join(', ')}.`);
  if (!configured.UPSTASH_REDIS_REST_URL) issues.push('Durable rate limiting requires the Upstash Redis variables.');
}

console.log(JSON.stringify({ strict, configured, issues }, null, 2));
if (issues.length) process.exitCode = 1;
