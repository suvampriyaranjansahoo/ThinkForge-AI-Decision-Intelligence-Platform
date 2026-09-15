'use strict';
const fs=require('node:fs'),path=require('node:path');
const {verifyClaims}=require('../lib/reasoning');
const file=path.join(__dirname,'..','eval','reasoning_benchmark.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
function hasGold(cases){return cases.some(c=>c.gold&&typeof c.gold==='object');}
if(!hasGold(data.cases)){
  console.log(JSON.stringify({status:'BLOCKED_UNTIL_HUMAN_GOLD',version:data.version,cases:data.cases.length,reason:'No human/adjudicated gold labels are present; empirical reasoning quality must not be fabricated.'},null,2));
  process.exit(2);
}
const results=[];
for(const c of data.cases){if(!c.gold)continue;const actual=verifyClaims(c.gold.predictions||[],c.evidence||[]);results.push({id:c.id,actual});}
console.log(JSON.stringify({status:'READY',version:data.version,evaluated:results.length,results},null,2));
