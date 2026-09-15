'use strict';
/**
 * Derives a normalized Rater-03 CSV by binding its row order to the audited
 * 150-case source file. No labels are changed; only case_id/rater_id are
 * added so downstream joins are explicit and reproducible.
 */
const fs=require('node:fs'), path=require('node:path');
const root=path.join(__dirname,'..');
const dir=path.join(root,'eval','external_gold','capstone_gold_layer_v1','01_inputs');
const source=fs.readFileSync(path.join(dir,'ThinkForge_150_audited_final(3).csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
const r3=fs.readFileSync(path.join(dir,'FULL150_RATER-03_audited(3).csv'),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/);
if(source.length!==r3.length) throw new Error(`Source/R3 row-count mismatch: ${source.length-1} vs ${r3.length-1}`);
const parse=(line)=>{
  const out=[]; let cur='', q=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;
};
const h=parse(r3[0]);
const sh=parse(source[0]); const caseIdx=sh.indexOf('Case ID'); const titleIdx=sh.indexOf('Title'); const srcIdx=sh.indexOf('Source');
const outHeader=['case_id','rater_id',...h]; const rows=[outHeader];
for(let i=1;i<r3.length;i++){
  const rr=parse(r3[i]), ss=parse(source[i]);
  if(rr[0]!==ss[titleIdx] || rr[4]!==ss[srcIdx]) throw new Error(`R3 row ${i} does not align with source case ${ss[caseIdx]}`);
  rows.push([ss[caseIdx],'RATER-03',...rr]);
}
const out=path.join(dir,'FULL150_RATER-03_normalized.csv');
fs.writeFileSync(out,rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')+'\n');
console.log(JSON.stringify({status:'NORMALIZED', output:out, rows:rows.length-1},null,2));
