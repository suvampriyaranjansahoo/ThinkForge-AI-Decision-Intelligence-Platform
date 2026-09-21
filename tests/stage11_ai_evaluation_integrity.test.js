const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Stage 11 (AI Evaluation) open question this session resolved:
// does api/evaluate.js's live mode call the SAME production path as api/ai.js
// (lib/ai.js's callModel), or a separate/simplified path that could silently
// diverge from what real users get? This test locks that down two ways:
//   1. Source-level check that both handlers import callModel from the exact
//      same module (so a future refactor can't quietly fork the path).
//   2. Behavioral check: with callModel stubbed to fail the way a real schema
//      validation failure would, live mode must report a loud, honest
//      execution failure - never a fabricated/placeholder quality score.

test('api/evaluate.js live mode uses the identical callModel production path as api/ai.js', () => {
  const evaluateSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'evaluate.js'), 'utf8');
  const aiSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'ai.js'), 'utf8');
  assert.match(evaluateSrc, /require\('\.\.\/lib\/ai'\)/);
  assert.match(aiSrc, /require\('\.\.\/lib\/ai'\)/);
  // Both must destructure the same exported function name, not a differently
  // named/simplified wrapper.
  assert.match(evaluateSrc, /const\s*\{\s*callModel\s*\}\s*=\s*require\('\.\.\/lib\/ai'\)/);
  assert.match(aiSrc, /const\s*\{\s*callModel\s*\}\s*=\s*require\('\.\.\/lib\/ai'\)/);
});

test('api/evaluate.js offline mode never invokes callModel', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'api', 'evaluate.js'), 'utf8');
  const offlineBlockMatch = src.match(/if\(mode===['"]offline['"]\)\{[\s\S]*?\r?\n\s*\}\r?\n/);
  assert.ok(offlineBlockMatch, 'expected to find the offline-mode branch');
  assert.doesNotMatch(offlineBlockMatch[0], /callModel/);
});

test('api/evaluate.js live mode fails loudly (not a mock/placeholder score) when the model layer breaks', async () => {
  // Stub lib/auth so we can reach the live-mode branch without a real Supabase session,
  // and stub lib/ai so callModel throws the same shape of error a real schema
  // validation failure produces (AI_SCHEMA_INVALID). Everything else (rate
  // limiting, security headers, contracts, evaluation scoring) stays real.
  const authPath = require.resolve(path.join(__dirname, '..', 'lib', 'auth.js'));
  const aiPath = require.resolve(path.join(__dirname, '..', 'lib', 'ai.js'));
  const evaluatePath = require.resolve(path.join(__dirname, '..', 'api', 'evaluate.js'));

  const savedAuth = require.cache[authPath];
  const savedAi = require.cache[aiPath];
  const savedEvaluate = require.cache[evaluatePath];

  const forcedError = Object.assign(new Error('Schema validation failed: assumptions: expected array'), { code: 'AI_SCHEMA_INVALID' });

  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true, children: [], paths: [],
    exports: {
      requireUser: async () => ({ id: 'test-user' }),
      // Live mode now requires organization admin membership (see api/evaluate.js) - stub it
      // as satisfied so this test keeps isolating the thing it actually checks (loud failure
      // on a broken model layer), not the separate authorization behavior.
      requireOrganizationRole: async () => ({ role: 'admin' }),
      requestId: () => 'test-request-id',
    },
  };
  require.cache[aiPath] = {
    id: aiPath, filename: aiPath, loaded: true, children: [], paths: [],
    exports: {
      callModel: async () => { throw forcedError; },
      buildPrompt: () => '', estimateCost: () => 0, MODULES: {},
    },
  };
  delete require.cache[evaluatePath];

  try {
    const handler = require(path.join(__dirname, '..', 'api', 'evaluate.js'));
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    const req = { method: 'POST', headers: {}, body: { mode: 'live', limit: 1, organizationId: 'org-test' } };

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.executedCases, 1);
    // The whole point of Stage 11: a broken model layer must never be papered
    // over with a fabricated/placeholder research-quality number.
    assert.equal(res.body.researchQualityScore, null);
    assert.equal(res.body.researchQualityClaimAllowed, false);
    const [result] = res.body.results;
    assert.equal(result.status, 'failed_execution');
    assert.match(result.error, /Schema validation failed/);
    assert.equal(result.goldScores, undefined);
  } finally {
    // Restore whatever was cached before this test ran, so later tests in the
    // same run see the real modules again.
    if (savedAuth) require.cache[authPath] = savedAuth; else delete require.cache[authPath];
    if (savedAi) require.cache[aiPath] = savedAi; else delete require.cache[aiPath];
    if (savedEvaluate) require.cache[evaluatePath] = savedEvaluate; else delete require.cache[evaluatePath];
  }
});

