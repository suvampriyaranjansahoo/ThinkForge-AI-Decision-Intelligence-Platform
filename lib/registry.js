'use strict';
const crypto=require('node:crypto');
function checksum(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function registerArtifact(existing=[],artifact={}){if(!artifact.id||!artifact.version||!artifact.type)throw new Error('Registry artifact requires id, version and type');const key=`${artifact.type}:${artifact.id}:${artifact.version}`;if(existing.some(a=>`${a.type}:${a.id}:${a.version}`===key))throw new Error('Duplicate registry artifact');return [...existing,{...artifact,checksum:checksum(artifact),status:artifact.status||'candidate',createdAt:artifact.createdAt||new Date().toISOString()}]}
function selectPromotion(artifacts=[],key={}){const found=artifacts.find(a=>a.type===key.type&&a.id===key.id&&a.version===key.version);if(!found)throw new Error('Registry artifact not found');const required=(key.requiredGates||[]);const missing=required.filter(g=>!key.gates?.[g]);if(missing.length)throw new Error(`Promotion blocked: ${missing.join(', ')}`);return {...found,status:'production',promotedAt:new Date().toISOString()}}
module.exports={checksum,registerArtifact,selectPromotion};
