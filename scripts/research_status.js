'use strict';
const fs=require('fs'),path=require('path');
const bench=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','benchmark_300.json'),'utf8'));
const rag=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','rag_benchmark.json'),'utf8'));
const goldCases=bench.cases.filter(c=>c.annotation_status==='gold'&&c.provenance?.is_expert_labeled).length;
const ragGold=rag.cases.filter(c=>(c.gold_relevant_chunk_ids||[]).length>0&&!c.synthetic).length;
const syntheticGold=rag.cases.filter(c=>(c.gold_relevant_chunk_ids||[]).length>0&&c.synthetic).length;
console.log(JSON.stringify({benchmark:{total:bench.cases.length,expertGold:goldCases,expertGoldTarget:100},rag:{total:rag.cases.length,realGold:ragGold,syntheticGold},researchQualityReady:goldCases>=100&&ragGold>=50},null,2));
