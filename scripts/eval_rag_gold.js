'use strict';
const fs=require('fs');
const path=require('path');
const {recallAt,precisionAt,reciprocalRank,ndcg,averagePrecision,aggregate}=require('../lib/ragMetrics');
const datasetPath=process.env.RAG_DATASET||path.join(__dirname,'..','eval','rag_benchmark_real_human_v1.json');
const ds=JSON.parse(fs.readFileSync(datasetPath,'utf8'));
const cases=(ds.cases||[]).map(c=>{const rows=c.retrieval_results||c.results||[];const gold=c.gold_relevant_chunk_ids||[];return {...c,r5:recallAt(rows,gold,5),r10:recallAt(rows,gold,10),p5:precisionAt(rows,gold,5),mrr:reciprocalRank(rows,gold),ndcg10:ndcg(rows,gold,10),map10:averagePrecision(rows,gold,10)}});
const hasPredictions=cases.some(c=>(c.retrieval_results||c.results||[]).length>0);
if(!hasPredictions){console.log(JSON.stringify({status:'blocked_for_scoring',reason:'Frozen RAG gold loaded successfully, but no ThinkForge retrieval predictions are attached. Run a blind candidate retrieval against these 150 queries.',gold_version:ds.version,cases:cases.length},null,2));process.exit(2)}
const scored=cases.filter(c=>Number.isFinite(c.r5));
console.log(JSON.stringify({status:'measured',...aggregate(scored),details:scored},null,2));
