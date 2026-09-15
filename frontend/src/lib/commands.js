export const COMMANDS=[
  {id:'new',label:'Create a new decision',hint:'Start with a question and outcome'},
  {id:'decisions',label:'Open decisions',hint:'Review active decisions'},
  {id:'research',label:'Open research',hint:'Discovery, themes and evidence gaps'},
  {id:'evidence',label:'Open evidence library',hint:'Inspect traceable evidence'},
  {id:'experiments',label:'Open experiments',hint:'Predictions, outcomes and tests'},
  {id:'learn',label:'Open learning',hint:'Prediction gaps and reasoning blind spots'},
  {id:'evaluation',label:'Open AI evaluation',hint:'Benchmark and human-study controls'},
  {id:'analytics',label:'Open analytics',hint:'Workflow and AI interaction telemetry'},
  {id:'rag',label:'Open evidence RAG',hint:'Retrieve and attach grounded evidence'},
  {id:'execution',label:'Open PRD / Jira',hint:'Carry the decision into execution'},
  {id:'shortcuts',label:'Keyboard shortcuts',hint:'See every available shortcut'}
];

export function createCommandPalette({root, input, list, run, close, esc}){
  let index=0;
  const getRows=()=>{
    const q=(input?.value||'').trim().toLowerCase();
    return COMMANDS.filter(c=>!q||c.label.toLowerCase().includes(q)||c.hint.toLowerCase().includes(q));
  };
  const render=()=>{
    if(!list)return;
    const rows=getRows();
    index=Math.max(0,Math.min(index,Math.max(0,rows.length-1)));
    list.innerHTML=rows.map((c,i)=>`<button class="command-item ${i===index?'active':''}" data-command="${esc(c.id)}"><div><strong>${esc(c.label)}</strong><span>${esc(c.hint)}</span></div><span>Enter</span></button>`).join('')||'<div class="empty" style="border:0">No matching action.</div>';
    list.querySelectorAll('[data-command]').forEach(b=>b.addEventListener('click',()=>{const c=COMMANDS.find(x=>x.id===b.dataset.command);close();c&&run(c)}));
  };
  const open=()=>{if(!root)return;root.classList.add('open');input.value='';index=0;render();setTimeout(()=>input.focus(),0)};
  const bind=()=>{
    input?.addEventListener('input',()=>{index=0;render()});
    input?.addEventListener('keydown',e=>{
      const rows=getRows();
      if(e.key==='ArrowDown'){e.preventDefault();index=Math.min(index+1,Math.max(0,rows.length-1));render()}
      else if(e.key==='ArrowUp'){e.preventDefault();index=Math.max(0,index-1);render()}
      else if(e.key==='Enter'){e.preventDefault();const c=rows[index];close();c&&run(c)}
      else if(e.key==='Escape'){e.preventDefault();close()}
    });
    return {open,render,bind};
  };
  return bind();
}
