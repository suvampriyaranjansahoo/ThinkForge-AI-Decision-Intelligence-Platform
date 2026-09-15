const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');

test('RAG gold has 150 queries and no embedded predictions',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'eval','rag_benchmark_real_human_v1.json'),'utf8'));
  assert.equal(d.gold_frozen,true);
  assert.equal(d.cases.length,150);
  assert.equal(d.cases.filter(c=>(c.retrieval_results||[]).length>0).length,0);
});

test('RAG gold freeze hash matches CSV',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'eval','rag_gold_v1_freeze_manifest.json'),'utf8'));
  const csv=fs.readFileSync(path.join(root,'eval','rag_gold_v1.csv'));
  const h=crypto.createHash('sha256').update(csv).digest('hex');
  assert.equal(m.gold_frozen,true);
  assert.equal(m.frozen_dataset_sha256,h);
});

test('RAG benchmark distinguishes total queries from scorable retrieval queries',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'eval','rag_benchmark_real_human_v1.json'),'utf8'));
  const scorable=d.cases.filter(c=>(c.gold_relevant_chunk_ids||[]).length>0);
  assert.equal(scorable.length,124);
  assert.equal(d.cases.length-scorable.length,26);
});
