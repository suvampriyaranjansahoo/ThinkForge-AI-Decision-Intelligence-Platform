'use strict';
const fs=require('node:fs'),path=require('node:path');
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const rubric=require('../eval/rubrics.json');
const splits={development:0,validation:0,locked_test:0};
for(let i=0;i<bench.cases.length;i++) splits[i<60?'development':i<120?'validation':'locked_test']++;
const evidenceConditions={supporting:0,contradicting:0,mixed:0,insufficient:0,neutral_or_other:0};
const stance=s=>{const x=String(s||'').toLowerCase().trim();if(x==='supports'||x==='supporting')return'supporting';if(x==='contradicts'||x==='contradicting')return'contradicting';if(x==='neutral'||x==='irrelevant')return'neutral';return x||'unknown'};
for(const c of bench.cases){const e=c.decision?.evidence||[];const st=[...new Set(e.map(x=>stance(x.stance)))];if(st.includes('supporting')&&st.includes('contradicting'))evidenceConditions.mixed++;else if(st.includes('contradicting'))evidenceConditions.contradicting++;else if(st.includes('supporting'))evidenceConditions.supporting++;else if(!e.length)evidenceConditions.insufficient++;else evidenceConditions.neutral_or_other++;}
const domainCounts={};const difficultyCounts={};for(const c of bench.cases){domainCounts[c.domain]=(domainCounts[c.domain]||0)+1;difficultyCounts[c.difficulty]=(difficultyCounts[c.difficulty]||0)+1;}
console.log(JSON.stringify({protocol:rubric.protocol,rubricVersion:rubric.version,benchmark:{total:bench.cases.length,splits,evidenceConditions,domainCounts,difficultyCounts},target:{minimumIndependentRaters:2,pilotCases:30,hiddenDuplicateRate:0.05},status:'ready_for_human_collection'},null,2));
