export type Recommendation = 'validate'|'build'|'defer'|'do_not_build';
export interface EvidenceRef { id:string; source?:string; content:string; stance?:'supports'|'contradicts'|'neutral'; strength?:'weak'|'medium'|'strong'; url?:string; date?:string; }
export interface Assumption { id:string; text:string; impact:number; uncertainty:number; confidence:number; status:'open'|'validated'|'invalidated'|'superseded'; rationale:string; evidence_refs?:string[]; }
export interface Decision { id:string; title:string; problem:string; user?:string; context?:string; assumptions:Assumption[]; evidence:EvidenceRef[]; status?:Recommendation; }
