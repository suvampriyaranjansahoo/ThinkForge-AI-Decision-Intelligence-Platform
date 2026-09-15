'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const p=path.join(__dirname,'..','eval','reasoning_benchmark.json');
test('reasoning benchmark never claims empirical gold without human labels',()=>{const d=JSON.parse(fs.readFileSync(p,'utf8'));assert.equal(d.status,'seed_pending_human_gold');assert.ok(d.cases.every(c=>c.gold===null));});
test('canonical write path facade is used by workspace and discovery APIs',()=>{const w=fs.readFileSync(path.join(__dirname,'..','api','workspace.js'),'utf8');const d=fs.readFileSync(path.join(__dirname,'..','api','discovery.js'),'utf8');assert.match(w,/require\('\.\.\/lib\/domainRepository'\)/);assert.match(w,/saveWorkspace/);assert.match(d,/saveDiscovery/);});
