'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const canonical = path.join(root, 'supabase');
const compatibility = path.join(root, 'db', 'migrations');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sqlFiles = (dir) => fs.readdirSync(dir).filter((name) => name.endsWith('.sql'));
const canonicalFiles = new Map(sqlFiles(canonical).map((name) => [name.replace(/^migration_/, ''), name]));
const pairs = sqlFiles(compatibility)
  .map((name) => ({ compatibility: name, canonical: canonicalFiles.get(name) }))
  .filter((pair) => pair.canonical);
const drifted = pairs
  .filter(({ compatibility: compatibilityName, canonical: canonicalName }) => hash(path.join(canonical, canonicalName)) !== hash(path.join(compatibility, compatibilityName)))
  .map(({ compatibility: compatibilityName, canonical: canonicalName }) => ({ canonical: canonicalName, compatibility: compatibilityName }));

console.log(JSON.stringify({
  canonicalSource: 'supabase/',
  compatibilitySource: 'db/migrations/',
  comparedPairs: pairs,
  drifted,
}, null, 2));
if (!pairs.length || drifted.length) process.exitCode = 1;
