'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const r=spawnSync(process.execPath,[path.join(__dirname,'stage_structural_index.js')],{cwd:root,encoding:'utf8'});
if(r.status!==0) process.exit(r.status||1);
let out;
try{out=JSON.parse(r.stdout);}catch(e){console.error('Structural index did not emit valid JSON:',e.message);process.exit(1);}
const stages=out.stages||{};
const missing=Object.entries(stages).flatMap(([stage,v])=>(v.missingAssets||[]).map(p=>`${stage}:${p}`));
const result={
  gate:'STRUCTURAL_COMPLETENESS',
  derived:true,
  methodology:'required-asset presence and test-file reference counts only; not a quality, correctness, coverage, or empirical score',
  allRequiredAssetsPresent:missing.length===0,
  missingAssets:missing,
  stages
};
console.log(JSON.stringify(result,null,2));
if(missing.length) process.exit(1);
