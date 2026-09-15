'use strict';
const fs=require('fs'),path=require('path');
const minContract=Number(process.env.MIN_CONTRACT_PASS_RATE||0.98),maxDelta=Number(process.env.MAX_QUALITY_DROP||0.02);
const currentPath=process.argv[2]||process.env.EVAL_RESULTS;if(!currentPath){console.error('Usage: node scripts/regression_gate.js <current-results.json> [baseline-results.json]');process.exit(2)}
const current=JSON.parse(fs.readFileSync(path.resolve(currentPath),'utf8'));const baselinePath=process.argv[3]||process.env.BASELINE_EVAL_RESULTS;const baseline=baselinePath&&fs.existsSync(baselinePath)?JSON.parse(fs.readFileSync(path.resolve(baselinePath),'utf8')):null;const s=current.summary||{},fail=[];
if(s.executedCases>0&&(s.contractPassRate??0)<minContract)fail.push(`contract pass rate ${s.contractPassRate} < ${minContract}`);
if((s.researchQualityClaimAllowed!==true||Number(s.expertGoldCases||0)<Number(process.env.MIN_GOLD_CASES||100)))fail.push('research-quality gate remains blocked until expert gold labels meet the configured threshold');
if(baseline){for(const k of ['contractPassRate']){if(Number.isFinite(Number(s[k]))&&Number.isFinite(Number(baseline.summary?.[k]))&&Number(s[k])<Number(baseline.summary[k])-maxDelta)fail.push(`${k} regressed beyond ${maxDelta}`)}}
if(fail.length){console.error('REGRESSION GATE: BLOCKED');fail.forEach(x=>console.error('- '+x));process.exit(1)}
console.log('REGRESSION GATE: PASS');
