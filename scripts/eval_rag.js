'use strict';
const fs=require('fs'),path=require('path');const {recallAt,precisionAt,reciprocalRank,ndcg,averagePrecision,aggregate}=require('../lib/ragMetrics');
const datasetPath=process.env.RAG_DATASET||path.join(__dirname,'..','eval','rag_benchmark.json'); const ds=JSON.parse(fs.readFileSync(datasetPath,'utf8'));
const cases=(ds.cases||[]).map(c=>{const gold=c.gold_relevant_chunk_ids||c.gold_chunks||[];const rows=c.results||[];return {...c,r5:recallAt(rows,gold,5),r10:recallAt(rows,gold,10),p5:precisionAt(rows,gold,5),mrr:reciprocalRank(rows,gold),ndcg10:ndcg(rows,gold,10),map10:averagePrecision(rows,gold,10)}});
const annotated=cases.filter(c=>(c.gold_relevant_chunk_ids||c.gold_chunks||[]).length>0);
if(!annotated.length){console.log(JSON.stringify({status:'blocked',reason:'No gold retrieval labels present. Retrieval metrics are intentionally not fabricated.',totalCases:cases.length,dataset:ds.version||datasetPath},null,2));process.exit(2)}
console.log(JSON.stringify({status:'measured',...aggregate(annotated),details:annotated},null,2));
