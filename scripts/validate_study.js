'use strict';
const fs=require('node:fs'),path=require('node:path');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','study_manifest.json'),'utf8'));
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const rubrics=require('../eval/rubrics.json');
const errors=[];if(bench.cases.length!==manifest.main_cases)errors.push('benchmark count mismatch');
if(manifest.development_cases+manifest.validation_cases+manifest.locked_test_cases!==manifest.main_cases)errors.push('split totals mismatch');
for(const c of bench.cases){if(!rubrics.dimensions[c.module])errors.push(`missing rubric module:${c.module}`)}
if(manifest.minimum_independent_raters<2)errors.push('minimum independent raters must be >=2');
if(manifest.hidden_duplicate_rate<=0||manifest.hidden_duplicate_rate>=0.2)errors.push('hidden duplicate rate must be between 0 and 0.2');
console.log(JSON.stringify({valid:errors.length===0,errors,manifest,benchmarkVersion:bench.version,rubricVersion:rubrics.version},null,2));if(errors.length)process.exit(1);