test('api/evaluate.js live mode reports a real per-module pass-rate breakdown and run-level telemetry from actual per-case meta', async () => {
  // Stub auth (reach live mode), lib/ai (deterministic success instead of a
  // real network call), and lib/contracts' validateBusinessRules (isolate this
  // test from unrelated schema/business-rule complexity - that logic is
  // already covered by its own contracts tests). Everything else stays real.
  const authPath = require.resolve(path.join(__dirname, '..', 'lib', 'auth.js'));
  const aiPath = require.resolve(path.join(__dirname, '..', 'lib', 'ai.js'));
  const contractsPath = require.resolve(path.join(__dirname, '..', 'lib', 'contracts.js'));
  const evaluatePath = require.resolve(path.join(__dirname, '..', 'api', 'evaluate.js'));

  const savedAuth = require.cache[authPath];
  const savedAi = require.cache[aiPath];
  const savedContracts = require.cache[contractsPath];
  const savedEvaluate = require.cache[evaluatePath];

  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true, children: [], paths: [],
    exports: {
      requireUser: async () => ({ id: 'test-user' }),
      requireOrganizationRole: async () => ({ role: 'admin' }),
      requestId: () => 'test-request-id',
    },
  };
  let callIndex = 0;
  require.cache[aiPath] = {
    id: aiPath, filename: aiPath, loaded: true, children: [], paths: [],
    exports: {
      callModel: async (action, decision, requestId) => {
        callIndex++;
        return {
          data: { ok: true },
          meta: {
            requestId, module: action, model: 'gpt-4o-mini', promptVersion: `${action}.v4`,
            retrieverVersion: 'hybrid-v2', latencyMs: 10 * callIndex,
            usage: { prompt_tokens: 100, completion_tokens: 50 }, costUsd: 0.001 * callIndex,
          },
        };
      },
      buildPrompt: () => '', estimateCost: () => 0, MODULES: {},
    },
  };
  require.cache[contractsPath] = {
    id: contractsPath, filename: contractsPath, loaded: true, children: [], paths: [],
    exports: { validateBusinessRules: () => [], schemas: { safeParse: () => ({ success: true, data: { ok: true } }) } },
  };
  delete require.cache[evaluatePath];

  try {
    const handler = require(path.join(__dirname, '..', 'api', 'evaluate.js'));
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    const req = { method: 'POST', headers: {}, body: { mode: 'live', limit: 3, organizationId: 'org-test' } };

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.executedCases, 3);
    assert.equal(res.body.contractPassRate, 1);
    assert.ok(Array.isArray(res.body.contractPassRateByModule));
    assert.ok(res.body.contractPassRateByModule.length >= 1);
    for (const row of res.body.contractPassRateByModule) {
      assert.equal(row.contractPassRate, 1, `module ${row.module} should show a 100% pass rate given the stubbed success path`);
      assert.equal(row.passedCases, row.executedCases);
    }
    assert.ok(res.body.runTelemetry, 'run-level telemetry must be present');
    assert.equal(res.body.runTelemetry.requests, 3);
    assert.equal(res.body.runTelemetry.validationPassRate, 1);
    assert.ok(res.body.runTelemetry.totalCost > 0);
  } finally {
    if (savedAuth) require.cache[authPath] = savedAuth; else delete require.cache[authPath];
    if (savedAi) require.cache[aiPath] = savedAi; else delete require.cache[aiPath];
    if (savedContracts) require.cache[contractsPath] = savedContracts; else delete require.cache[contractsPath];
    if (savedEvaluate) require.cache[evaluatePath] = savedEvaluate; else delete require.cache[evaluatePath];
  }
});
