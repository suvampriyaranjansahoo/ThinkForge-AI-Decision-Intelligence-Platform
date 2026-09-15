const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('external gold importer rejects synthetic labels and preserves fail-closed policy',()=>{
  const script=path.join(__dirname,'..','scripts','build_external_stage1_gold.js');
  const tmp=path.join(__dirname,'tmp_external_gold.json');
  const out=path.join(__dirname,'tmp_external_gold_out.json');
  const srcs=[1,2,3].map(i=>({id:`S${i}`,title:`Study ${i}`,url:`https://doi.org/10.1/${i}`,realHumanData:true,provenance:`doi:${i}`}));
  const cases=Array.from({length:100},(_,i)=>({id:`C${i+1}`,adjudicationStatus:'adjudicated',gold:{evidenceIds:[],themes:[],opportunities:[],contradictions:[]}}));
  fs.writeFileSync(tmp,JSON.stringify({goldVersion:'g1',codebookVersion:'c1',goldFrozen:true,synthetic:true,adjudicated:true,independentEvaluators:3,studyManifest:{sources:srcs},cases}));
  const r=spawnSync(process.execPath,[script,tmp,out],{encoding:'utf8'});
  fs.rmSync(tmp,{force:true});fs.rmSync(out,{force:true});
  assert.equal(r.status,2);assert.match(r.stderr,/synthetic labels/i);
});
