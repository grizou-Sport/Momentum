import {processAccountDeletions} from './accounts.mjs';
import {supabaseEndpoint} from '../_shared/endpoint.mjs';
const allowedBuckets=new Set(['activities','activity-media','moment-media','avatars','club-logos']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});

// This endpoint has no browser CORS permission and accepts only the dedicated cron credential.
export function createCleanupHandler({url,serviceKey,workerSecret,allowLocal=false,fetchImpl=fetch}) {
 const endpoint=supabaseEndpoint(url,{allowLocal});
 if(!serviceKey||!workerSecret||workerSecret.length<32)throw new Error('Cleanup configuration missing');
 const headers={'Content-Type':'application/json',apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
 async function request(path,body,method='POST',allowMissingUser=false) {
  const response=await fetchImpl(new URL(path,endpoint),{method,headers,body:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok){
   if(allowMissingUser&&response.status===404){const error=await response.json();if(error.code==='user_not_found'||error.error_code==='user_not_found')return null;}
   throw new Error('Upstream operation failed');
  }
  if(response.status===204)return null;
  return response.json();
 }
 const rpc=(name,args={})=>request(`/rest/v1/rpc/${name}`,args);
 return async function handle(req) {
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const supplied=req.headers.get('x-cleanup-secret')||'';
  // Equal-length constant-work comparison; neither secret nor request body is logged.
  let difference=supplied.length^workerSecret.length;
  for(let i=0;i<workerSecret.length;i++)difference|=workerSecret.charCodeAt(i)^(supplied.charCodeAt(i)||0);
  if(difference!==0)return json({error:'Unauthorized'},401);
  let completed=0,failed=0;const deadline=performance.now()+35000;
  try {
   await rpc('record_storage_cleanup_run',{p_success:false});
   const accountResult=await processAccountDeletions({rpc,request,deadline});failed+=accountResult.failed;
   await rpc('collect_orphan_uploads');
   const jobs=await rpc('claim_storage_cleanup',{p_limit:20});
   if(!Array.isArray(jobs)||jobs.length>20)throw new Error('Invalid batch');
   // Sequential requests keep memory and platform work bounded. A crashed run leaves leases to expire.
   for(const item of jobs) {
    if(performance.now()>=deadline)break;
    if(!uuid.test(item.id)||!uuid.test(item.lease)||!allowedBuckets.has(item.bucket)||typeof item.path!=='string'||!item.path||item.path.length>1024||/(^\/|\/\/|(^|\/)\.\.(\/|$)|[\\%?#])/.test(item.path))throw new Error('Invalid cleanup receipt');
    let removed=false;
    try {await request(`/storage/v1/object/${item.bucket}`,{prefixes:[item.path]},'DELETE');removed=true;} catch (_) {/* Retry state contains a category, never raw provider payloads. */}
    const acknowledged=await rpc('finish_storage_cleanup',{p_id:item.id,p_lease:item.lease,p_success:removed});
    if(removed&&acknowledged)completed++;else failed++;
   }
   await rpc('record_storage_cleanup_run',{p_success:failed===0});
   return json({completed,failed},failed?503:200);
  } catch (_) {return json({error:'Cleanup pending',completed,failed},503);}
 };
}
