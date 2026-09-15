'use strict';
/**
 * Compute auditable pairwise agreement for the supplied capstone rater files.
 * This is descriptive reliability evidence; it does not assert rater identity
 * or convert a candidate gold into final empirical gold.
 */
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const dir=path.join(root,'eval','external_gold','capstone_gold_layer_v1','01_inputs');
function csv(text){const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const parse=(line)=>{const out=[];let q=false,c='';for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===','&&!q){out.push(c);c='';}else c+=ch;}out.push(c);return out;};const h=parse(lines[0]);return lines.slice(1).filter(Boolean).map(x=>Object.fromEntries(h.map((k,i)=>[k,parse(x)[i]??''])));}
function load(name){return csv(fs.readFileSync(path.join(dir,name),'utf8'));}
const files=[['RATER-01','FULL150_RATER-01_annotated(2).csv'],['RATER-02','FULL150_RATER-02_completed(2).csv'],['RATER-03','FULL150_RATER-03_normalized.csv']];
const data=Object.fromEntries(files.map(([id,f])=>[id,load(f)]));
const dims=['failure_category','severity','affected_stakeholder','root_cause','contradiction','abstention'];
function kappa(a,b){const n=a.length;if(!n)return null;const po=a.reduce((s,v,i)=>s+(v===b[i]?1:0),0)/n;const cats=[...new Set([...a,...b])];let pe=0;for(const c of cats){const pa=a.filter(x=>x===c).length/n;const pb=b.filter(x=>x===c).length/n;pe+=pa*pb;}return pe===1?1:(po-pe)/(1-pe);}
const results={};for(const [a,fa] of files){for(const [b,fb] of files){if(a>=b)continue;const aa=data[a],bb=data[b];results[`${a}_vs_${b}`]={};for(const d of dims){const av=aa.map(r=>String(r[d]??'')),bv=bb.map(r=>String(r[d]??''));const po=av.filter((v,i)=>v===bv[i]).length/av.length;results[`${a}_vs_${b}`][d]={n:av.length,agreement:Number(po.toFixed(4)),cohenKappa:Number(kappa(av,bv).toFixed(4))};}}}
const out={reportVersion:'capstone-rater-reliability-v1',source:'user-supplied confidential rater files',cases:150,raters:3,dimensions:dims,results};
const outPath=path.join(root,'eval','external_gold','capstone_gold_layer_v1','04_audit','CAPSTONE_RATER_RELIABILITY.json');fs.writeFileSync(outPath,JSON.stringify(out,null,2));console.log(JSON.stringify({status:'RELIABILITY_REPORT_WRITTEN',output:outPath,results},null,2));
