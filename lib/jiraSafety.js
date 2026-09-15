'use strict';
function validateJiraWrite({confirm=false,projectKey='',idempotencyKey='',authorized=false}={}){const errors=[];if(!confirm)errors.push('explicit_confirmation_required');if(!authorized)errors.push('authorized_jira_identity_required');if(!projectKey)errors.push('project_key_required');if(!idempotencyKey)errors.push('idempotency_key_required');return{allowed:errors.length===0,errors}}
module.exports={validateJiraWrite};
