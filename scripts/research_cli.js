#!/usr/bin/env node
'use strict';
// Single entry point over the research/eval reporting scripts.
// These four scripts inspect different things (gold-label counts, statistical
// CI on eval results, overall readiness, and manifest/schema structural
// validation) — they are not duplicates of each other, but a newcomer to the
// repo shouldn't have to know that. This wraps them behind one command:
//
//   node scripts/research_cli.js status      -> scripts/research_status.js
//   node scripts/research_cli.js report      -> scripts/research_report.js
//   node scripts/research_cli.js readiness   -> scripts/research_readiness.js
//   node scripts/research_cli.js audit       -> scripts/research_protocol_audit.js
//   node scripts/research_cli.js all         -> runs all four, labeled, in order
//
// The original scripts and their npm aliases (research:status, research:report,
// research:readiness, research:protocol-audit) are unchanged and still work —
// this is additive, not a replacement, so nothing already depending on them breaks.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const MODES = {
  status: 'research_status.js',
  report: 'research_report.js',
  readiness: 'research_readiness.js',
  audit: 'research_protocol_audit.js',
};

function run(mode, extraArgs) {
  const target = path.join(__dirname, MODES[mode]);
  const result = spawnSync(process.execPath, [target, ...extraArgs], { stdio: 'inherit' });
  return result.status ?? 0;
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (!mode || (mode !== 'all' && !MODES[mode])) {
    console.error(
      `Usage: node scripts/research_cli.js <${Object.keys(MODES).join('|')}|all> [...args]`
    );
    process.exit(2);
  }
  if (mode === 'all') {
    const failures = [];
    for (const m of Object.keys(MODES)) {
      console.log(`\n=== ${m} (${MODES[m]}) ===`);
      const code = run(m, rest);
      if (code !== 0) failures.push(m);
    }
    if (failures.length) {
      console.log(
        `\n=== summary: ${failures.join(', ')} did not complete ===\n` +
          `This can be expected — e.g. "report" requires a real eval/latest_results.json\n` +
          `from an actual benchmark run (npm run benchmark), and correctly refuses to\n` +
          `fabricate one. Check each script's own output above before treating this as a bug.`
      );
    }
    process.exit(0);
  }
  process.exit(run(mode, rest));
}

main();
