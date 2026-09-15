#!/usr/bin/env node
// Rewrites the "## Summary" and "## Case log" tables in docs/RESULTS.md from
// eval/decision_log.jsonl. Never invents a row: if the log is empty, the
// tables stay exactly as empty as the template already specifies.
//
// Usage: node scripts/render_results_md.js

import fs from 'node:fs';
import path from 'node:path';

const LOG_PATH = path.resolve('eval/decision_log.jsonl');
const RESULTS_PATH = path.resolve('docs/RESULTS.md');

function loadRecords() {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs
    .readFileSync(LOG_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function buildSummary(records) {
  const total = records.length;
  const assumptionCaught = records.filter((r) => r.assumptionCaught === true).length;
  const evidenceChangedCall = records.filter((r) => r.evidenceChangedCall === true).length;
  const outcomeRecorded = records.filter((r) => r.recommendationMatchedOutcome !== null && r.recommendationMatchedOutcome !== undefined).length;
  const outcomeMatched = records.filter((r) => r.recommendationMatchedOutcome === true).length;

  const cell = (n) => (total === 0 ? '—' : String(n));

  return [
    '| Metric | Value |',
    '|---|---|',
    `| Real decisions run | ${total === 0 ? '—' : total} |`,
    `| Decisions where ThinkForge surfaced an assumption you'd missed | ${cell(assumptionCaught)} |`,
    `| Decisions where the evidence-strength score changed your call | ${cell(evidenceChangedCall)} |`,
    `| Decisions where predicted vs. actual outcome was recorded | ${cell(outcomeRecorded)} |`,
    `| Decisions where the recommendation matched the actual outcome | ${cell(outcomeMatched)} |`,
  ].join('\n');
}

function buildCaseLog(records) {
  const header = ['| # | Decision | Assumption caught? | Recommendation | Actual outcome (if known) | Match? |', '|---|---|---|---|---|---|'];
  if (records.length === 0) {
    return header.concat(['| 1 | | | | | |', '| 2 | | | | | |', '| 3 | | | | | |']).join('\n');
  }
  const rows = records.map((r, i) => {
    const rec = r.plan?.goal || r.goal || '';
    const caught = r.assumptionCaught === null || r.assumptionCaught === undefined ? '' : (r.assumptionCaught ? 'Yes' : 'No');
    const outcome = r.actualOutcome || '';
    const match = r.recommendationMatchedOutcome === null || r.recommendationMatchedOutcome === undefined ? '' : (r.recommendationMatchedOutcome ? 'Yes' : 'No');
    return `| ${i + 1} | ${rec} | ${caught} | ${r.finalState || ''} | ${outcome} | ${match} |`;
  });
  return header.concat(rows).join('\n');
}

function main() {
  const records = loadRecords();
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error(`${RESULTS_PATH} not found.`);
    process.exit(1);
  }
  let content = fs.readFileSync(RESULTS_PATH, 'utf8');

  content = content.replace(
    /## Summary\n\n[\s\S]*?(?=\n\n## Case log)/,
    `## Summary\n\n${buildSummary(records)}`,
  );
  content = content.replace(
    /## Case log\n\n[\s\S]*?(?=\n\n## What this proved)/,
    `## Case log\n\n${buildCaseLog(records)}`,
  );

  fs.writeFileSync(RESULTS_PATH, content);
  console.log(`Rewrote ${RESULTS_PATH} from ${records.length} real logged run(s).`);
  if (records.length === 0) {
    console.log('Log is empty — tables were reset to the blank template, nothing fabricated.');
  } else {
    console.log('Remember: still write the "What this proved / didn\'t prove" paragraph by hand.');
  }
}

main();
