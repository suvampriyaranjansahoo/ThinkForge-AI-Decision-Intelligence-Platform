const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function run(args) {
  return spawnSync(process.execPath, ['scripts/promote_artifact.js', ...args], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
}

test('Stage 12: promote_artifact register then blocks promotion when a required gate is missing', () => {
  const dir = path.join(__dirname, 'tmp-registry');
  fs.mkdirSync(dir, { recursive: true });
  const reg = path.join(dir, 'registry.json');

  const registered = run(['register', 'model', 'test-model', 'v1', reg]);
  assert.equal(registered.status, 0);
  assert.match(registered.stdout, /"status": "REGISTERED"/);
  assert.ok(fs.existsSync(reg));

  const blocked = run(['promote', 'model', 'test-model', 'v1', reg, '--require', 'eval,regression', '--gates', '{"regression":true}']);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Promotion blocked: eval/);

  const registryAfterBlock = JSON.parse(fs.readFileSync(reg, 'utf8'));
  assert.equal(registryAfterBlock[0].status, 'candidate', 'a blocked promotion must not mutate the registry');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Stage 12: promote_artifact promotes and persists once all required gates pass', () => {
  const dir = path.join(__dirname, 'tmp-registry-2');
  fs.mkdirSync(dir, { recursive: true });
  const reg = path.join(dir, 'registry.json');

  run(['register', 'model', 'test-model', 'v2', reg]);
  const promoted = run(['promote', 'model', 'test-model', 'v2', reg, '--require', 'eval,regression', '--gates', '{"eval":true,"regression":true}']);
  assert.equal(promoted.status, 0);
  assert.match(promoted.stdout, /"status": "PROMOTED"/);

  const registryAfter = JSON.parse(fs.readFileSync(reg, 'utf8'));
  assert.equal(registryAfter[0].status, 'production');
  assert.ok(registryAfter[0].promotedAt);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('Stage 12: promote_artifact refuses to promote an artifact that was never registered', () => {
  const dir = path.join(__dirname, 'tmp-registry-3');
  fs.mkdirSync(dir, { recursive: true });
  const reg = path.join(dir, 'registry.json');

  const result = run(['promote', 'model', 'never-registered', 'v1', reg, '--require', 'eval', '--gates', '{"eval":true}']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Registry artifact not found/);

  fs.rmSync(dir, { recursive: true, force: true });
});
