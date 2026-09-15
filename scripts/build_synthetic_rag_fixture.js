'use strict';
const fs=require('fs'),path=require('path');
const outDir=path.join(__dirname,'..','eval');
const documents=[];const cases=[];
const topics=[
 ['payment recovery','Payments failed but recovery messaging reduced duplicate-charge anxiety.'],
 ['onboarding friction','Onboarding friction was concentrated in identity verification and permission setup.'],
 ['retention experiment','The proposed retention experiment targets repeat engagement with a measurable D7 rate.'],
 ['permission failures','Enterprise users reported role and permission mismatch errors during workspace setup.'],
 ['prior decision','A prior decision improved activation modestly but did not improve retention.']
];
for(let i=1;i<=60;i++){
  const [topic,text]=topics[(i-1)%topics.length];
  documents.push({id:`SYN-DOC-${String(i).padStart(3,'0')}`,source:`synthetic://${topic.replace(/\s+/g,'-')}/${i}`,text:`Synthetic evaluation document ${i}. Topic: ${topic}. ${text}`});
}
for(let i=1;i<=120;i++){
  const idx=(i-1)%documents.length;const d=documents[idx];
  cases.push({id:`SYN-RAG-${String(i).padStart(3,'0')}`,query:`Find evidence about ${topics[(i-1)%topics.length][0]}.`,gold_relevant_chunk_ids:[`${d.id}-c0`],acceptable_source_ids:[d.id],annotation_status:'synthetic_gold',synthetic:true,results:[{id:`${d.id}-c0`,score:1,rrf_score:1},{id:`${documents[(idx+1)%documents.length].id}-c0`,score:.1,rrf_score:.1},{id:`${documents[(idx+2)%documents.length].id}-c0`,score:.05,rrf_score:.05}]});
}
fs.writeFileSync(path.join(outDir,'rag_synthetic_documents.json'),JSON.stringify({version:'synthetic-rag-v1',documents},null,2));
fs.writeFileSync(path.join(outDir,'rag_benchmark_synthetic.json'),JSON.stringify({version:'synthetic-rag-benchmark-v1',synthetic:true,cases},null,2));
console.log(JSON.stringify({documents:documents.length,cases:cases.length,synthetic:true},null,2));
