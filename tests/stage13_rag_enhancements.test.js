const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { rerank, shingleSet, jaccard } = require('../api/rag.js')._internal;
const { averagePrecision, aggregate } = require('../lib/ragMetrics');

test('Stage 13: rerank catches near-duplicate chunks that a prefix-match dedup would miss', () => {
  const hits = [
    { id: 'a', rrfScore: 0.9, text: 'The refund flow reduced duplicate-charge anxiety among returning customers who checked out twice by accident.' },
    // Different opening text, but the body is a near-duplicate of "a" — a
    // prefix-based dedup (old behavior) would have let both through since the
    // first 80 characters differ.
    { id: 'b', rrfScore: 0.6, text: 'Also, the refund flow reduced duplicate-charge anxiety among returning customers who checked out twice by accident.' },
    { id: 'c', rrfScore: 0.5, text: 'Onboarding tooltips had no measurable effect on activation rate in the first week cohort.' },
  ];
  const ranked = rerank('refund duplicate charge anxiety', hits);
  const ids = ranked.map(x => x.id);
  assert.ok(ids.includes('a'));
  assert.ok(!ids.includes('b'), 'near-duplicate of a should be dropped');
  assert.ok(ids.includes('c'), 'genuinely distinct chunk must survive dedup');
});

test('Stage 13: rerank keeps chunks that share an opening but diverge in content (old prefix-based dedup would have wrongly merged these)', () => {
  const prefix = 'Weekly retention among trial users ';
  const hits = [
    { id: 'x', rrfScore: 0.8, text: prefix + 'improved after the onboarding redesign shipped in March.' },
    { id: 'y', rrfScore: 0.7, text: prefix + 'dropped sharply once the free trial length was cut to seven days.' },
  ];
  const ranked = rerank('trial retention', hits);
  const ids = ranked.map(x => x.id);
  assert.equal(ids.length, 2, 'both chunks are substantively different and must both survive dedup');
});

test('Stage 13: jaccard/shingleSet behave sanely on edge cases', () => {
  assert.equal(jaccard(shingleSet(''), shingleSet('')), 1);
  assert.equal(jaccard(shingleSet('hello world'), shingleSet('')), 0);
  assert.ok(jaccard(shingleSet('a b c d e f'), shingleSet('a b c d e f')) === 1);
});

test('Stage 13: api/rag.js search falls back to lexical-only ranking (not a 503) when no embedding provider is configured', async () => {
  const dbPath = require.resolve(path.join(__dirname, '..', 'lib', 'db.js'));
  const authPath = require.resolve(path.join(__dirname, '..', 'lib', 'auth.js'));
  const ragPath = require.resolve(path.join(__dirname, '..', 'api', 'rag.js'));

  const savedDb = require.cache[dbPath];
  const savedAuth = require.cache[authPath];
  const savedRag = require.cache[ragPath];
  const savedApiKey = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY; // simulate no embedding provider configured

  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true, children: [], paths: [],
    exports: { requireUser: async () => ({ id: 'test-user' }), requestId: () => 'test-request-id' },
  };
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true, children: [], paths: [],
    exports: {
      rest: async () => ({
        ok: true,
        json: async () => ([
          { id: 'c1', document_id: 'd1', chunk_index: 0, content: 'Users abandon checkout when shipping cost appears late.', source_locator: 'chunk 1' },
          { id: 'c2', document_id: 'd1', chunk_index: 1, content: 'Unrelated chunk about internal tooling migration.', source_locator: 'chunk 2' },
        ]),
      }),
      rpc: async () => { throw new Error('rpc should not be called in the lexical-only fallback path'); },
    },
  };
  delete require.cache[ragPath];

  try {
    const handler = require(path.join(__dirname, '..', 'api', 'rag.js'));
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    const req = { method: 'POST', headers: {}, body: { action: 'search', payload: { query: 'shipping cost checkout abandonment', limit: 5 } } };

    await handler(req, res);

    assert.equal(res.statusCode, 200, 'must degrade gracefully, never a hard 503');
    assert.equal(res.body.degraded, true);
    assert.match(res.body.strategy, /lexical-only/);
    assert.ok(res.body.hits.length >= 1);
    assert.equal(res.body.hits[0].id, 'c1', 'the lexically relevant chunk should rank first');
  } finally {
    if (savedApiKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = savedApiKey;
    if (savedDb) require.cache[dbPath] = savedDb; else delete require.cache[dbPath];
    if (savedAuth) require.cache[authPath] = savedAuth; else delete require.cache[authPath];
    if (savedRag) require.cache[ragPath] = savedRag; else delete require.cache[ragPath];
  }
});

test('Stage 13: mean average precision rewards top-ranked relevance, unlike plain recall', () => {
  const goldTop = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; // relevant item ranked first
  const goldBottom = [{ id: 'c' }, { id: 'b' }, { id: 'a' }]; // relevant item ranked last
  const map1 = averagePrecision(goldTop, ['a'], 3);
  const map2 = averagePrecision(goldBottom, ['a'], 3);
  assert.ok(map1 > map2, 'ranking the relevant chunk first must score higher under MAP');
});

test('Stage 13: ragMetrics.aggregate includes map10 additively without breaking existing fields', () => {
  const cases = [{ r5: 1, r10: 1, p5: 0.5, mrr: 1, ndcg10: 1, map10: 1 }];
  const out = aggregate(cases);
  assert.equal(out.map10, 1);
  assert.equal(out.r5, 1); // pre-existing fields untouched
});
