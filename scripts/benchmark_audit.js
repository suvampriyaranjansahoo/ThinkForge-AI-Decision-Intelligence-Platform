'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const cases=bench.cases||[];
const norm=s=>String(s||'').toLowerCase().trim();
const stance=s=>{const x=norm(s);if(['supports','supporting'].includes(x))return'supporting';if(['contradicts','contradicting'].includes(x))return'contradicting';if(['neutral','irrelevant'].includes(x))return'neutral';return x||'unknown'};
const conditionCounts={supporting:0,contradicting:0,mixed:0,insufficient:0,neutral_or_other:0};
const templateSignatures=new Map();const fingerprints=new Map();const domains={},diffs={},modules={};let missing=0;
for(const c of cases){domains[c.domain]=(domains[c.domain]||0)+1;diffs[c.difficulty]=(diffs[c.difficulty]||0)+1;modules[c.module]=(modules[c.module]||0)+1;const ev=c.decision?.evidence||[];const st=[...new Set(ev.map(e=>stance(e.stance)))];if(st.includes('supporting')&&st.includes('contradicting'))conditionCounts.mixed++;else if(st.includes('contradicting'))conditionCounts.contradicting++;else if(st.includes('supporting'))conditionCounts.supporting++;else if(!ev.length)conditionCounts.insufficient++;else conditionCounts.neutral_or_other++;
 const sig=[c.module,c.domain,c.difficulty,c.input_prompt,JSON.stringify(c.decision?.evidence?.map(e=>({stance:e.stance,text:e.text})))].map(norm).join('|');templateSignatures.set(sig,(templateSignatures.get(sig)||0)+1);const fp=crypto.createHash('sha256').update([c.module,c.input_prompt,JSON.stringify(c.decision||{})].join('|')).digest('hex');fingerprints.set(fp,(fingerprints.get(fp)||0)+1);if(!c.input_prompt||!c.decision)missing++;}
const dupTemplate=[...templateSignatures.values()].filter(n=>n>1).reduce((a,n)=>a+n-1,0);const dupExact=[...fingerprints.values()].filter(n=>n>1).reduce((a,n)=>a+n-1,0);
console.log(JSON.stringify({datasetVersion:bench.version,total:cases.length,modules,domains,difficulty:diffs,evidenceConditions:conditionCounts,missingRequiredFields:missing,nearDuplicateSignals:{templateSignatureDuplicates:dupTemplate,exactFingerprintDuplicates:dupExact},recommendation:dupTemplate?'expert_curation_required':'benchmark_clean'},null,2));
