const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const capstoneRoot=path.join(root,'eval','external_gold','capstone_gold_layer_v1');
const capstoneTest=fs.existsSync(capstoneRoot)
  ? test
  : (name, fn)=>test(name,{skip:'private capstone artifact is intentionally excluded from the public checkout'},fn);

capstoneTest('frozen external gold is exactly the finalized 146-case scope and excludes the four unavailable cases',()=>{
  const candidate=JSON.parse(fs.readFileSync(path.join(root,'eval/external_gold/capstone_gold_layer_v1/02_gold/stage1_gold_candidate.json'),'utf8'));
  const gold=JSON.parse(fs.readFileSync(path.join(root,'eval/external_gold/stage1_gold.json'),'utf8'));
  const confirmed=new Set(candidate.records.filter(r=>r.status!=='PENDING_HUMAN_ADJUDICATION').map(r=>r.case_id));
  const pending=candidate.records.filter(r=>r.status==='PENDING_HUMAN_ADJUDICATION').map(r=>r.case_id).sort();
  const goldIds=gold.cases.map(c=>c.id);
  assert.equal(candidate.total_cases,150);
  assert.equal(candidate.confirmed_cases,146);
  assert.equal(candidate.pending_human_adjudication,4);
  assert.equal(gold.goldFrozen,true);
  assert.equal(gold.cases.length,146);
  assert.deepEqual([...new Set(goldIds)].sort(),[...confirmed].sort());
  assert.deepEqual((gold.scope?.excludedPendingCaseIds||[]).slice().sort(),pending);
  assert.equal(gold.scope?.scopeFinalized,true);
  assert.equal(gold.scope?.scopeStatus,'FINALIZED_146_CASES');
  assert.equal(gold.scope?.sourceCaseCount,150);
  assert.equal(gold.scope?.confirmedCaseCount,146);
  assert.equal(gold.scope?.pendingCaseCount,0);
  assert.equal(gold.scope?.includedCaseCount,146);
});

test('documented prior adjudications remain provenance-explicit without fabricated adjudicator identity',()=>{
  const gold=JSON.parse(fs.readFileSync(path.join(root,'eval/external_gold/stage1_gold.json'),'utf8'));
  const ids=['CASE-014','CASE-024','CASE-059','CASE-087','CASE-094','CASE-101','CASE-119','CASE-129','CASE-131','CASE-146'];
  for(const id of ids){
    const c=gold.cases.find(x=>x.id===id);
    assert.ok(c,`missing ${id}`);
    assert.equal(c.adjudicationStatus,'adjudicated');
    assert.equal(c.adjudication?.source,'documented_prior_adjudication');
    assert.equal(c.adjudication?.completed,true);
    assert.ok(c.adjudication?.sourceRecord);
    assert.equal(Object.prototype.hasOwnProperty.call(c.adjudication,'adjudicatorId'),false);
  }
});

test('stage1 empirical evaluator blocks for a separate candidate run, not missing gold',()=>{
  const {spawnSync}=require('node:child_process');
  const r=spawnSync(process.execPath,['scripts/stage1_empirical_eval.js'],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,2);
  const out=JSON.parse(r.stdout);
  assert.equal(out.status,'BLOCKED_UNTIL_SEPARATE_CANDIDATE_RUN');
  assert.equal(out.goldCases,146);
});
