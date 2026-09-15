'use strict';
function ranked(rows){return (rows||[]).filter(x=>x&&x.id).sort((a,b)=>(Number(b.rrf_score??b.score??b.semantic_score??0)-Number(a.rrf_score??a.score??a.semantic_score??0)))}
function recallAt(rows,gold,k){const g=new Set(gold||[]);if(!g.size)return null;const got=new Set(ranked(rows).slice(0,k).map(x=>String(x.id)));let hit=0;for(const x of g)if(got.has(String(x)))hit++;return hit/g.size}
function precisionAt(rows,gold,k){const g=new Set(gold||[]);const top=ranked(rows).slice(0,k);if(!top.length)return 0;return top.filter(x=>g.has(String(x.id))).length/top.length}
function reciprocalRank(rows,gold){const g=new Set(gold||[]);if(!g.size)return null;for(let i=0;i<ranked(rows).length;i++)if(g.has(String(ranked(rows)[i].id)))return 1/(i+1);return 0}
function ndcg(rows,gold,k=10){const g=new Set(gold||[]);if(!g.size)return null;const top=ranked(rows).slice(0,k);let dcg=0;top.forEach((x,i)=>{if(g.has(String(x.id)))dcg+=1/Math.log2(i+2)});let idcg=0;for(let i=0;i<Math.min(g.size,k);i++)idcg+=1/Math.log2(i+2);return idcg?dcg/idcg:0}
// Mean Average Precision at k: rewards ranking relevant items near the top,
// not just recalling them somewhere in the top-k (which recallAt alone allows).
function averagePrecision(rows,gold,k=10){const g=new Set(gold||[]);if(!g.size)return null;const top=ranked(rows).slice(0,k);let hits=0,sum=0;top.forEach((x,i)=>{if(g.has(String(x.id))){hits++;sum+=hits/(i+1)}});return hits?sum/Math.min(g.size,k):0}
function aggregate(cases){const vals=['r5','r10','p5','mrr','ndcg10','map10'];const out={cases:cases.length};for(const k of vals){const xs=cases.map(c=>c[k]).filter(Number.isFinite);out[k]=xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null}return out}
module.exports={ranked,recallAt,precisionAt,reciprocalRank,ndcg,averagePrecision,aggregate};
