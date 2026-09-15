'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
function load(p){return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));}
function sha(p){return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');}
const gold=load('eval/rag_benchmark_real_human_v1.json');
const freeze=load('eval/rag_gold_v1_freeze_manifest.json');
const csvPath='eval/rag_gold_v1.csv';
const cases=Array.isArray(gold.cases)?gold.cases:[];
const total=cases.length;
const scorable=cases.filter(c=>Array.isArray(c.gold_relevant_chunk_ids)&&c.gold_relevant_chunk_ids.length>0).length;
const emptyGold=total-scorable;
const predictionRows=cases.filter(c=>Array.isArray(c.retrieval_results)&&c.retrieval_results.length>0).length;
const goldHash=sha(csvPath);
const report={
  status: total===150 && freeze.gold_frozen===true && freeze.frozen_dataset_sha256===goldHash && predictionRows===0 ? 'PASS' : 'REQUIRES_REVIEW',
  gold:{version:gold.version,frozen:gold.gold_frozen,totalQueries:total,scorableQueries:scorable,nonScorableQueries:emptyGold,freezeHashMatches:freeze.frozen_dataset_sha256===goldHash},
  separation:{thinkforgePredictionsEmbedded:predictionRows>0,queriesWithPredictions:predictionRows},
  benchmarkInterpretation:'150 gold queries are present; retrieval metrics are scorable on 124 queries because 26 have no strictly relevant document under final_relevance == 2.',
  artifactSha256:goldHash
};
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS') process.exit(1);
