'use strict';
const fs=require('fs'),path=require('path');
const {bootstrapCI}=require('../lib/evaluationMetrics');
const p=process.argv[2]||path.join(__dirname,'..','eval','latest_results.json');
if(!fs.existsSync(p)){console.error('Missing evaluation results:',p);process.exit(2)}
const d=JSON.parse(fs.readFileSync(p,'utf8'));const s=d.summary||{};const rows=(d.results||[]).filter(x=>x.goldValidated&&x.scores);
const values=rows.flatMap(r=>Object.values(r.scores).filter(Number.isFinite));
const report={datasetVersion:s.datasetVersion||null,cases:s.totalCases||0,executed:s.executedCases||0,expertGold:s.expertGoldCases||0,contractPassRate:s.contractPassRate??null,contractCI:s.contractCI||null,goldMetricSummary:values.length?{mean:values.reduce((a,b)=>a+b,0)/values.length,ci:bootstrapCI(values)}:null,researchQualityClaimAllowed:Boolean(s.researchQualityClaimAllowed&&s.expertGoldCases>=100),limitations:values.length?'Empirical metric calculation available for current gold cases.':'No expert gold metrics available; quality claims remain blocked.'};
console.log(JSON.stringify(report,null,2));
