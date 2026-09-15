export function decisionStatusLabel(status:string){return status.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
