// Integration tests against real local GoTrue, PostgREST, Storage and Edge Runtime.
// See supabase-local-setup.mjs for the explicitly representative application baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';
import {verifyLocalGuests} from './supabase-local-guests.mjs';

const config=JSON.parse(await readFile(process.env.MOMENTUM_LOCAL_STATUS,'utf8'));
assert.equal(config.API_URL,'http://127.0.0.1:54321');
assert.equal(new URL(config.DB_URL).hostname,'127.0.0.1');
assert.equal(new URL(config.DB_URL).port,'54322');
const localConfig=await readFile(process.env.MOMENTUM_LOCAL_CONFIG,'utf8');
assert.match(localConfig,/project_id = "momentum-cdc-validation"/);
const workerSecret=localConfig.match(/MOMENTUM_CLEANUP_SECRET = "([a-f0-9]{64})"/)[1];
const origin='http://127.0.0.1:3000';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,4,0,0,0,181,28,12,2,0,0,0,11,73,68,65,84,120,218,99,100,248,15,0,1,5,1,1,39,24,227,102,0,0,0,0,73,69,78,68,174,66,96,130]);
const gpx=new TextEncoder().encode('<?xml version="1.0"?><gpx version="1.1" creator="MOMENTUM local test"><trk><trkseg><trkpt lat="46.5" lon="6.6"><time>2026-09-12T06:00:00Z</time></trkpt></trkseg></trk></gpx>');
async function request(path,{user,method='GET',body,headers={},raw=false}={}){
 const response=await fetch(config.API_URL+path,{method,headers:{apikey:config.ANON_KEY,Authorization:'Bearer '+(user?.access_token||config.ANON_KEY),origin,'x-momentum-client':'cdc-2026-09-08',...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:(raw?body:JSON.stringify(body)),redirect:'manual',signal:AbortSignal.timeout(90000)});
 if(raw&&method==='GET')return {status:response.status,bytes:new Uint8Array(await response.arrayBuffer())};
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:response.status,data,headers:response.headers};
}
function expect(result,status,label){
 assert.equal(result.status,status,label+'; '+(result.data?.code||result.data?.error||result.data?.message||''));return result.data;
}
const rpc=(user,name,body={})=>request('/rest/v1/rpc/'+name,{user,method:'POST',body});
const cleanup=()=>request('/functions/v1/storage-cleanup',{method:'POST',body:{},headers:{'x-cleanup-secret':workerSecret}});
async function eventually(check,{timeout=140000,label}={}){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){if(await check())return;await delay(2000);}
 assert.fail(label+' did not complete before the deadline');
}
async function signup(label){
 const email='momentum-'+label+'-'+randomUUID()+'@example.invalid',password='Local!'+randomBytes(24).toString('hex');
 const signed=expect(await request('/auth/v1/signup',{method:'POST',body:{email,password}}),200,'Signup');
 assert.ok(signed.id&&!signed.access_token,'Confirmation must be required');
 let message;
 await eventually(async()=>{
  const data=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  message=data.messages?.find(m=>m.To?.some(to=>to.Address===email));return Boolean(message);
 },{timeout:10000,label:'Captured confirmation email'});
 const mail=await (await fetch('http://127.0.0.1:54324/api/v1/message/'+message.ID)).json();
 const link=mail.HTML.match(/href="([^"]*\/auth\/v1\/verify\?[^"]+)"/)[1].replaceAll('&amp;','&');
 assert.equal(new URL(link).origin,config.API_URL,'Confirmation stays on the local provider');
 const verification=await fetch(link,{redirect:'manual'});assert.equal(verification.status,303);
 assert.ok(!verification.headers.get('location')?.includes('error='),'Confirmation succeeds');
 const session=expect(await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}}),200,'Sign in');
 assert.ok(session.access_token&&session.refresh_token);assert.equal(session.user.id,signed.id);
 return {...session,email,password};
}
const save=(user,data)=>rpc(user,'save_personal_moment',{p_operation_id:randomUUID(),p_activity:{id:randomUUID(),user_id:user.user.id,activity_date:'2026-09-12',activity_category:'sport',sport:'walking',activity_type:'walking',status:'done',duration_min:80,rpe:null,...data}});
async function upload(user,bucket,path,bytes,type){
 return request('/storage/v1/object/'+bucket+'/'+path,{user,method:'POST',body:bytes,raw:true,headers:{'Content-Type':type}});
}
async function ingest(user,bucket,resource,bytes,extension,operation=randomUUID()) {
 return request('/functions/v1/file-ingest',{user,method:'POST',body:bytes,raw:true,headers:{'Content-Type':'application/octet-stream','x-file-bucket':bucket,'x-file-operation':operation,'x-file-extension':extension,...(resource?{'x-file-resource':resource}:{})}});
}
async function download(user,bucket,path){return request('/storage/v1/object/authenticated/'+bucket+'/'+path,{user,raw:true});}

