'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const study=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','study_manifest.json'),'utf8'));
const outDir=path.join(__dirname,'..','eval','candidate_snapshots');fs.mkdirSync(outDir,{recursive:true});
const sourceTag=process.env.CANDIDATE_SOURCE||'live-runtime';
const rows=[];for(const c of bench.cases){rows.push({case_id:c.id,module:c.module,source:sourceTag,model:process.env.MODEL_TAG||'configured-runtime',prompt_version:process.env.PROMPT_VERSION||'runtime',retriever_version:process.env.RETRIEVER_VERSION||'runtime'});}
const canonical=JSON.stringify(rows);const checksum=crypto.createHash('sha256').update(canonical).digest('hex');const snapshot={study_id:study.study_id,dataset_version:study.dataset_version,rubric_version:study.rubric_version,protocol_version:study.protocol_version,candidate_count:rows.length,immutable:true,checksum,created_at:new Date().toISOString(),rows};const p=path.join(outDir,`${study.study_id}.manifest.json`);fs.writeFileSync(p,JSON.stringify(snapshot,null,2));console.log(JSON.stringify({path:p,candidateCount:rows.length,checksum},null,2));
