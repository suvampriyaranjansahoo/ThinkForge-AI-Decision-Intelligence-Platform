'use strict';
const fs=require('node:fs');
const file=process.argv[2]||'coverage/lcov.info',minimum=Number(process.argv[3]||20);
if(!fs.existsSync(file))throw new Error(`Coverage report not found: ${file}`);
const records=fs.readFileSync(file,'utf8').split('end_of_record');let found=0,hits=0;
for(const record of records)for(const line of record.split(/\r?\n/)){const match=/^DA:\d+,(\d+)$/.exec(line);if(match){found++;if(Number(match[1])>0)hits++;}}
if(!found)throw new Error(`Coverage report has no line data: ${file}`);
const percent=Number((hits/found*100).toFixed(2));console.log(JSON.stringify({file,linesFound:found,linesHit:hits,lineCoverage:percent,minimum},null,2));
if(percent<minimum){console.error(`Line coverage ${percent}% is below the ${minimum}% floor.`);process.exitCode=1;}
