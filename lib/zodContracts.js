'use strict';
let z=null;try{z=require('zod')}catch{}
const STATUS=['open','validated','invalidated','superseded'];
function text(min=1,max=3000){return z.string().min(min).max(max)}
function schemaFor(action){if(!z)return null;
 if(action==='assumptions')return z.object({assumptions:z.array(z.object({id:z.string().min(1).max(120).optional(),text:text(3,1200),impact:z.number().int().min(1).max(5),uncertainty:z.number().int().min(1).max(5),confidence:z.number().min(0).max(1),status:z.enum(STATUS),rationale:text(1,2000),evidence_refs:z.array(z.string().min(1).max(200)).max(30).optional()})).min(1).max(8)});
 if(action==='challenge')return z.object({challenges:z.array(z.object({priority:z.number().int().min(1).max(5),assumption:text(3,1200),question:text(3,1600),why:text(3,2200),evidence_refs:z.array(z.string().min(1).max(200)).max(30)})).length(3)});
 if(action==='experiment')return z.object({experiment:z.object({hypothesis:text(1,2200),control:text(1,2200),intervention:text(1,2200),primary:text(1,2200),guardrails:z.array(text(1,800)).max(20),baseline:text(1,1000).optional(),target:text(1,1000).optional(),prediction:text(1,1000).optional(),successRule:text(1,2200),failureRule:text(1,2200),alpha:z.number().min(.0001).max(.5).optional(),power:z.number().min(.5).max(.999).optional(),mde:z.number().min(0).optional(),sampleSize:z.number().int().min(2).max(100000000).optional()})});
 if(action==='synthesize')return z.object({summary:text(3,3000),recommendation:z.enum(['validate','build','defer','do_not_build']),evidence_gaps:z.array(text(1,1000)).max(30),next_action:text(3,1600),confidence:z.number().min(0).max(1).optional()});
 if(action==='prd')return z.object({title:text(1,3000),problem:text(1,3000),targetUser:text(1,3000),evidence:z.array(z.string()).max(50),assumptions:z.array(z.string()).max(50),decision:text(1,3000),scope:z.array(z.string()).max(50),outOfScope:z.array(z.string()).max(50),metrics:z.object({primary:text(1,800),secondary:z.array(z.string()).max(30),guardrails:z.array(z.string()).max(30)}),experiment:text(1,3000),openQuestions:z.array(z.string()).max(50)});
 if(action==='insights')return z.object({insights:z.array(z.object({title:text(1,2200),finding:text(1,2200),evidence:text(1,2200),recommendation:text(1,2200)})).max(20)});
 return null;
}
function safeParse(action,value){const s=schemaFor(action);return s?s.safeParse(value):null}
module.exports={safeParse,available:Boolean(z)};
