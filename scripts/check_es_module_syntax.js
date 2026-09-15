'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const target = process.argv[2];

if (!target) throw new Error('Usage: node scripts/check_es_module_syntax.js <module-file>');
const source = fs.readFileSync(path.resolve(target), 'utf8');
const result = childProcess.spawnSync(process.execPath, ['--input-type=module', '--check'], {
  input: source,
  encoding: 'utf8',
});
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || `ES module syntax check failed for ${target}.\n`);
  process.exitCode = result.status || 1;
}
