const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function baseCase(i, { sourceUrl = `https://example.com/real-post-${i}` } = {}) {
  return {
    id: `C${i}`,
    sourceUrl,
    split: 'locked_test',
    adjudicationStatus: 'agreement',
    disagreement: false,
    gold: { evidenceIds: [], themes: ['t'], opportunities: [], contradictions: [] },
    ratings: [{ raterId: 'R1' }, { raterId: 'R2' }, { raterId: 'R3' }]
  };
}

function writeInput(dir, cases) {
  const input = path.join(dir, 'ann.json');
  fs.writeFileSync(input, JSON.stringify({
    goldVersion: 'g1', codebookVersion: 'c1', goldFrozen: false, annotationsComplete: true,
    synthetic: false, generatedByModel: false, adjudicated: true, independentEvaluators: 3,
    studyManifest: { perCaseProvenance: true },
    cases
  }));
  return input;
}

test('Stage 11: perCaseProvenance mode accepts cases with a real sourceUrl and does not require 3 named sources', () => {
  const dir = path.join(__dirname, 'tmp-percase-ok');
  fs.mkdirSync(dir, { recursive: true });
  const cases = Array.from({ length: 100 }, (_, i) => baseCase(i + 1));
  // 50 locked_test / 50 development to satisfy the 50% locked-test floor
  cases.forEach((c, i) => { c.split = i < 50 ? 'locked_test' : 'development'; });
  const input = writeInput(dir, cases);
  const out = path.join(dir, 'gold.json');
  const r = spawnSync(process.execPath, ['scripts/build_external_stage1_gold.js', input, out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /BUILT_EXTERNAL_GOLD/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Stage 11: perCaseProvenance mode rejects a case missing its own real sourceUrl', () => {
  const dir = path.join(__dirname, 'tmp-percase-missing-url');
  fs.mkdirSync(dir, { recursive: true });
  const cases = Array.from({ length: 100 }, (_, i) => baseCase(i + 1));
  cases.forEach((c, i) => { c.split = i < 50 ? 'locked_test' : 'development'; });
  delete cases[3].sourceUrl; // poison one case
  const input = writeInput(dir, cases);
  const out = path.join(dir, 'gold.json');
  const r = spawnSync(process.execPath, ['scripts/build_external_stage1_gold.js', input, out], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /own real, checkable sourceUrl/);
  assert.equal(fs.existsSync(out), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Stage 11: aggregate-source mode (3 named sources) is unaffected by the new perCaseProvenance branch', () => {
  const dir = path.join(__dirname, 'tmp-aggregate-still-works');
  fs.mkdirSync(dir, { recursive: true });
  const cases = Array.from({ length: 100 }, (_, i) => ({
    id: `C${i + 1}`, sourceStudyId: `S${(i % 3) + 1}`, split: i < 50 ? 'locked_test' : 'development',
    adjudicationStatus: 'agreement', disagreement: false,
    gold: { evidenceIds: [], themes: [], opportunities: [], contradictions: [] },
    ratings: [{ raterId: 'R1' }, { raterId: 'R2' }, { raterId: 'R3' }]
  }));
  const input = path.join(dir, 'ann.json');
  fs.writeFileSync(input, JSON.stringify({
    goldVersion: 'g1', codebookVersion: 'c1', goldFrozen: false, annotationsComplete: true,
    synthetic: false, generatedByModel: false, adjudicated: true, independentEvaluators: 3,
    studyManifest: { sources: [1, 2, 3].map(i => ({ id: `S${i}`, title: `S${i}`, url: `https://example.org/${i}`, realHumanData: true, provenance: 'p' })) },
    cases
  }));
  const out = path.join(dir, 'gold.json');
  const r = spawnSync(process.execPath, ['scripts/build_external_stage1_gold.js', input, out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
});
