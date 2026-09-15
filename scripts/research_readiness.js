'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'eval','study_manifest.json'),'utf8'));
const bench=JSON.parse(fs.readFileSync(path.join(root,'eval','benchmark_300.json'),'utf8'));
const splits=JSON.parse(fs.readFileSync(path.join(root,'eval','benchmark_split_manifest.json'),'utf8'));
const ids={dev:new Set(splits.splits.development),val:new Set(splits.splits.validation),test:new Set(splits.splits.test)};
const checks={
 benchmarkFrozen:bench.cases.length===manifest.main_cases,
  benchmarkSplitsFrozen:splits.total===300 && splits.splits.development.length===60 && splits.splits.validation.length===60 && splits.splits.test.length===180 && [...ids.dev].every(x=>!ids.val.has(x)&&!ids.test.has(x)) && [...ids.val].every(x=>!ids.test.has(x)),
 candidateFreezePolicy:manifest.candidate_policy?.frozen_before_main_annotation===true && manifest.candidate_policy?.no_lazy_generation===true,
 qualificationGate:manifest.rater_policy?.qualification_required===true,
 independentRaters:manifest.minimum_independent_raters>=2,
 hiddenDuplicates:manifest.hidden_duplicate_rate>0,
 adjudication:manifest.adjudication?.required_on_disagreement===true,
 canonicalGold:manifest.adjudication?.canonical_gold_source==='adjudication',
 claimLevel:manifest.claim_level_policy?.enabled===true,
 ragGoldGate:Number(manifest.research_claim_gate?.minimum_real_rag_gold_queries||0)>=50,
 impactGate:Number(manifest.research_claim_gate?.minimum_decision_impact_participants||0)>=20,
};
const implemented=Object.values(checks).filter(Boolean).length;const missing=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
const externalGoldPath=path.join(root,'eval','external_gold','stage1_gold.json');
const annotationPath=path.join(root,'eval','external_gold','researcher_annotations.json');
const caseBankPath=path.join(root,'eval','external_gold','case_bank.json');
let externalGoldCases=0;
let externalAnnotationRows=0;
let realCaseBankCases=0;
let externalGoldFrozen=false;
let realRagGoldQueries=0;
if(fs.existsSync(path.join(root,'eval','rag_benchmark_real_human_v1.json'))){
  try{const rag=JSON.parse(fs.readFileSync(path.join(root,'eval','rag_benchmark_real_human_v1.json'),'utf8')); realRagGoldQueries=Array.isArray(rag.cases)?rag.cases.filter(c=>(c.gold_relevant_chunk_ids||[]).length>0&&!c.synthetic).length:0;}catch{}
}

if(fs.existsSync(caseBankPath)){
  try{const bank=JSON.parse(fs.readFileSync(caseBankPath,'utf8')); realCaseBankCases=Array.isArray(bank.cases)?bank.cases.length:0;}catch{}
}
if(fs.existsSync(annotationPath)){
  try{const ann=JSON.parse(fs.readFileSync(annotationPath,'utf8')); externalAnnotationRows=Array.isArray(ann)?ann.length:(Array.isArray(ann.annotations)?ann.annotations.length:(Array.isArray(ann.cases)?ann.cases.length:0));}catch{}
}
if(fs.existsSync(externalGoldPath)){
  try{const gold=JSON.parse(fs.readFileSync(externalGoldPath,'utf8')); externalGoldCases=Array.isArray(gold.cases)?gold.cases.length:0; externalGoldFrozen=gold.goldFrozen===true;}catch{}
}
const capstoneAuditPath=path.join(root,'eval','external_gold','capstone_gold_layer_v1','04_audit','CAPSTONE_INTEGRITY_REPORT.json');
let capstone=null;
if(fs.existsSync(capstoneAuditPath)){
  try{capstone=JSON.parse(fs.readFileSync(capstoneAuditPath,'utf8'));}catch{}
}
const empirical={expertGoldCases:externalGoldCases,annotationRows:externalAnnotationRows,realCaseBankCases,realRagGoldQueries,decisionImpactParticipants:0,realOutcomeRecords:0,externalGoldFrozen,capstone:{caseCount:Number(capstone?.structural?.caseCount||0),raterRows:Number((capstone?.structural?.raterRows?.r1||0)+(capstone?.structural?.raterRows?.r2||0)+(capstone?.structural?.raterRows?.r3||0)),pendingAdjudication:capstone?.quality?.scopeFinalized===true?0:Number(capstone?.structural?.pendingAdjudication||0),excludedUnavailableCases:capstone?.quality?.scopeFinalized===true?Number(capstone?.structural?.pendingAdjudication||0):0,lockedFraction:Number(capstone?.integrity?.lockedFraction||0),pilotStatus:capstone?.gateInterpretation?.pilot||'NOT_PRESENT',scopeStatus:capstone?.quality?.scopeFinalized===true?'FINALIZED_146_CASES':'PENDING_ADJUDICATION'}};
const empiricalStatus=externalGoldCases>=100&&externalGoldFrozen?'READY_FOR_BLIND_CANDIDATE_EVALUATION':(capstone?.structural?.candidateConfirmed>=100&&capstone?.structural?.pendingAdjudication>0)?'READY_FOR_FINAL_HUMAN_ADJUDICATION':realCaseBankCases>=100?'READY_FOR_HUMAN_ANNOTATION':'BLOCKED_UNTIL_REAL_CASE_BANK';
const status=missing.length?'BLOCKED_BY_INFRASTRUCTURE':empiricalStatus;
console.log(JSON.stringify({status,infrastructureScore:implemented/Object.keys(checks).length,checks,missing,empirical,externalGoldPath,annotationPath,caseBankPath,claimPolicy:'Empirical claims remain blocked until actual human/RAG/decision/outcome data are collected, adjudicated, and frozen.'},null,2));
