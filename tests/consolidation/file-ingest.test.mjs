import test from 'node:test';
import assert from 'node:assert/strict';
import {createFileIngestHandler} from '../../supabase/functions/file-ingest/handler.mjs';
import {FileValidationError} from '../../supabase/functions/file-ingest/content.mjs';

const user='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
const operation='33333333-3333-4333-8333-333333333333';
const origin='https://app.example.test',url='https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
const token='header.'+Buffer.from(JSON.stringify({session_id:session})).toString('base64url')+'.signature';
const original=new Uint8Array([1,2,3]),processed=new Uint8Array([4,5]);
function fixture({validationError,storageError,ready=false,beginError}={}) {
 const calls=[];
 const handler=createFileIngestHandler({url,allowedOrigins:[origin],publishableKey:'public-key',serviceKey:'private-key',
  async validateContent(){if(validationError)throw validationError;return {bytes:processed,mime:'image/webp',extension:'webp',original,originalExtension:'jpeg'};},
  async fetchImpl(target,options){
   const path=new URL(target).pathname;calls.push({path,...options});
   if(path==='/auth/v1/user')return Response.json({id:user});
   if(path==='/rest/v1/rpc/begin_file_upload')return beginError?Response.json(beginError,{status:403}):Response.json({state:ready?'ready':'uploading',path:'resource/photo.webp',original_path:user+'/shared-originals/photo.jpeg',lease:operation,mime:'image/webp'});
   if(path.startsWith('/storage/v1/object/'))return storageError?Response.json({message:'provider detail'},{status:500}):Response.json({Key:'stored'});
   if(path==='/rest/v1/rpc/finish_file_upload')return Response.json({ready:true,path:'resource/photo.webp',mime:'image/webp'});
   throw new Error('Unexpected provider request');
  }});
 const request=(headers={},body=original)=>new Request(url+'/functions/v1/file-ingest',{method:'POST',headers:{origin,Authorization:'Bearer '+token,'x-file-bucket':'moment-media','x-file-resource':user,'x-file-operation':operation,'x-file-extension':'jpg',...headers},body});
 return {handler,calls,request};
}
test('file service rejects foreign origins, missing sessions and malformed commands before privileged writes',async()=>{
 const {handler,calls,request}=fixture();
 assert.equal((await handler(request({origin:'https://foreign.example'}))).status,403);assert.equal(calls.length,0);
 assert.equal((await handler(request({Authorization:''}))).status,401);assert.equal(calls.length,0);
 assert.equal((await handler(request({'x-file-operation':'invalid'}))).status,400);
 assert.deepEqual(calls.map(c=>c.path),['/auth/v1/user']);
});
test('validated shared upload stores the exact private original before its sanitized copy and commits last',async()=>{
 const {handler,calls,request}=fixture();
 assert.equal((await handler(request())).status,201);
 const begin=calls.find(c=>c.path.endsWith('/begin_file_upload'));
 assert.equal(JSON.parse(begin.body).p_user,user);assert.equal(JSON.parse(begin.body).p_session,session);
 const writes=calls.filter(c=>c.path.startsWith('/storage/'));
 assert.equal(writes.length,2);assert.deepEqual(writes[0].body,original);assert.deepEqual(writes[1].body,processed);
 assert.match(writes[0].path,/activity-media\/.*\/shared-originals\//);
 assert.ok(writes.every(c=>c.headers['x-upsert']==='false'&&c.headers.apikey==='private-key'));
 assert.ok(calls.at(-1).path.endsWith('/finish_file_upload'));assert.equal(JSON.parse(calls.at(-1).body).p_success,true);
});
test('unconfirmed provider writes retire the receipt without exposing provider details; a ready retry writes nothing',async()=>{
 const failed=fixture({storageError:true});const result=await failed.handler(failed.request());
 assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:'upload_unconfirmed'});
 assert.equal(JSON.parse(failed.calls.at(-1).body).p_success,false);
 const retried=fixture({ready:true});assert.equal((await retried.handler(retried.request())).status,200);
 assert.equal(retried.calls.filter(c=>c.path.startsWith('/storage/')).length,0);
});
test('invalid content, oversized bodies and revoked authorization never reach Storage',async()=>{
 const invalid=fixture({validationError:new FileValidationError('invalid_image')});
 assert.equal((await invalid.handler(invalid.request())).status,422);
 assert.equal(invalid.calls.length,1);
 const oversized=fixture();assert.equal((await oversized.handler(oversized.request({'content-length':String(11*1024*1024)}))).status,413);
 const revoked=fixture({beginError:{code:'42501',message:'upload_forbidden'}});
 assert.equal((await revoked.handler(revoked.request())).status,403);
 assert.equal(revoked.calls.filter(c=>c.path.startsWith('/storage/')).length,0);
});
