'use strict';
/**
 * The one real gap found in lib/registry.js: registerArtifact/selectPromotion
 * are correct and unit-tested (tests/readiness_95.test.js), but nothing in
 * api/ or scripts/ ever calls them -- there was no actual place in the repo
 * where a model/prompt/retriever version got registered or promoted. This
 * CLI is that place, backed by a real persisted registry file.
 *
 * Usage:
 *   node scripts/promote_artifact.js register <type> <id> <version> [registryPath]
 *   node scripts/promote_artifact.js promote <type> <id> <version> --require <gate1,gate2> --gates '{"gate1":true,"gate2":true}' [registryPath]
 *   node scripts/promote_artifact.js list [registryPath]
 *
 * Examples:
 *   node scripts/promote_artifact.js register model gpt-stage1-router 2026-09-05
 *   node scripts/promote_artifact.js promote model gpt-stage1-router 2026-09-05 \
 *     --require stage1_empirical,regression_suite \
 *     --gates '{"stage1_empirical":true,"regression_suite":true}'
 *
 * This deliberately reuses lib/registry.js's own logic rather than
 * reimplementing gate rules here -- promotion fails exactly when
 * selectPromotion() throws, with the same message it already produces.
 */

const fs = require('node:fs');
const path = require('node:path');
const { registerArtifact, selectPromotion } = require('../lib/registry');

const [, , cmd, ...rest] = process.argv;
const fail = (message, details = {}) => { console.error(JSON.stringify({ status: 'BLOCKED', message, ...details }, null, 2)); process.exit(2); };

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { flags[args[i].slice(2)] = args[i + 1]; i++; }
  }
  return flags;
}

function loadRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) return [];
  try { return JSON.parse(fs.readFileSync(registryPath, 'utf8')); }
  catch (e) { fail('Registry file is not valid JSON.', { registryPath, error: e.message }); }
}

function saveRegistry(registryPath, artifacts) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, JSON.stringify(artifacts, null, 2));
}

if (cmd === 'register') {
  const [type, id, version, registryPathArg] = rest.filter(a => !a.startsWith('--'));
  if (!type || !id || !version) fail('Usage: register <type> <id> <version> [registryPath]');
  const registryPath = registryPathArg || path.join(__dirname, '..', 'eval', 'registry', 'artifact_registry.json');
  const existing = loadRegistry(registryPath);
  let updated;
  try { updated = registerArtifact(existing, { type, id, version }); }
  catch (e) { fail(e.message, { type, id, version }); }
  saveRegistry(registryPath, updated);
  console.log(JSON.stringify({ status: 'REGISTERED', type, id, version, registryPath }, null, 2));

} else if (cmd === 'promote') {
  const positional = rest.filter(a => !a.startsWith('--') && rest[rest.indexOf(a) - 1] !== '--require' && rest[rest.indexOf(a) - 1] !== '--gates');
  const [type, id, version, registryPathArg] = positional;
  const flags = parseFlags(rest);
  if (!type || !id || !version) fail('Usage: promote <type> <id> <version> --require <gates,comma> --gates \'{"gate":true}\' [registryPath]');
  const registryPath = registryPathArg || path.join(__dirname, '..', 'eval', 'registry', 'artifact_registry.json');
  const requiredGates = (flags.require || '').split(',').map(s => s.trim()).filter(Boolean);
  let gates = {};
  if (flags.gates) { try { gates = JSON.parse(flags.gates); } catch (e) { fail('--gates must be valid JSON.', { error: e.message }); } }
  const artifacts = loadRegistry(registryPath);
  let promoted;
  try { promoted = selectPromotion(artifacts, { type, id, version, requiredGates, gates }); }
  catch (e) { fail(e.message, { type, id, version, requiredGates, gates }); }
  const updated = artifacts.map(a => (a.type === type && a.id === id && a.version === version) ? promoted : a);
  saveRegistry(registryPath, updated);
  console.log(JSON.stringify({ status: 'PROMOTED', type, id, version, promotedAt: promoted.promotedAt, registryPath }, null, 2));

} else if (cmd === 'list') {
  const registryPath = rest[0] || path.join(__dirname, '..', 'eval', 'registry', 'artifact_registry.json');
  console.log(JSON.stringify({ registryPath, artifacts: loadRegistry(registryPath) }, null, 2));

} else {
  fail('Usage: node promote_artifact.js <register|promote|list> ...');
}
