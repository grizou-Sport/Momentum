import { supabaseEndpoint } from '../_shared/endpoint.mjs';
import { FileValidationError } from './content.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function boundedBody(request,limit) {
  if(Number(request.headers.get('content-length'))>limit)throw new FileValidationError('file_size',413);
  const reader=request.body?.getReader();if(!reader)throw new FileValidationError('file_size',413);
  const parts=[];let size=0;const deadline=Date.now()+30000;
  try{
    for(;;){
      const remaining=deadline-Date.now();if(remaining<=0)throw new FileValidationError('upload_timeout',408);
      let timer;const chunk=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new FileValidationError('upload_timeout',408)),remaining);})]).finally(()=>clearTimeout(timer));
      if(chunk.done)break;size+=chunk.value.length;if(size>limit)throw new FileValidationError('file_size',413);parts.push(chunk.value);
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
export function createFileIngestHandler({url,serviceKey,publishableKey,allowedOrigins,validateContent,allowLocal=false,fetchImpl=fetch}) {
  const endpoint=supabaseEndpoint(url,{allowLocal}),origins=new Set(allowedOrigins);
  if(!serviceKey||!publishableKey||!origins.size||!validateContent)throw new Error('File ingestion configuration missing');
  async function api(path,{method='POST',body,authorization=`Bearer ${serviceKey}`,key=serviceKey,headers={},raw=false}={}){
    const response=await fetchImpl(new URL(path,endpoint),{method,headers:{'Content-Type':'application/json',apikey:key,Authorization:authorization,...headers},body:body===undefined?undefined:raw?body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok){let error;try{error=await response.json();}catch{}const exception=new Error(error?.message||'upload_unconfirmed');exception.code=error?.code;exception.status=response.status;throw exception;}
    return response.status===204?null:response.json();
  }
  const rpc=(name,body)=>api('/rest/v1/rpc/'+name,{body});
  return async request=>{
    const origin=request.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(!origins.has(origin))return reply({error:'origin_unavailable'},403);
    Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-file-bucket,x-file-resource,x-file-operation,x-file-extension'});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'method_unavailable'},405);
    let receipt,actor,operation;
    try{
      const authorization=request.headers.get('authorization')||'';
      if(!authorization.startsWith('Bearer '))return reply({error:'authentication_required'},401);
      let user,session;
      try{
        user=await api('/auth/v1/user',{method:'GET',authorization,key:publishableKey});
        const token=authorization.slice(7).split('.')[1];session=JSON.parse(atob(token.replaceAll('-','+').replaceAll('_','/'))).session_id;
        if(!uuid.test(user?.id)||!uuid.test(session))throw new Error();
      }catch{return reply({error:'authentication_required'},401);}
      actor=user.id;
      const bucket=request.headers.get('x-file-bucket'),resource=request.headers.get('x-file-resource')||null,extension=request.headers.get('x-file-extension');
      operation=request.headers.get('x-file-operation');
      if(!['activities','activity-media','moment-media','avatars','club-logos'].includes(bucket)||!uuid.test(operation)||resource!==null&&!uuid.test(resource)||!['jpg','jpeg','png','webp','svg','fit','gpx'].includes(extension))return reply({error:'invalid_request'},400);
      const bytes=await boundedBody(request,(bucket==='activities'?20:bucket==='avatars'||bucket==='club-logos'?5:10)*1024*1024);
      const file=await validateContent({bytes,name:'upload.'+extension,bucket});
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      receipt=await rpc('begin_file_upload',{p_user:actor,p_session:session,p_operation:operation,p_bucket:bucket,p_resource:resource,p_fingerprint:fingerprint,p_extension:file.extension,p_original_extension:file.originalExtension||null,p_mime:file.mime});
      if(receipt.state==='ready')return reply({path:receipt.path,mime:receipt.mime,operation},200);
      const upload=(bucket,path,content,mime)=>api('/storage/v1/object/'+bucket+'/'+path,{body:content,raw:true,headers:{'Content-Type':mime,'x-upsert':'false','Cache-Control':'max-age=3600'}});
      if(file.original)await upload('activity-media',receipt.original_path,file.original,'image/'+file.originalExtension.replace('svg','svg+xml'));
      await upload(bucket,receipt.path,file.bytes,file.mime);
      const result=await rpc('finish_file_upload',{p_user:actor,p_operation:operation,p_lease:receipt.lease,p_success:true});
      if(!result.ready)return reply({error:'upload_forbidden'},403);
      return reply({path:result.path,mime:result.mime,operation},201);
    }catch(error){
      if(receipt?.state==='uploading')try{await rpc('finish_file_upload',{p_user:actor,p_operation:operation,p_lease:receipt.lease,p_success:false});}catch{}
      if(error instanceof FileValidationError)return reply({error:error.message},error.status);
      if(error.code==='42501')return reply({error:'upload_forbidden'},403);
      if(error.code==='40001')return reply({error:error.message==='upload_in_progress'?'upload_in_progress':'upload_conflict'},409);
      if(error.code==='23514')return reply({error:'upload_retired'},409);
      return reply({error:'upload_unconfirmed'},503);
    }
  };
}
