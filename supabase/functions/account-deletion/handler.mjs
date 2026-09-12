import {supabaseEndpoint} from '../_shared/endpoint.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function bodyJSON(req) {
 const reader=req.body?.getReader();if(!reader)throw new Error('Invalid request');
 let size=0;const parts=[];
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new Error('Invalid request');}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}

export function createAccountDeletionHandler({url,serviceKey,publishableKey,allowedOrigins,allowLocal=false,fetchImpl=fetch}) {
 const endpoint=supabaseEndpoint(url,{allowLocal});const origins=new Set(allowedOrigins);
 if(!serviceKey||!publishableKey||!origins.size)throw new Error('Account deletion configuration missing');
 async function api(path,{method='POST',body,authorization=`Bearer ${serviceKey}`,key=serviceKey}={}) {
  const response=await fetchImpl(new URL(path,endpoint),{method,headers:{'Content-Type':'application/json',apikey:key,Authorization:authorization},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw new Error('Operation unavailable');
  return response.status===204?null:response.json();
 }
 const rpc=(name,body)=>api(`/rest/v1/rpc/${name}`,{body});
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(!origins.has(origin))return respond({error:'origin_unavailable'},403);
  Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond({error:'method_unavailable'},405);
  try {
   const body=await bodyJSON(req);
   if(!body||typeof body!=='object'||!uuid.test(body.id)||typeof body.receipt!=='string'||!/^[a-f0-9]{64}$/.test(body.receipt))return respond({error:'invalid_request'},400);
   const receiptHash=await hash(body.receipt);
   if(body.action==='status') {
    const status=await rpc('account_deletion_status',{p_id:body.id,p_receipt_hash:receiptHash});
    return status?respond(status):respond({error:'receipt_unavailable'},404);
   }
   if(body.action!=='begin'||body.confirmation!=='SUPPRIMER'||typeof body.password!=='string'||body.password.length<1||body.password.length>4096)return respond({error:'invalid_request'},400);
   // A lost response can be resumed with the same capability even after the account was banned.
   const existing=await rpc('account_deletion_status',{p_id:body.id,p_receipt_hash:receiptHash});
   if(existing)return respond(existing,202);
   const authorization=req.headers.get('authorization')||'';
   if(!authorization.startsWith('Bearer '))return respond({error:'reauthentication_required'},401);
   let current,reauthenticated;
   try {
    current=await api('/auth/v1/user',{method:'GET',authorization,key:publishableKey});
    if(!current?.id||!current.email||current.factors?.some(factor=>factor.status==='verified'))return respond({error:'reauthentication_required'},401);
    reauthenticated=await api('/auth/v1/token?grant_type=password',{key:publishableKey,authorization:`Bearer ${publishableKey}`,body:{email:current.email,password:body.password}});
   } catch (_) {return respond({error:'reauthentication_required'},401);}
   body.password='';
   if(reauthenticated?.user?.id!==current.id)return respond({error:'reauthentication_required'},401);
   const result=await rpc('begin_account_deletion',{p_user:current.id,p_id:body.id,p_receipt_hash:receiptHash});
   // Do not expose or persist the short-lived reauthentication session.
   try {await api('/auth/v1/logout?scope=local',{authorization:`Bearer ${reauthenticated.access_token}`,key:publishableKey});} catch (_) {/* Auth removal later revokes all remaining sessions. */}
   return respond(result,202);
  } catch (_) {return respond({error:'deletion_unconfirmed'},503);}
 };
}
