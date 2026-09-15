export async function postJSON<T>(url:string,body:unknown,getToken?:()=>Promise<string|undefined>):Promise<T>{
  const headers:Record<string,string>={'Content-Type':'application/json'};
  const token=await getToken?.(); if(token) headers.Authorization=`Bearer ${token}`;
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({error:'Invalid JSON response'}));
  if(!response.ok) throw new Error(payload.error||`Request failed (${response.status})`);
  return payload as T;
}
