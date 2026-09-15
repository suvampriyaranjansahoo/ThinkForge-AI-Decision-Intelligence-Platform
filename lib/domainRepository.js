'use strict';
const {rpc}=require('./db');

/** Canonical persistence facade. Feature APIs should call this module instead of knowing SQL/RPC names. */
async function saveWorkspace({userId,state,expectedVersion=null,requestId=null}){
  return rpc('thinkforge_sync_workspace_v3',{p_user_id:userId,p_state:state,p_expected_version:expectedVersion,p_request_id:requestId});
}
async function saveDiscovery({userId,organizationId,record,requestId=null}){
  // Compatibility contract: thinkforge_upsert_discovery_v2 remains supported; v3 is the canonical implementation behind the adapter.
  return rpc('thinkforge_upsert_discovery_v3',{p_user_id:userId,p_organization_id:organizationId||null,p_discovery:record,p_request_id:requestId});
}
async function readDecision({userId,organizationId,decisionId}){
  return rpc('thinkforge_read_decision_graph_v2',{p_user_id:userId,p_organization_id:organizationId,p_decision_id:decisionId});
}
async function saveDecisionGraph({userId,organizationId,graph,expectedVersion=null,requestId=null}){
  return rpc('thinkforge_upsert_decision_graph_v2',{p_user_id:userId,p_organization_id:organizationId,p_graph:graph,p_expected_version:expectedVersion,p_request_id:requestId});
}
module.exports={saveWorkspace,saveDiscovery,readDecision,saveDecisionGraph};
