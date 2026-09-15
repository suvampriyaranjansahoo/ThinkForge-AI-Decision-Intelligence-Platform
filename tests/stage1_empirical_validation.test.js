const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Stage 1 external benchmark contains real-human study sources and no fabricated results',()=>{
  const p=path.join(__dirname,'..','eval','stage1_external_benchmark_manifest.json');
  const d=JSON.parse(fs.readFileSync(p,'utf8'));
  assert.ok(d.sources.length>=3);
  assert.ok(d.sources.every(s=>s.realHumanData===true));
  assert.equal(d.policy.empiricalClaimsRequireGold,true);
  assert.equal(d.policy.syntheticDataCannotCountAsEmpirical,true);
});

test('Stage 1 empirical evaluator fails closed until a separate candidate run exists',()=>{
  const script=path.join(__dirname,'..','scripts','stage1_empirical_eval.js');
  const {spawnSync}=require('node:child_process');
  const r=spawnSync(process.execPath,[script],{encoding:'utf8'});
  assert.equal(r.status,2);
  assert.match(r.stdout,/BLOCKED_UNTIL_SEPARATE_CANDIDATE_RUN/);
  assert.match(r.stdout,/goldCases/);
  assert.match(r.stdout,/146/);
});

test('Stage 1 scoring math is deterministic for validated gold rows',()=>{
  const script=path.join(__dirname,'..','scripts','stage1_empirical_eval.js');
  const tmp=path.join(__dirname,'tmp_stage1_gold.json');
  const tmpPred=path.join(__dirname,'tmp_stage1_candidate.json');
  const cases=Array.from({length:100},(_,i)=>({id:`C${i+1}`,split:'locked_test',ratings:[{raterId:'R1'},{raterId:'R2'},{raterId:'R3'}],adjudicationStatus:'agreement',gold:{evidenceIds:['e1'],themes:['t1'],opportunities:['o1'],contradictions:['c1'],shouldAbstain:false}}));
  const studyManifest={sources:[1,2,3].map(i=>({id:`s${i}`,title:`Study ${i}`,url:`https://example.org/${i}`,realHumanData:true,provenance:`doi:${i}`}))};
  fs.writeFileSync(tmp,JSON.stringify({goldVersion:'test-v1',codebookVersion:'codebook-v1',goldFrozen:true,synthetic:false,generatedByModel:false,adjudicated:true,independentEvaluators:3,studyManifest,cases}));
  const goldHash=require('node:crypto').createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
  fs.writeFileSync(tmpPred,JSON.stringify({runId:'candidate-test-v1',goldVersion:'test-v1',goldDatasetHash:goldHash,synthetic:false,generatedByModel:false,cases:cases.map(c=>({id:c.id,prediction:{evidenceIds:['e1'],themes:['t1'],opportunities:['o1'],contradictions:['c1'],shouldAbstain:false}}))}));
  const {spawnSync}=require('node:child_process');
  const r=spawnSync(process.execPath,[script],{env:{...process.env,STAGE1_GOLD_PATH:tmp,STAGE1_PREDICTIONS_PATH:tmpPred},encoding:'utf8'});
  fs.unlinkSync(tmp);fs.unlinkSync(tmpPred);
  assert.equal(r.status,0);
  const out=JSON.parse(r.stdout);
  assert.equal(out.status,'EMPIRICALLY_VALIDATED');
  assert.equal(out.metrics.evidenceGroundingPrecision,1);
  assert.equal(out.metrics.themeRecall,1);
  assert.equal(out.weightedScore,1);
});
