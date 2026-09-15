#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','study_manifest.json'),'utf8'));
const rubric=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','rubrics.json'),'utf8'));
const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','annotation_schema.json'),'utf8'));
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const errors=[],warnings=[];
const scoreRange=schema.properties.scores?.additionalProperties;
for(const field of ['unsupportedClaimSeverity','citationCorrectness']) if(!schema.properties[field]) errors.push(`schema_missing:${field}`);
if(scoreRange?.minimum!==1||scoreRange?.maximum!==5) errors.push('scores_must_be_1_to_5');
const requiredSplit=manifest.development_cases+manifest.validation_cases+manifest.locked_test_cases===manifest.main_cases;
if(!requiredSplit) errors.push('split_totals_mismatch');
if(manifest.minimum_independent_raters<2) errors.push('minimum_independent_raters_lt_2');
if(!manifest.rater_policy?.pilot_required||!manifest.rater_policy?.qualification_required) errors.push('rater_qualification_policy_incomplete');
if(!manifest.candidate_policy?.no_lazy_generation||!manifest.candidate_policy?.immutable_checksum) errors.push('candidate_freeze_policy_incomplete');
if(!manifest.blinding?.hide_model_identity||!manifest.blinding?.randomize_left_right) errors.push('blinding_policy_incomplete');
if(manifest.research_claim_gate.minimum_expert_gold_cases<100) errors.push('gold_gate_too_low');
if(manifest.research_claim_gate.minimum_real_rag_gold_queries<50) errors.push('rag_gold_gate_too_low');
if(manifest.research_claim_gate.minimum_decision_impact_participants<20) errors.push('impact_gate_too_low');
const rubricProtocol=String(rubric.protocol?.version||'');if(rubricProtocol!==manifest.protocol_version) errors.push(`rubric_protocol_mismatch:${rubricProtocol}!=${manifest.protocol_version}`);
if(bench.cases.length!==manifest.main_cases) errors.push('benchmark_main_case_count_mismatch');
const knownStances=new Set(['supports','contradicts','neutral','irrelevant','supporting','contradicting']);let unknown=0;for(const c of bench.cases){for(const e of (c.decision?.evidence||[])) if(!knownStances.has(String(e.stance||'').toLowerCase())) unknown++;}
if(unknown) warnings.push(`unknown_evidence_stances:${unknown}`);
console.log(JSON.stringify({ok:errors.length===0,errors,warnings,study:{id:manifest.study_id,version:manifest.study_version,protocol:manifest.protocol_version},benchmark:{version:bench.version,total:bench.cases.length},rubric:{version:rubric.version},controls:{candidateFreeze:true,pilot:true,qualification:true,blinding:true,adjudication:true,claimLevel:true}},null,2));
if(errors.length) process.exit(1);
