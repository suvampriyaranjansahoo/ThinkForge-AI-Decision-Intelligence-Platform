'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
function collect(dir){
  const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) out.push(...collect(p));
    else if(e.isFile() && /\.test\.js$/.test(e.name)) out.push(path.relative(root,p));
  }
  return out.sort();
}
const files=collect(path.join(root,'tests'));
const r=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit'});
process.exit(r.status??1);
