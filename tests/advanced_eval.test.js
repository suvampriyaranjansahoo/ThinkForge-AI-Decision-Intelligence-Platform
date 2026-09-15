const test=require('node:test');const assert=require('node:assert/strict');
const {semanticSimilarity,semanticSetScore,claimSupport}=require('../lib/semanticMetrics');
const {cohenKappa}=(()=>{const fs=require('fs'); return {cohenKappa:(a,b)=>{const n=Math.min(a.length,b.length);const agree=a.slice(0,n).filter((x,i)=>x===b[i]).length/n;const cats=[1,2,3,4,5];const pa=Object.fromEntries(cats.map(c=>[c,a.filter(x=>x===c).length/n]));const pb=Object.fromEntries(cats.map(c=>[c,b.filter(x=>x===c).length/n]));const pe=cats.reduce((s,c)=>s+(pa[c]||0)*(pb[c]||0),0);return pe===1?1:(agree-pe)/(1-pe)}}})();
test('semantic similarity recognizes paraphrases',()=>assert.ok(semanticSimilarity('Weekly repeat usage increases','Weekly repeat users increase')>0.3));
test('semantic set scoring is not exact-string only',()=>{const s=semanticSetScore(['Improve repeat purchase retention'],['Improve repeat purchases retained']);assert.ok(s.f1>0)});
test('claim support returns top evidence',()=>{const r=claimSupport('payment recovery reduced anxiety',[{id:'e1',content:'Payment recovery messaging reduced duplicate-charge anxiety.'}]);assert.equal(r.supported,true);assert.equal(r.top.id,'e1')});
test('cohen kappa operational calculation',()=>assert.equal(cohenKappa([1,2,3,4],[1,2,3,4]),1));
