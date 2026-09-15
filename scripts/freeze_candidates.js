'use strict';
const fs=require('node:fs'),path=require('node:path');
const {callModel}=require('../lib/ai');
const {hashJson}=require('../lib/researchStudy');
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','study_manifest.json'),'utf8'));
const {studyManifestHash}=require('../lib/researchStudy');
const outDir=path.join(__dirname,'..','eval','candidate_snapshots');fs.mkdirSync(outDir,{recursive:true});
const studyId=process.env.STUDY_ID||manifest.study_id;const safe=studyId.replace(/[^a-zA-Z0-9._-]/g,'_');const outputPath=path.join(outDir,`${safe}.json`);
const limit=Number(process.env.FREEZE_LIMIT||bench.cases.length);
async function main(){
 if(fs.existsSync(outputPath)&&process.env.FORCE_FREEZE!=='true'){const existing=JSON.parse(fs.readFileSync(outputPath,'utf8'));if(existing.immutable===true&&existing.caseCount===bench.cases.length&&existing.studyManifestHash===studyManifestHash({id:studyId,version:manifest.study_version,datasetVersion:manifest.dataset_version,rubricVersion:manifest.rubric_version,protocolVersion:manifest.protocol_version,candidateSnapshot:manifest.candidate_snapshot||'pending',pilotCases:manifest.pilot_cases,mainCases:manifest.main_cases,developmentCases:manifest.development_cases,validationCases:manifest.validation_cases,lockedTestCases:manifest.locked_test_cases,minimumIndependentRaters:manifest.minimum_independent_raters,hiddenDuplicateRate:manifest.hidden_duplicate_rate})){ console.log(JSON.stringify({status:'already_frozen',path:outputPath,caseCount:existing.caseCount,checksum:existing.checksum},null,2));return;}}
 if(limit!==bench.cases.length && process.env.ALLOW_PARTIAL_FREEZE!=='true')throw new Error(`Refusing partial candidate freeze (${limit}/${bench.cases.length}). Set ALLOW_PARTIAL_FREEZE=true for development only.`);
 const rows=[];for(const c of bench.cases.slice(0,limit)){const out=await callModel(c.module,c.decision,`study:${studyId}:case:${c.id}`);rows.push({caseId:c.id,module:c.module,model:out.meta.model,promptVersion:out.meta.promptVersion,retrieverVersion:out.meta.retrieverVersion,requestId:out.meta.requestId,generatedAt:new Date().toISOString(),output:out.data});}
 if(rows.length!==bench.cases.length && process.env.ALLOW_PARTIAL_FREEZE!=='true')throw new Error('Candidate snapshot is incomplete');
 const snapshot={studyId,studyManifestHash:studyManifestHash({id:studyId,version:manifest.study_version,datasetVersion:manifest.dataset_version,rubricVersion:manifest.rubric_version,protocolVersion:manifest.protocol_version,candidateSnapshot:manifest.candidate_snapshot||'pending',pilotCases:manifest.pilot_cases,mainCases:manifest.main_cases,developmentCases:manifest.development_cases,validationCases:manifest.validation_cases,lockedTestCases:manifest.locked_test_cases,minimumIndependentRaters:manifest.minimum_independent_raters,hiddenDuplicateRate:manifest.hidden_duplicate_rate}),datasetVersion:bench.version,rubricVersion:manifest.rubric_version,protocolVersion:manifest.protocol_version,modelTag:process.env.MODEL_TAG||'configured-runtime',createdAt:new Date().toISOString(),caseCount:rows.length,immutable:true,rows,checksum:hashJson(rows)};
 fs.writeFileSync(outputPath,JSON.stringify(snapshot,null,2));
 console.log(JSON.stringify({status:'frozen',path:outputPath,caseCount:snapshot.caseCount,checksum:snapshot.checksum},null,2));
}
main().catch(e=>{console.error(e.message);process.exit(1)});
