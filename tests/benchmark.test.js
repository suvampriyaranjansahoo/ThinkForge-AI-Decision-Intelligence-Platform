const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('300-case benchmark seed is balanced across modules', () => {
  const ds = JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
  assert.equal(ds.cases.length, 300);
  const counts = Object.fromEntries(ds.cases.map(c=>[c.module,0]));
  for (const c of ds.cases) counts[c.module]++;
  for (const n of Object.values(counts)) assert.equal(n,50);
  assert.equal(ds.cases.every(c=>c.annotation_status==='pending_human_annotation'), true);
  assert.equal(ds.cases.every(c=>c.provenance.is_expert_labeled===false), true);
});


test('benchmark split manifest is frozen with 60/60/180 non-overlapping cases', () => {
  const root=path.join(__dirname,'..');
  const splits=JSON.parse(fs.readFileSync(path.join(root,'eval','benchmark_split_manifest.json'),'utf8'));
  assert.equal(splits.total,300); assert.equal(splits.splits.development.length,60); assert.equal(splits.splits.validation.length,60); assert.equal(splits.splits.test.length,180);
  const d=new Set(splits.splits.development),v=new Set(splits.splits.validation),t=new Set(splits.splits.test);
  assert.equal(d.size,60); assert.equal(v.size,60); assert.equal(t.size,180); assert.equal([...d].some(x=>v.has(x)||t.has(x)),false); assert.equal([...v].some(x=>t.has(x)),false);
});
