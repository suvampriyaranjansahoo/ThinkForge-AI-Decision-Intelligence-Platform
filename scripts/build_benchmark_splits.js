'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');const bench=JSON.parse(fs.readFileSync(path.join(root,'eval','benchmark_300.json'),'utf8'));
const cases=bench.cases||[];const rank=x=>parseInt(crypto.createHash('sha256').update(String(x.id||x.input_prompt||'')).digest('hex').slice(0,8),16);
const ordered=[...cases].sort((a,b)=>rank(a)-rank(b));const split={development:ordered.slice(0,60).map(x=>x.id),validation:ordered.slice(60,120).map(x=>x.id),test:ordered.slice(120).map(x=>x.id)};
const manifest={version:'benchmark-splits-v1',datasetVersion:bench.version,total:cases.length,counts:Object.fromEntries(Object.entries(split).map(([k,v])=>[k,v.length])),frozenAt:new Date().toISOString(),splitHash:crypto.createHash('sha256').update(JSON.stringify(split)).digest('hex'),policy:{developmentTuning:true,validationSelection:true,testLocked:true,noCrossSplitReuse:true},splits:split};
fs.writeFileSync(path.join(root,'eval','benchmark_split_manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest,null,2));
