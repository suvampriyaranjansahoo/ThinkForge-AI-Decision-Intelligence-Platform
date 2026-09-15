const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.join(__dirname,'..');

test('capstone gold layer is embedded and structurally complete',()=>{
  const r=spawnSync(process.execPath,['scripts/audit_capstone_gold_layer.js'],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=JSON.parse(r.stdout);
  assert.equal(out.status,'AUDIT_COMPLETE');
  assert.equal(out.report.structural.caseCount,150);
  assert.deepEqual(out.report.structural.raterRows,{r1:150,r2:150,r3:150});
  assert.equal(out.report.structural.candidateConfirmed,146);
  assert.equal(out.report.structural.pendingAdjudication,4);
  assert.equal(out.report.quality.scopeFinalized,true);
  assert.equal(out.report.quality.finalizationBlocked,false);
  assert.equal(out.report.quality.empiricalValidationBlocked,true);
  assert.equal(out.report.integrity.lockedFraction,0.6);
});


test('146-case gold scope is explicitly final and four unavailable cases are excluded without fabricated labels',()=>{
  const gold=JSON.parse(fs.readFileSync(path.join(root,'eval/external_gold/stage1_gold.json'),'utf8'));
  const decision=JSON.parse(fs.readFileSync(path.join(root,'eval/external_gold/capstone_gold_layer_v1/04_audit/SCOPE_FINALIZATION_DECISION.json'),'utf8'));
  assert.equal(decision.decision,'FINALIZE_146_CASE_GOLD');
  assert.equal(gold.goldFrozen,true);
  assert.equal(gold.cases.length,146);
  assert.equal(gold.scope.scopeFinalized,true);
  assert.equal(gold.scope.scopeStatus,'FINALIZED_146_CASES');
  assert.deepEqual((gold.scope.excludedPendingCaseIds||[]).slice().sort(),['CASE-002','CASE-005','CASE-065','CASE-142']);
  assert.equal(gold.scope.pendingCaseCount,0);
  assert.equal(gold.scope.includedCaseCount,146);
});

test('normalized Rater-03 is explicitly joinable by case_id and rater_id',()=>{
  const p=path.join(root,'eval','external_gold','capstone_gold_layer_v1','01_inputs','FULL150_RATER-03_normalized.csv');
  assert.ok(fs.existsSync(p));
  const text=fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean);
  assert.match(text[0],/^"case_id","rater_id",/);
  assert.equal(text.length-1,150);
});

test('empirical gold schema forbids embedded predictions',()=>{
  const schema=JSON.parse(fs.readFileSync(path.join(root,'eval','external_gold','stage1_gold.schema.json'),'utf8'));
  assert.ok(!schema.properties.cases.items.properties.prediction);
  assert.ok(!schema.properties.cases.items.required.includes('prediction'));
});
