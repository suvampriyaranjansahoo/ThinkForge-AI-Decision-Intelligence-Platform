const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

function baseCase(i,{split='locked_test',disagreement=false}={}){
  return {
    id:`C${i}`,sourceStudyId:`S${(i%3)+1}`,split,disagreement,
    ratings:[{raterId:'R1'},{raterId:'R2'},{raterId:'R3'}],
    adjudicationStatus:disagreement?'adjudicated':'agreement',
    adjudication:disagreement?{required:true,completed:true,adjudicatorId:'ADJ',reason:'Resolved using codebook'}:undefined,
    gold:{evidenceIds:[],themes:[],opportunities:[],contradictions:[]}
  };
}

test('external gold freeze rejects disagreements without explicit adjudication',()=>{
  const dir=path.join(__dirname,'tmp-freeze');fs.mkdirSync(dir,{recursive:true});
  const input=path.join(dir,'ann.json'),out=path.join(dir,'gold.json');
  const cases=Array.from({length:100},(_,i)=>baseCase(i+1));cases[0].disagreement=true;cases[0].adjudicationStatus='agreement';delete cases[0].adjudication;
  fs.writeFileSync(input,JSON.stringify({goldVersion:'g1',codebookVersion:'c1',goldFrozen:false,annotationsComplete:true,synthetic:false,generatedByModel:false,adjudicated:true,independentEvaluators:3,studyManifest:{sources:[1,2,3].map(i=>({id:`S${i}`,title:`S${i}`,url:`https://example.org/${i}`,realHumanData:true,provenance:'p'}))},cases}));
  const r=spawnSync(process.execPath,['scripts/build_external_stage1_gold.js',input,out],{encoding:'utf8'});
  assert.equal(r.status,2);assert.match(r.stderr,/disagreement.*adjudication/i);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('external gold freeze enforces >=50% locked test',()=>{
  const dir=path.join(__dirname,'tmp-freeze-split');fs.mkdirSync(dir,{recursive:true});
  const input=path.join(dir,'ann.json'),out=path.join(dir,'gold.json');
  const cases=Array.from({length:100},(_,i)=>baseCase(i+1,{split:i<60?'development':'validation'}));
  fs.writeFileSync(input,JSON.stringify({goldVersion:'g1',codebookVersion:'c1',goldFrozen:false,annotationsComplete:true,synthetic:false,generatedByModel:false,adjudicated:true,independentEvaluators:3,studyManifest:{sources:[1,2,3].map(i=>({id:`S${i}`,title:`S${i}`,url:`https://example.org/${i}`,realHumanData:true,provenance:'p'}))},cases}));
  const r=spawnSync(process.execPath,['scripts/build_external_stage1_gold.js',input,out],{encoding:'utf8'});
  assert.equal(r.status,2);assert.match(r.stderr,/locked test/i);
  fs.rmSync(dir,{recursive:true,force:true});
});