test('Full local Supabase: real identity, files, API, scheduler and deletion',async t=>{
 const db=new pg.Client({connectionString:config.DB_URL});await db.connect();t.after(()=>db.end());
 assert.ok((await db.query("select to_regclass('momentum_validation.applied') as marker")).rows[0].marker);
 async function step(label,run){
  let failed;await t.test(label,async()=>{try{await run();}catch(error){failed=error;throw error;}});
  if(failed)throw new Error('Stopped at failed integration boundary: '+label,{cause:failed});
 }
 let A,B,C,activity,exportJob,shared;
 let sourcePath,photoPath;
 await step('Health and handler boundaries run in the real Edge Runtime',async()=>{
  expect(await request('/auth/v1/health'),200,'Auth health');
  expect(await request('/functions/v1/file-ingest',{method:'POST',body:{}}),401,'Upload requires a session');
  expect(await request('/functions/v1/storage-cleanup',{method:'POST',body:{}}),401,'Worker credential required');
  expect(await request('/functions/v1/account-deletion'),405,'Only POST supported');
  expect(await request('/functions/v1/account-deletion',{headers:{origin:'https://unrelated.example'}}),403,'Foreign origin rejected');
 });
 await step('Three real accounts confirm locally captured emails and obtain real sessions',async()=>{
  A=await signup('a');B=await signup('b');C=await signup('c');
  assert.equal((await db.query('select count(*)::int count from auth.identities where user_id=any($1::uuid[])',[[A.user.id,B.user.id,C.user.id]])).rows[0].count,3);
  if(process.env.MOMENTUM_LOCAL_ACCOUNTS)await writeFile(process.env.MOMENTUM_LOCAL_ACCOUNTS,JSON.stringify({A,B,C}),{mode:0o600});
 });
 if(!A||!B||!C)throw new Error('Real confirmed accounts are required for the remaining integration tests');
 await step('Minimal onboarding persists without physiological estimates',async()=>{
  let row=expect(await request('/rest/v1/onboarding_progress?user_id=eq.'+A.user.id,{user:A}),200,'Read progress')[0];
  for(const [step,values] of [[1,{display_name:'Camille Docker'}],[2,{skipped:true}],[3,{intention:'Retrouver les sentiers sans objectif de temps.'}]]){
   row=expect(await rpc(A,'save_minimal_onboarding',{p_step:step,p_values:values,p_operation_id:randomUUID(),p_expected_updated_at:row.updated_at}),200,'Setup step '+step);
  }
  assert.equal(row.complete,true);
  const load=(await db.query('select chronic_load from public.user_load_estimates where user_id=$1',[A.user.id])).rows[0];assert.equal(load.chronic_load,null);
 });
 await step('Personal save is idempotent and two real JWTs enforce private rows',async()=>{
  const args={p_operation_id:randomUUID(),p_activity:{id:randomUUID(),user_id:A.user.id,activity_date:'2026-09-12',activity_category:'sport',sport:'walking',activity_type:'walking',status:'done',duration_min:80,rpe:null,notes:'Fictitious private A'}};
  activity=expect(await rpc(A,'save_personal_moment',args),200,'Save A');
  assert.deepEqual(expect(await rpc(A,'save_personal_moment',args),200,'Retry same operation'),activity);
  assert.equal(expect(await request('/rest/v1/activities?id=eq.'+activity.id,{user:B}),200,'B private rows').length,0);
  expect(await rpc(B,'save_personal_moment',{...args,p_operation_id:randomUUID()}),403,'B cannot write A');
  const data=(await db.query('select duration_min,rpe from public.activities where id=$1',[activity.id])).rows[0];assert.equal(Number(data.duration_min),80);assert.equal(data.rpe,null);
 });
 await step('Legacy clients can read but cannot partially write; reloaded clients keep private data intact',async()=>{
  const before=(await db.query('select rpe,notes,revision from public.activities where id=$1',[activity.id])).rows[0];
  for(const version of ['', 'obsolete']){
   const legacy={'x-momentum-client':version};
   expect(await request('/rest/v1/activities?id=eq.'+activity.id,{user:A,headers:legacy}),200,'Legacy read');
   for(const method of ['PATCH','DELETE']){
    const failure=expect(await request('/rest/v1/activities?id=eq.'+activity.id,{user:A,method,headers:legacy,...(method==='PATCH'?{body:{rpe:9,notes:'Must not persist'}}:{})}),400,'Legacy '+method);
    assert.equal(failure.code,'MM001');
   }
   const failure=expect(await request('/rest/v1/activities',{user:A,method:'POST',headers:legacy,body:{user_id:A.user.id,activity_date:'2026-09-12'}}),400,'Legacy insert');assert.equal(failure.code,'MM001');
  }
  assert.deepEqual((await db.query('select rpe,notes,revision from public.activities where id=$1',[activity.id])).rows[0],before);
  expect(await request('/rest/v1/activities?id=eq.'+activity.id,{user:A,method:'PATCH',body:{notes:'Fictitious private A after reload'}}),204,'Current client save');
  assert.equal((await db.query('select rpe from public.activities where id=$1',[activity.id])).rows[0].rpe,null);
  assert.equal(expect(await request('/rest/v1/activities?id=eq.'+activity.id,{user:B}),200,'Other account still cannot read').length,0);
 });
 await step('Server validation preserves original bytes, survives retries and rejects direct or foreign writes',async()=>{
  const operation=randomUUID();
  sourcePath=expect(await ingest(A,'activities',null,gpx,'gpx',operation),201,'Validated source').path;
  assert.equal(expect(await ingest(A,'activities',null,gpx,'gpx',operation),200,'Retry validated source').path,sourcePath);
  expect(await ingest(A,'activities',null,new TextEncoder().encode(new TextDecoder().decode(gpx).replace('46.5','46.6')),'gpx',operation),409,'Different bytes cannot reuse a receipt');
  photoPath=expect(await ingest(A,'activity-media',activity.id,png,'png'),201,'Validated private photo').path;
  for(const [bucket,type,bytes] of [['activities','application/gpx+xml',gpx],['activity-media','image/png',png],['avatars','image/png',png],['moment-media','image/png',png],['club-logos','image/png',png]]) {
   assert.ok((await upload(A,bucket,A.user.id+'/'+randomUUID()+'.png',bytes,type)).status>=400,'Direct upload denied: '+bucket);
  }
  expect(await ingest(B,'activity-media',activity.id,png,'png'),403,'Foreign activity upload denied');
  const count=(await db.query('select count(*)::int count from private.file_uploads')).rows[0].count;
  expect(await ingest(A,'activity-media',activity.id,new TextEncoder().encode('<script>fake image</script>'),'png'),422,'Forged image denied');
  expect(await ingest(A,'activities',null,new TextEncoder().encode('<gpx><trkpt lat="200" lon="6"/></gpx>'),'gpx'),422,'Invalid GPX denied');
  expect(await ingest(A,'activities',null,new Uint8Array([12,16,0,0]),'fit'),422,'Truncated FIT denied');
  assert.equal((await db.query('select count(*)::int count from private.file_uploads')).rows[0].count,count,'Invalid bytes create no final upload');
  assert.ok((await request('/storage/v1/object/sign/activity-media/'+photoPath,{user:B,method:'POST',body:{expiresIn:60}})).status>=400,'Foreign signed link denied');
  for(const [bucket,path,original] of [['activities',sourcePath,gpx],['activity-media',photoPath,png]]){
   const downloaded=await download(A,bucket,path);assert.equal(downloaded.status,200);assert.equal(sha(downloaded.bytes),sha(original));
  }
  expect(await request('/rest/v1/activities?id=eq.'+activity.id,{user:A,method:'PATCH',body:{source_file_url:sourcePath,source_file_type:'gpx'}}),204,'Attach source');
  expect(await request('/rest/v1/activity_media',{user:A,method:'POST',body:{activity_id:activity.id,user_id:A.user.id,file_path:photoPath}}),201,'Attach image');
 });
 await step('Paged export is account-owned, includes source paths and rejects another JWT',async()=>{
  exportJob=expect(await rpc(A,'begin_personal_export'),200,'Start export');
  const foreign=await rpc(B,'read_personal_export',{p_export_id:exportJob.export_id});assert.ok(foreign.status>=400,'B export access denied');
  let after=0,items=[];
  for(let i=0;i<100;i++){
   const page=expect(await rpc(A,'read_personal_export',{p_export_id:exportJob.export_id,p_after:after,p_limit:2}),200,'Export page');
   items.push(...page.items);after=page.next_cursor;if(page.done)break;
  }
  assert.equal(items.length,Number(exportJob.total));assert.ok(items.length>2);
  const exported=items.find(item=>item.kind==='activities'&&item.payload.id===activity.id);assert.equal(exported.payload.duration_min,80);assert.equal(exported.payload.rpe,null);
  assert.equal(exported.payload.source_file_url,sourcePath);
 });
 await step('Real anonymous invitations enforce origins, preview privacy, confirmation, renewal and revocation',async()=>{
  await verifyLocalGuests({request,A,B});
 });
 await step('Vault + pg_cron + pg_net call the actual worker and physically delete retired files',async()=>{
  // Keep the deployment URL validation unchanged. Inside this disposable database only,
  // the scheduler's Vault URL uses the Docker transport instead of managed HTTPS.
  await db.query('begin');
  try{
   await db.query('select private.configure_storage_cleanup($1,$2)',['https://aaaaaaaaaaaaaaaaaaaa.supabase.co',workerSecret]);
   await db.query("select vault.update_secret((select id from vault.secrets where name='momentum_cleanup_url'),$1)",['http://kong:8000']);
   await db.query('commit');
  }catch(error){await db.query('rollback');throw error;}
  expect(await cleanup(),200,'Real worker initial health');
  const revision=(await db.query('select revision from public.activities where id=$1',[activity.id])).rows[0].revision;
  expect(await rpc(A,'delete_personal_activity',{p_id:activity.id,p_expected_revision:Number(revision)}),200,'Delete activity');
  const start=Date.now();
  await eventually(async()=>{
   const row=(await db.query("select count(*)::int count from storage.objects where bucket_id='activities' and name=$1",[sourcePath])).rows[0];return row.count===0;
  },{timeout:85000,label:'Actual scheduled file removal'});
  assert.equal((await db.query("select count(*)::int count from storage.objects where name=$1",[photoPath])).rows[0].count,0);
  assert.ok((await download(A,'activities',sourcePath)).status>=400);
  assert.ok((await db.query("select 1 from cron.job_run_details where status='succeeded' and start_time>=$1",[new Date(start)])).rowCount);
 });
 await step('Account deletion requires a password, blocks old JWT writes, removes Auth/files and preserves another participant',async()=>{
  await db.query("insert into public.connections(user_low_id,user_high_id,status) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'active')",[C.user.id,B.user.id]);
  shared=expect(await rpc(C,'save_shared_moment',{p_operation_id:randomUUID(),p_data:{id:randomUUID(),title:'Sortie fictive Docker',status:'CONFIRMED',date_mode:'fixed',start_at:'2026-09-20T09:00:00Z',end_at:null,moment_type:'OTHER',description:null,location_id:null,location_name:null,capacity:3,visibility:'PRIVATE',club_id:null,participants:[B.user.id],options:[{id:randomUUID(),start_at:'2026-09-20T09:00:00Z',end_at:null}]}}),200,'Create shared moment');
  const sharedId=shared.id;
  const peerPhoto=expect(await ingest(B,'moment-media',sharedId,png,'png'),201,'Validated participant photo').path;
  assert.ok(peerPhoto.endsWith('.webp'));
  const peerOriginal=(await db.query('select path from private.validated_files where parent_bucket=$1 and parent_path=$2',['moment-media',peerPhoto])).rows[0].path;
  assert.equal(sha((await download(B,'activity-media',peerOriginal)).bytes),sha(png),'Private original is exact');
  assert.ok((await download(C,'activity-media',peerOriginal)).status>=400,'Organizer cannot read another participant’s original');
  expect(await request('/rest/v1/moment_media',{user:B,method:'POST',body:{moment_id:sharedId,user_id:B.user.id,file_path:peerPhoto}}),201,'Participant photo reference');
  const ownPath=expect(await ingest(C,'activities',null,gpx,'gpx'),201,'Validated deletion source').path;
  expect(await save(C,{source_file_url:ownPath,source_file_type:'gpx'}),200,'Deletion activity');
  const peerExport=expect(await rpc(B,'begin_personal_export'),200,'Export shared author originals');
  const peerItems=expect(await rpc(B,'read_personal_export',{p_export_id:peerExport.export_id,p_limit:200}),200,'Read shared author export').items;
  assert.ok(peerItems.some(item=>item.kind==='media_originals'&&item.payload.file_path===peerOriginal));
  const ownPhoto=expect(await ingest(C,'moment-media',sharedId,png,'png'),201,'Organizer own photo').path;
  expect(await request('/rest/v1/moment_media',{user:C,method:'POST',body:{moment_id:sharedId,user_id:C.user.id,file_path:ownPhoto}}),201,'Organizer photo reference');
  const avatar=expect(await ingest(C,'avatars',C.user.id,png,'png'),201,'Validated avatar').path;
  const avatarUrl=config.API_URL+'/storage/v1/object/public/avatars/'+avatar;
  expect(await request('/rest/v1/passports?on_conflict=user_id',{user:C,method:'POST',body:{user_id:C.user.id,avatar_url:avatarUrl},headers:{Prefer:'resolution=merge-duplicates'}}),200,'Avatar reference');
  assert.equal((await db.query("select private.storage_referenced('avatars',$1) used",[avatar])).rows[0].used,true,'Registered local public URL is retained');
  assert.equal((await db.query("select private.storage_path('avatars',$1) path",['http://unknown.example/storage/v1/object/public/avatars/'+avatar])).rows[0].path,null,'Unregistered URL is never a storage reference');
  const ownFiles=(await db.query('select bucket,path from private.validated_files where user_id=$1',[C.user.id])).rows;
  assert.ok(ownFiles.length>=5,'Sources, shared copies and private originals all exist before deletion');
  expect(await cleanup(),200,'Recent worker health');
  assert.equal(expect(await rpc(C,'prepare_account_deletion'),200,'Prepare deletion').ready,true);
  const command={id:randomUUID(),receipt:randomBytes(32).toString('hex'),action:'begin',confirmation:'SUPPRIMER',password:C.password};
  expect(await request('/functions/v1/account-deletion',{user:C,method:'POST',body:{...command,password:'Wrong password'}}),401,'Reauthentication required');
  const start=expect(await request('/functions/v1/account-deletion',{user:C,method:'POST',body:command}),202,'Begin deletion');assert.equal(start.stage,'queued');
  assert.ok((await save(C,{notes:'Must be rejected'})).status>=400,'Old JWT cannot write after deletion begins');
  assert.ok((await ingest(C,'activities',null,gpx,'gpx')).status>=400,'Old JWT cannot upload through the trusted service');
  const statusBody={action:'status',id:command.id,receipt:command.receipt};
  expect(await request('/functions/v1/account-deletion',{method:'POST',body:{...statusBody,receipt:randomBytes(32).toString('hex')}}),404,'Receipt secrecy');
  expect(await cleanup(),200,'Process deletion and files');
  await eventually(async()=>{
   const state=expect(await request('/functions/v1/account-deletion',{method:'POST',body:statusBody}),200,'Deletion receipt');return state.stage==='complete';
  },{timeout:145000,label:'Scheduled final identity removal'});
  assert.equal((await db.query('select 1 from auth.users where id=$1',[C.user.id])).rowCount,0);
  assert.equal((await db.query('select 1 from storage.objects where name=$1',[ownPath])).rowCount,0);
  for(const file of ownFiles)assert.equal((await db.query('select 1 from storage.objects where bucket_id=$1 and name=$2',[file.bucket,file.path])).rowCount,0,'Deleted account file removed');
  assert.equal((await db.query('select 1 from storage.objects where name=$1',[peerPhoto])).rowCount,1);
  assert.equal((await db.query('select 1 from storage.objects where name=$1',[peerOriginal])).rowCount,1,'Other author original remains');
  assert.equal((await db.query('select 1 from public.moment_participants where moment_id=$1 and user_id=$2',[sharedId,B.user.id])).rowCount,1);
  assert.equal((await download(B,'moment-media',peerPhoto)).status,200);
  assert.ok((await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:C.refresh_token}})).status>=400);
  assert.equal(expect(await request('/functions/v1/account-deletion',{user:C,method:'POST',body:command}),202,'Lost response retry').stage,'complete');
 });
});
