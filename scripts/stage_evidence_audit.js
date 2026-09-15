'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const r=spawnSync(process.execPath,[path.join(__dirname,'stage_structural_index.js')],{cwd:root,encoding:'utf8'});
if(r.status!==0){process.stdout.write(r.stdout||''); process.stderr.write(r.stderr||''); process.exit(r.status||1);}
let structural; try{structural=JSON.parse(r.stdout);}catch(e){console.error(e.message);process.exit(1);}
const stages=Object.entries(structural.stages||{}).map(([stage,v])=>({stage,requiredAssetPresence:v.requiredAssetPresence,assetsPresent:v.assetsPresent,assetsRequired:v.assetsRequired,missingAssets:v.missingAssets||[],testFileReferences:v.testFileReferences}));
const missing=stages.flatMap(s=>s.missingAssets.map(p=>`${s.stage}:${p}`));
const out={gate:'STRUCTURAL_COMPLETENESS',computed:true,allRequiredAssetsPresent:missing.length===0,missing,stages,notes:'This gate proves only repository asset presence and test-file reference counts. It is not a quality, correctness, coverage, or empirical score.'};
console.log(JSON.stringify(out,null,2));
if(missing.length)process.exit(1);
