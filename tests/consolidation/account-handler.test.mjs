import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountDeletionHandler} from '../../supabase/functions/account-deletion/handler.mjs';
import {processAccountDeletions} from '../../supabase/functions/storage-cleanup/accounts.mjs';
const id='11111111-1111-4111-8111-111111111111', user='22222222-2222-4222-8222-222222222222';
const origin='https://momentum-fixture.example', receipt='a'.repeat(64);
const body={id,receipt,action:'begin',confirmation:'SUPPRIMER',password:'fictitious password',user_id:'ignored-victim-id'};
const request=(value=body,extra={})=>new Request('https://database.example/functions/v1/account-deletion',{method:'POST',headers:{origin,authorization:'Bearer current-fixture-jwt',...extra},body:JSON.stringify(value)});
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
const options=fetchImpl=>({url:'https://database.example',serviceKey:'server-secret-fixture',publishableKey:'public-fixture',allowedOrigins:[origin],fetchImpl});

test('SEC-19/20: destructive request requires the actual current user and password; client user IDs are ignored',async()=>{
 const calls=[];const handler=createAccountDeletionHandler(options(async(url,init)=>{
  calls.push({path:url.pathname,body:init.body?JSON.parse(init.body):null});
  if(url.pathname.endsWith('/account_deletion_status'))return response(null);
  if(url.pathname.endsWith('/user'))return response({id:user,email:'fictitious@example.invalid'});
  if(url.pathname.endsWith('/token')){assert.equal(JSON.parse(init.body).email,'fictitious@example.invalid');return response({user:{id:user},access_token:'reauthenticated-fixture-token'});}
  if(url.pathname.endsWith('/begin_account_deletion'))return response({id,stage:'queued'});
  if(url.pathname.endsWith('/logout'))return new Response(null,{status:204});throw new Error('Unexpected call');
 }));
 const result=await handler(request());assert.equal(result.status,202);
 const submitted=calls.find(call=>call.path.endsWith('/begin_account_deletion')).body;
 assert.equal(submitted.p_user,user);assert.notEqual(submitted.p_receipt_hash,receipt);assert.equal(submitted.p_receipt_hash.length,64);
 assert.doesNotMatch(await result.text(),/password|fictitious|token|secret/);
});
test('SEC-19: failed reauthentication never starts a deletion',async()=>{
 let begun=false;const handler=createAccountDeletionHandler(options(async url=>{
  if(url.pathname.endsWith('/account_deletion_status'))return response(null);
  if(url.pathname.endsWith('/user'))return response({id:user,email:'fictitious@example.invalid'});
  if(url.pathname.endsWith('/token'))return response({error:'invalid_credentials'},400);
  begun=true;throw new Error();
 }));
 assert.equal((await handler(request())).status,401);assert.equal(begun,false);
 assert.equal((await handler(request(body,{origin:'https://unrelated.example'}))).status,403);assert.equal(begun,false);
});
test('SEC-19: a valid receipt can resume after Auth was removed without a session or disclosure of identity',async()=>{
 const handler=createAccountDeletionHandler(options(async url=>{
  assert.ok(url.pathname.endsWith('/account_deletion_status'));return response({id,stage:'complete',completed_at:'2026-09-11T00:00:00Z'});
 }));
 assert.equal((await handler(request({id,receipt,action:'status'},{authorization:''}))).status,200);
 assert.equal((await handler(request())).status,202,'retrying a known request does not reauthenticate or create another job');
});
test('SEC-19: the worker never deletes Auth while files are pending',async()=>{
 const authCalls=[],receipts=[];const job={id,user_id:user,lease:id,stage:'queued'};
 const result=await processAccountDeletions({request:async(path,body,method)=>authCalls.push({path,method}),rpc:async(name,args)=>{
  if(name==='claim_account_deletions')return [job];
  if(name==='purge_account_records')return true;
  if(name==='account_ready_for_identity')return false;
  receipts.push(args);return true;
 }});
 assert.deepEqual(authCalls.map(call=>call.method),['PUT']);assert.equal(receipts[0].p_success,false);assert.equal(result.failed,0);
});
test('SEC-19: an Auth failure leaves an explicit retry and never claims completion',async()=>{
 const receipts=[];const result=await processAccountDeletions({request:async()=>{throw new Error('Auth unavailable');},rpc:async(name,args)=>{
  if(name==='claim_account_deletions')return [{id,user_id:user,lease:id,stage:'identity'}];
  if(name==='account_ready_for_identity')return true;
  receipts.push(args);return true;
 }});
 assert.equal(result.failed,1);assert.equal(receipts[0].p_success,false);
});
