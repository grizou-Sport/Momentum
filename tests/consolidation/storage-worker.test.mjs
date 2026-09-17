import test from 'node:test';
import assert from 'node:assert/strict';
import {createCleanupHandler} from '../../supabase/functions/storage-cleanup/worker.mjs';
const secret='fictitious-worker-secret-for-tests-only';
const item={id:'11111111-1111-4111-8111-111111111111',lease:'22222222-2222-4222-8222-222222222222',bucket:'activity-media',path:'11111111-1111-4111-8111-111111111111/private.jpg'};
const response=value=>new Response(JSON.stringify(value));
const request=()=>new Request('https://fixture.example/functions/v1/storage-cleanup',{method:'POST',headers:{'x-cleanup-secret':secret}});

test('SEC-19/20: cleanup worker rejects missing credentials before network calls',async()=>{
 let calls=0;const handler=createCleanupHandler({url:'https://fixture.example',serviceKey:'server-only-fixture',workerSecret:secret,fetchImpl:async()=>{calls++;throw new Error();}});
 assert.equal((await handler(new Request('https://fixture.example',{method:'POST'}))).status,401);assert.equal(calls,0);
 assert.throws(()=>createCleanupHandler({url:'https://fixture.example',serviceKey:'server-only',workerSecret:''}));
});
test('SEC-19: storage failure is persisted for retry and never acknowledged as deleted',async()=>{
 const receipts=[];const handler=createCleanupHandler({url:'https://fixture.example',serviceKey:'server-only-fixture',workerSecret:secret,fetchImpl:async(url,options)=>{
  if(url.pathname.endsWith('/claim_account_deletions'))return response([]);
  if(url.pathname.endsWith('/record_storage_cleanup_run'))return response(null);
  if(url.pathname.endsWith('/collect_orphan_uploads'))return response(0);
  if(url.pathname.endsWith('/claim_storage_cleanup'))return response([item]);
  if(url.pathname.startsWith('/storage/')){assert.equal(options.method,'DELETE');assert.deepEqual(JSON.parse(options.body),{prefixes:[item.path]});return new Response('private provider error',{status:500});}
  receipts.push(JSON.parse(options.body));return response(true);
 }});
 const out=await handler(request());assert.equal(out.status,503);assert.deepEqual(receipts,[{p_id:item.id,p_lease:item.lease,p_success:false}]);assert.doesNotMatch(await out.text(),/private|jpg|server-only|fictitious/);
});
test('SEC-19: a lost acknowledgement remains pending; a replay can complete after an already absent object',async()=>{
 let acknowledged=false,removeCalls=0;
 const handler=createCleanupHandler({url:'https://fixture.example',serviceKey:'server-only-fixture',workerSecret:secret,fetchImpl:async url=>{
  if(url.pathname.endsWith('/claim_account_deletions'))return response([]);
  if(url.pathname.endsWith('/record_storage_cleanup_run'))return response(null);
  if(url.pathname.endsWith('/collect_orphan_uploads'))return response(0);
  if(url.pathname.endsWith('/claim_storage_cleanup'))return response([item]);
  if(url.pathname.startsWith('/storage/')){removeCalls++;return response([]);}
  if(!acknowledged){acknowledged=true;throw new TypeError('Lost response');}return response(true);
 }});
 assert.equal((await handler(request())).status,503);
 const second=await handler(request());assert.equal(second.status,200);assert.equal((await second.json()).completed,1);assert.equal(removeCalls,2);
});
