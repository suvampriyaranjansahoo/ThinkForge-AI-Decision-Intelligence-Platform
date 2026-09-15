'use strict';
const fs=require('node:fs'),path=require('node:path');const {canTransition}=require('../lib/agentState');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','eval','agent_state_machine_v1.json'),'utf8'));
const results=data.cases.map(c=>({id:c.id,from:c.from,to:c.to,node:canTransition(c.from,c.to),expectedNode:c.expectedNode,expectedDjango:c.expectedDjango}));
const mismatches=results.filter(r=>r.node!==r.expectedNode),divergences=results.filter(r=>r.expectedNode!==r.expectedDjango);
console.log(JSON.stringify({datasetVersion:data.version,nodeCases:results.length,nodeMismatches:mismatches,declaredNodeDjangoDivergences:divergences},null,2));
if(mismatches.length)process.exitCode=1;
