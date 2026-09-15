'use strict';

const ALIASES = {users:'user',usage:'use',uses:'use',using:'use',used:'use',increases:'increase',increased:'increase',increasing:'increase',purchases:'purchase',purchased:'purchase',retained:'retain',retention:'retain'};
const STOPWORDS = new Set('a an the and or but if then than of to for from in on at by with without into over under is are was were be been being this that these those it its as we our you your they their will would can could should may might do does did not no yes very more less most least'.split(/\s+/));

function stem(token){
  let t=token.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(t.length<=3)return t;
  for(const suffix of ['ingly','edly','ing','ed','ies','es','s']){
    if(t.endsWith(suffix) && t.length-suffix.length>=3){
      t=t.slice(0,-suffix.length);
      if(t.endsWith('i') && suffix==='ies') t=t.slice(0,-1)+'y';
      break;
    }
  }
  return ALIASES[t] || t;
}

function tokens(text){
  return [...new Set(String(text||'').split(/\s+/).map(stem).filter(Boolean).filter(x=>!STOPWORDS.has(x)))];
}

function jaccard(a,b){
  const A=new Set(a),B=new Set(b); if(!A.size&&!B.size)return 1; if(!A.size||!B.size)return 0;
  let i=0;for(const x of A)if(B.has(x))i++;return i/(A.size+B.size-i);
}

function semanticSimilarity(a,b){return jaccard(tokens(a),tokens(b));}
function bestMatch(gold,actual,threshold=0.45){
  let best={score:0,index:-1};
  actual.forEach((x,i)=>{const score=semanticSimilarity(gold,x);if(score>best.score)best={score,index:i};});
  return best.score>=threshold?best:null;
}
function semanticSetScore(gold=[],actual=[],threshold=0.45){
  const used=new Set(),matches=[];
  for(const g of gold){let best=null;actual.forEach((a,i)=>{if(used.has(i))return;const score=semanticSimilarity(g,a);if(!best||score>best.score)best={score,index:i};});
    if(best&&best.score>=threshold){used.add(best.index);matches.push({gold:g,actual:actual[best.index],similarity:best.score});}
  }
  const tp=matches.length,precision=actual.length?tp/actual.length:0,recall=gold.length?tp/gold.length:1;
  return {precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,tp,fp:Math.max(0,actual.length-tp),fn:Math.max(0,gold.length-tp),matches};
}

function normalizeClaim(text){return tokens(text).join(' ')}
function claimSupport(claim,evidence=[],threshold=0.25){
  const ranked=evidence.map((e,i)=>({index:i,id:e?.id,text:String(e?.content||e?.text||''),score:semanticSimilarity(claim,e?.content||e?.text||'')})).sort((a,b)=>b.score-a.score);
  const top=ranked[0]||{score:0};
  return {supported:top.score>=threshold,score:top.score,top:top.id?top:null};
}
function groundingScore(claims,evidence,threshold=.25){
  const arr=(claims||[]).map(c=>claimSupport(c,evidence,threshold));
  return {claims:arr.length,supported:arr.filter(x=>x.supported).length,unsupported:arr.filter(x=>!x.supported).length,rate:arr.length?arr.filter(x=>x.supported).length/arr.length:null,details:arr};
}
module.exports={tokens,jaccard,semanticSimilarity,semanticSetScore,claimSupport,groundingScore,normalizeClaim};
