#!/usr/bin/env node
// Runs one real decision through the live ThinkForge Django API and appends a
// structured record to eval/decision_log.jsonl. Requires the stack to actually
// be running (see docs/LOCAL_SETUP_GUIDE.md) — this makes real HTTP calls, it
// does not simulate anything or fabricate a result.
//
// Usage:
//   node scripts/capture_decision_run.js \
//     --goal "Should MediFlowRT add feature X?" \
//     --org <organization-id> \
//     [--base http://localhost:8000] [--username you] [--password ...]
//
// Auth: pass --username/--password (uses /api/auth/token/), or set
// THINKFORGE_ACCESS_TOKEN in the environment to skip the token call.

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { out[key] = true; }
      else { out[key] = next; i += 1; }
    }
  }
  return out;
}

async function getToken(base, username, password) {
  const res = await fetch(`${base}/api/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access;
}

async function runDecision({ base, token, organizationId, goal }) {
  const started = Date.now();
  const res = await fetch(`${base}/api/agent/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': `capture-${Date.now()}`,
    },
    body: JSON.stringify({
      organizationId,
      action: 'run',
      approved: true,
      input: { goal },
    }),
  });
  const latencyMs = Date.now() - started;
  const body = await res.json();
  if (!res.ok) throw new Error(`Agent call failed: ${res.status} ${JSON.stringify(body)}`);
  return { body, latencyMs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = args.base || 'http://localhost:8000';
  const goal = args.goal;
  const organizationId = args.org;
  if (!goal || !organizationId) {
    console.error('Usage: node scripts/capture_decision_run.js --goal "..." --org <organization-id>');
    process.exit(1);
  }

  let token = process.env.THINKFORGE_ACCESS_TOKEN;
  if (!token) {
    if (!args.username || !args.password) {
      console.error('No THINKFORGE_ACCESS_TOKEN set and no --username/--password given.');
      process.exit(1);
    }
    token = await getToken(base, args.username, args.password);
  }

  const { body, latencyMs } = await runDecision({ base, token, organizationId, goal });
  const run = body.result;

  const record = {
    capturedAt: new Date().toISOString(),
    goal,
    organizationId,
    runId: run.id,
    finalState: run.state,
    latencyMs,
    plan: run.plan,
    // These stay unset until you fill them in by hand after reviewing the run —
    // this script logs what the system did, not a judgment about whether the
    // assumption it surfaced was one you'd already thought of.
    assumptionCaught: null,
    recommendationMatchedOutcome: null,
    notes: '',
  };

  const logPath = path.resolve('eval/decision_log.jsonl');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);

  console.log(`Run ${run.id} finished in state ${run.state} (${latencyMs}ms).`);
  console.log(`Logged to ${logPath}.`);
  console.log('Next: review the run, then edit that line to fill in assumptionCaught / recommendationMatchedOutcome / notes.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
