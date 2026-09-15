'use strict';
const fs=require('fs');
const {bootstrapCI,mean}=require('../lib/statistics');
const resultsPath=process.argv[2]||'eval/latest_results.json';
if(!fs.existsSync(resultsPath)){console.error('Missing results file');process.exit(2)}
const p=JSON.parse(fs.readFileSync(resultsPath,'utf8')),rows=p.results||[];
const by={};for(const r of rows){(by[r.module]??=[]).push(r)}
const moduleSummary={};for(const [m,xs] of Object.entries(by)){const pass=xs.filter(x=>x.status==='passed_contract').length;moduleSummary[m]={n:xs.length,contractPassRate:xs.length?pass/xs.length:null,contractCI:bootstrapCI(xs.map(x=>x.status==='passed_contract'?1:0),mean,2000)}}
const quality={};for(const r of rows)if(r.goldValidated&&r.scores)for(const [k,v] of Object.entries(r.scores)){if(typeof v==='number'&&(Number.isFinite(v)))(quality[k]??=[]).push(v)}
for(const [k,v] of Object.entries(quality))quality[k]={n:v.length,mean:mean(v),ci:bootstrapCI(v,mean,2000)};
console.log(JSON.stringify({datasetVersion:p.summary?.datasetVersion||null,generatedAt:new Date().toISOString(),summary:p.summary||{},moduleSummary,quality},null,2));
