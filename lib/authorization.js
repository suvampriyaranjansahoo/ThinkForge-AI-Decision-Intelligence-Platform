'use strict';
const {rest}=require('./db');
const ROLES={owner:5,admin:4,editor:3,reviewer:2,viewer:1};
async function getMembership(userId, organizationId){
  if(!userId||!organizationId)return null;
  const r=await rest(`thinkforge_memberships?user_id=eq.${encodeURIComponent(userId)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=organization_id,user_id,role`,'GET');
  if(!r.ok)return null; const rows=await r.json(); return rows?.[0]||null;
}
function roleAtLeast(role,minimum){return Boolean(ROLES[role]&&ROLES[minimum]&&ROLES[role]>=ROLES[minimum]);}
async function requireOrgRole(userId,organizationId,minimum='viewer'){
  const m=await getMembership(userId,organizationId);
  if(!m||!roleAtLeast(m.role,minimum)){const e=new Error('Insufficient workspace permissions');e.code='FORBIDDEN';e.status=403;throw e;}
  return m;
}
module.exports={ROLES,getMembership,roleAtLeast,requireOrgRole};
