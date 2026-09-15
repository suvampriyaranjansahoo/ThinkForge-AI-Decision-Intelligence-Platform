'use strict';
const TRANSITIONS=Object.freeze({PLANNED:['AWAITING_APPROVAL','RUNNING','CANCELLED'],AWAITING_APPROVAL:['RUNNING','CANCELLED'],RUNNING:['TOOL_CALLING','VALIDATING','FAILED','CANCELLED'],TOOL_CALLING:['VALIDATING','FAILED'],VALIDATING:['NEEDS_HUMAN_REVIEW','COMPLETED','FAILED'],NEEDS_HUMAN_REVIEW:['COMPLETED','CANCELLED'],COMPLETED:[],FAILED:[],CANCELLED:[]});
function canTransition(from,to){return Boolean(TRANSITIONS[from]?.includes(to));}
function transition(trace,from,to,detail={}){if(!canTransition(from,to))throw Object.assign(new Error(`Invalid agent transition ${from} -> ${to}`),{code:'AGENT_INVALID_TRANSITION'});return{state:to,entry:{at:new Date().toISOString(),type:'STATE_CHANGED',from,to,...detail}};}
module.exports={TRANSITIONS,canTransition,transition};
