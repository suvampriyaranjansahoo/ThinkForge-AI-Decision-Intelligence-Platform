'use strict';
const fs=require('node:fs'),path=require('node:path');
const {buildAssignments,splitForCase}=require('../lib/annotationAssignments');
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const raterId=process.argv[2]||'demo-rater';
const assignments=buildAssignments(bench.cases,raterId);
const base=bench.cases.map((c,i)=>({caseId:c.id,split:splitForCase(i,bench.cases.length)}));
fs.writeFileSync(process.argv[3]||path.join(__dirname,'..','eval','annotation_assignments_demo.json'),JSON.stringify({version:'tf-human-v3',raterId,benchmarkVersion:bench.cases.length,split:base,assignments,hiddenDuplicateRate:(assignments.length-bench.cases.length)/bench.cases.length},null,2));
console.log(JSON.stringify({raterId,cases:bench.cases.length,presentations:assignments.length,hiddenDuplicates:assignments.filter(x=>x.isHiddenDuplicate).length},null,2));
