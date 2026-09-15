const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { aggregateTraces } = require('../lib/llmOps');

test('Stage 12: aggregateTraces adds byModelDetail additively without changing existing byModel/byModule fields', () => {
  const traces = [
    { module: 'assumptions', model: 'gpt-4o-mini', latencyMs: 10, cost: 0.01, validationStatus: 'passed' },
    { module: 'assumptions', model: 'gpt-4o-mini', latencyMs: 30, cost: 0.02, validationStatus: 'failed' },
    { module: 'reasoning', model: 'gpt-4o', latencyMs: 50, cost: 0.05, validationStatus: 'passed' },
  ];
  const out = aggregateTraces(traces);
  // Pre-existing fields must be byte-for-byte the same shape as before.
  assert.deepEqual(out.byModel.sort(), ['gpt-4o', 'gpt-4o-mini'].sort());
  assert.equal(out.byModule.find(m => m.module === 'assumptions').requests, 2);
  // New field: per-model breakdown.
  const detail = out.byModelDetail.find(m => m.model === 'gpt-4o-mini');
  assert.ok(detail, 'byModelDetail must include an entry for gpt-4o-mini');
  assert.equal(detail.requests, 2);
  assert.equal(detail.errorRate, 0.5);
  const gpt4o = out.byModelDetail.find(m => m.model === 'gpt-4o');
  assert.equal(gpt4o.errorRate, 0);
});

test('Stage 12: recordInteraction never throws even when the underlying DB write fails, but the failure is now observable', async () => {
  const dbPath = require.resolve(path.join(__dirname, '..', 'lib', 'db.js'));
  const telemetryPath = require.resolve(path.join(__dirname, '..', 'lib', 'aiTelemetry.js'));

  const savedDb = require.cache[dbPath];
  const savedTelemetry = require.cache[telemetryPath];

  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true, children: [], paths: [],
    exports: { rest: async () => { throw new Error('simulated network failure'); } },
  };
  delete require.cache[telemetryPath];

  const originalConsoleError = console.error;
  const loggedLines = [];
  console.error = (...args) => { loggedLines.push(args.join(' ')); };

  try {
    const { recordInteraction, telemetryHealth, resetTelemetryHealth } = require(path.join(__dirname, '..', 'lib', 'aiTelemetry.js'));
    resetTelemetryHealth();
    await assert.doesNotReject(recordInteraction({ userId: 'u1', decisionId: 'd1', requestId: 'r1', module: 'assumptions', meta: {} }));
    const health = telemetryHealth();
    assert.equal(health.writeFailures, 1);
    assert.ok(health.lastFailureAt, 'a failure timestamp must be recorded');
    assert.ok(loggedLines.some(l => l.includes('simulated network failure')), 'the failure must be logged, not silently swallowed');
  } finally {
    console.error = originalConsoleError;
    if (savedDb) require.cache[dbPath] = savedDb; else delete require.cache[dbPath];
    if (savedTelemetry) require.cache[telemetryPath] = savedTelemetry; else delete require.cache[telemetryPath];
  }
});

test('Stage 12: telemetry_health_check.js reports BLOCKED (not a fabricated PASS) when Supabase credentials are absent', async () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { execFileSync } = require('node:child_process');
  try {
    let stdout = '', stderr = '', code = 0;
    try {
      stdout = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'telemetry_health_check.js')], { encoding: 'utf8' });
    } catch (e) {
      stdout = e.stdout || '';
      stderr = e.stderr || '';
      code = e.status;
    }
    const combined = stdout + stderr;
    assert.match(combined, /BLOCKED/);
    assert.notEqual(code, 0);
  } finally {
    if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }
});
