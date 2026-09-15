'use strict';
function assertStableIdentity(before={},after={}){if(before.id&&after.id&&before.id!==after.id){const e=new Error('Stable entity id cannot change');e.code='STABLE_ID_MUTATION';throw e}return true}
function versionedUpsert(existing,payload={}){const next={...existing,...payload};next.version=Math.max(1,Number(existing.version||0)+1);next.updatedAt=new Date().toISOString();if(existing.id)next.id=existing.id;return next}
module.exports={assertStableIdentity,versionedUpsert};
