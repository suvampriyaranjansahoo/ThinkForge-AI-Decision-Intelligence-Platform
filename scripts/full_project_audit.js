'use strict';
/**
 * Single reproducible release audit for ThinkForge release package.
 * Combines syntax/tests, protected 15-stage surfaces, engineering readiness,
 * and the supplied private capstone gold-layer status and RAG-gold integrity. This script deliberately
 * distinguishes implementation evidence from empirical claims.
 */
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
function run(args,env={}){const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,...env}});return {code:r.status,stdout:r.stdout,stderr:r.stderr};}
function jsonOut(x){try{return JSON.parse(x);}catch{return null;}}
const tests=spawnSync('npm',['test'],{cwd:root,encoding:'utf8',env:process.env});
const regression=run(['scripts/15stage_regression_gate.js']);
const evidence=run(['scripts/stage_evidence_audit.js']);
const readiness=run(['scripts/research_readiness.js']);
const protocol=run(['scripts/research_protocol_audit.js']);
const capstone=run(['scripts/audit_capstone_gold_layer.js']);
const structural=run(['scripts/stage_structural_index.js']);
const quality=run(['scripts/stage_quality_check.js']);
const report={
  auditVersion:'thinkforge-full-project-audit-v1',
  packageVersion:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,
  timestamp:new Date().toISOString(),
  testSuite:{exitCode:tests.status,summary:(tests.stdout.match(/# tests (\d+)/)?.[1]||null),passed:(tests.stdout.match(/# pass (\d+)/)?.[1]||null),failed:(tests.stdout.match(/# fail (\d+)/)?.[1]||null),skipped:(tests.stdout.match(/# skipped (\d+)/)?.[1]||null)},
  gates:{regression:jsonOut(regression.stdout),stageEvidence:jsonOut(evidence.stdout),researchReadiness:jsonOut(readiness.stdout),researchProtocol:jsonOut(protocol.stdout),capstoneGoldLayer:jsonOut(capstone.stdout),structuralIndex:jsonOut(structural.stdout),stageQuality:jsonOut(quality.stdout)},
  empiricalClaimPolicy:'NEVER inferred from infrastructure, simulations, or incomplete gold; final empirical validation requires a frozen human gold and a separate blind ThinkForge candidate run.'
};
const outDir=path.join(root,'audit');if(!fs.existsSync(outDir))fs.mkdirSync(outDir,{recursive:true});const out=path.join(outDir,'FULL_PROJECT_AUDIT_LATEST.json');fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({status:(tests.status===0&&regression.code===0&&evidence.code===0&&protocol.code===0&&capstone.code===0)?'PASS_WITH_EXTERNAL_DATA_GATES':'REQUIRES_REVIEW',output:out,report},null,2));
process.exit(tests.status===0&&regression.code===0&&evidence.code===0&&protocol.code===0&&capstone.code===0?0:1);
