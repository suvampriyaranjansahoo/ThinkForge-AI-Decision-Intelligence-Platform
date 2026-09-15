export function announce(message){
  const node=document.getElementById('ariaLive');
  if(!node)return;
  node.textContent='';
  requestAnimationFrame(()=>{node.textContent=String(message||'')});
}

export function createFocusTrap(root,{onClose}={}){
  if(!root)return ()=>{};
  const selector='button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const previous=document.activeElement;
  const handler=(e)=>{
    if(e.key==='Escape'){e.preventDefault();onClose?.();return;}
    if(e.key!=='Tab')return;
    const focusables=[...root.querySelectorAll(selector)];
    if(!focusables.length)return;
    const first=focusables[0],last=focusables[focusables.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };
  root.addEventListener('keydown',handler);
  return ()=>{root.removeEventListener('keydown',handler);if(previous&&typeof previous.focus==='function')previous.focus()};
}

export function startMeasure(name){
  return {name,started:performance.now()};
}

export function finishMeasure(track,event,ctx={}){
  if(!track)return;
  const duration=Math.round(performance.now()-track.started);
  event?.(eventNameFor(nameOr(track)),{...ctx,duration_ms:duration});
}
function nameOr(t){return t?.name||'interaction'}
function eventNameFor(n){return `ux_${n}`}

export function installGlobalShortcuts({openCommands,closeCommands,openShortcuts,newDecision}={}){
  window.addEventListener('keydown',e=>{
    const tag=(e.target?.tagName||'').toLowerCase();
    const typing=tag==='input'||tag==='textarea'||tag==='select'||e.target?.isContentEditable;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();openCommands?.();return;
    }
    if(e.key==='Escape'){closeCommands?.();return;}
    if(typing)return;
    if(e.key==='?'){e.preventDefault();openShortcuts?.();return;}
    if(e.key.toLowerCase()==='n'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();newDecision?.();return;}
  });
}

// Marks a trigger element as busy for the duration of an async action, without
// depending on a full re-render to clear the state. Safe to use even when the
// element is later removed by a re-render (checks isConnected before resetting).
export function withBusy(el,fn){
  if(!el)return Promise.resolve().then(fn);
  el.disabled=true;el.classList.add('loading');el.setAttribute('aria-busy','true');
  const reset=()=>{if(el.isConnected){el.disabled=false;el.classList.remove('loading');el.removeAttribute('aria-busy')}};
  return Promise.resolve().then(fn).then(v=>{reset();return v},err=>{reset();throw err});
}
