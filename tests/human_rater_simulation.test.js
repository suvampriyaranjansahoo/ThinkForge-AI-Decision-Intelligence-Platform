'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const outDir=path.join(__dirname,'..','eval','synthetic_human_simulation');

test('synthetic human simulation has 150 cases, 3 simulated raters, 25 pilot and 60% locked test',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(outDir,'simulation_manifest.json'),'utf8'));
  assert.equal(m.synthetic,true);
  assert.equal(m.generatedByModel,true);
  assert.equal(m.caseCount,150);
  assert.equal(m.raterProfiles.length,3);
  assert.equal(m.study.pilotCases,25);
  assert.equal(m.study.lockedTestFraction,0.6);
});

test('synthetic human simulation contains no exact duplicate notes and distinct perspectives per case',()=>{
  const report=JSON.parse(fs.readFileSync(path.join(outDir,'simulation_quality_report.json'),'utf8'));
  assert.equal(report.exactNormalizedDuplicates,0);
  assert.equal(report.threeDistinctProfilesPerCase,true);
  assert.equal(report.syntheticBoundaryIntact,true);
  assert.equal(report.empiricalEligibility,false);
});

test('synthetic simulation never populates real external gold artifacts',()=>{
  // This must check the actual invariant -- no synthetic/model-generated data
  // ever lands in the real gold path -- not merely "the file doesn't exist".
  // A real, human-adjudicated gold file legitimately existing here is not a
  // violation; synthetic/model-generated content existing here would be.
  const goldPath=path.join(__dirname,'..','eval','external_gold','stage1_gold.json');
  if(!fs.existsSync(goldPath)) return; // nothing to check yet, and that's fine
  const gold=JSON.parse(fs.readFileSync(goldPath,'utf8'));
  assert.equal(gold.synthetic,false,'real external gold path must never contain synthetic-flagged data');
  assert.equal(gold.generatedByModel,false,'real external gold path must never contain model-generated data');
});
