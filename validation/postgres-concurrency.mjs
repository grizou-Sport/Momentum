// Real independent PostgreSQL connections. Auth, Storage and scheduler remain fixture adapters.
// Only a disposable local PostgreSQL server is accepted; never point this at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { fixture } from '../tests/consolidation/database-fixture.mjs';

const host=process.env.PGHOST||'127.0.0.1';
assert.ok(['127.0.0.1','localhost','::1','/private/tmp/momentum-pg-validation-socket'].includes(host),'Use an isolated local test server');
const config={host,port:Number(process.env.PGPORT||5432),user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD,connectionTimeoutMillis:5000,statement_timeout:15000};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const headers=JSON.stringify({origin:'https://momentum-alpha-rho.vercel.app','x-forwarded-for':'192.0.2.10','x-momentum-client':'cdc-2026-09-08'});
const payload=(values={})=>({id:randomUUID(),user_id:A,activity_date:'2026-09-01',status:'done',activity_category:'sport',sport:'running',activity_type:'running',duration_min:60,rpe:null,...values});
const save=(client,data,op=randomUUID(),revision=null)=>client.query('select public.save_personal_moment($1,$2,null,null,$3) result',[op,JSON.stringify(data),revision]).then(r=>r.rows[0].result);
const become=async(client,user=A,role='authenticated')=>{await client.query('reset role');await client.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.headers',$2,false)",[user,headers]);await client.query('set role '+role);};

test('PostgreSQL 17: independent connections arbitrate simultaneous writes',async t=>{
 const admin=new pg.Client({...config,database:'postgres'});await admin.connect();
 const name='momentum_validation_'+randomUUID().replaceAll('-','');
 const clients=[];let databaseCreated=false,rolesCreated=false;
 t.after(async()=>{
  await Promise.allSettled(clients.map(client=>client.end()));
  if(databaseCreated)await admin.query('drop database '+name+' with (force)');
  if(rolesCreated)await admin.query('drop role authenticated, anon, service_role');
  await admin.end();
 });
 const existing=(await admin.query("select rolname from pg_roles where rolname in ('authenticated','anon','service_role')")).rows;
 assert.equal(existing.length,0,'This runner requires a disposable server without application roles');
 await admin.query('create database '+name);databaseCreated=true;
 const connect=async()=>{const client=new pg.Client({...config,database:name});await client.connect();clients.push(client);return client;};
 const owner=await connect();rolesCreated=true;
 const db={exec:sql=>owner.query(sql),query:(...args)=>owner.query(...args),close:async()=>{}};
 await fixture({database:db});
 await owner.query('reset role');
 const version=(await owner.query('show server_version')).rows[0].server_version;
 assert.match(version,/^17\./);t.diagnostic('Native PostgreSQL '+version+'; 17 CDC migrations applied to synthetic pre-CDC schema.');
 const first=await connect(),second=await connect();
 const pid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;

 // The first transaction stays open until PostgreSQL itself reports that the second is blocked.
 // This proves overlap and arbitration, rather than merely issuing two serial promises.
 async function overlap(firstWrite,secondWrite,{waitForLock=true}={}){
  await first.query('begin');let pending;
  try{
   const result=await firstWrite();
   pending=secondWrite().then(value=>({value}),error=>({error}));
   if(waitForLock){
    const end=Date.now()+5000;let locked=false;
    while(Date.now()<end){
     const row=(await owner.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];
     if(row?.wait_event_type==='Lock'){locked=true;break;}
     await delay(20);
    }
    assert.ok(locked,'Second connection must actually wait on the first transaction');
   }
   const early=waitForLock?null:await pending;
   await first.query('commit');return {first:result,second:early||await pending};
  }catch(error){await first.query('rollback');if(pending)await pending;throw error;}
 }
 await become(first);await become(second);

 await t.test('lost response retried concurrently returns one activity and the same receipt',async()=>{
  const data=payload(),op=randomUUID();
  const result=await overlap(()=>save(first,data,op),()=>save(second,data,op));
  assert.deepEqual(result.second.value,result.first);
  assert.equal(Number((await owner.query('select count(*) from public.activities where id=$1',[data.id])).rows[0].count),1);
  assert.equal(Number((await owner.query('select count(*) from private.moment_operations where operation_id=$1',[op])).rows[0].count),1);
 });
 await t.test('two simultaneous imports of identical source bytes retain exactly one activity',async()=>{
  const data=payload({source_hash:'b'.repeat(64)});
  const result=await overlap(()=>save(first,data),()=>save(second,{...data,id:randomUUID()}));
  assert.equal(result.second.error?.code,'23505');
  assert.equal(Number((await owner.query('select count(*) from public.activities where source_hash=$1',[data.source_hash])).rows[0].count),1);
 });
 await t.test('two editors cannot overwrite each other using the same revision',async()=>{
  const data=payload(),initial=await save(first,data);
  const result=await overlap(()=>save(first,{...data,notes:'First edit'},randomUUID(),initial.revision),()=>save(second,{...data,notes:'Stale edit'},randomUUID(),initial.revision));
  assert.equal(result.second.error?.code,'40001');
  assert.equal((await owner.query('select notes from public.activities where id=$1',[data.id])).rows[0].notes,'First edit');
 });
 await t.test('last shared place is allocated once, including the organizer in capacity',async()=>{
  await owner.query('insert into auth.users values ($1)',[C]);
  await owner.query('insert into public.connections(user_low_id,user_high_id) values ($1,$2),($1,$3)',[A,B,C]);
  const id=randomUUID(),start='2026-10-01T08:00:00Z';
  const data={id,title:'Concurrent synthetic hike',moment_type:'SOCIAL',status:'CONFIRMED',date_mode:'fixed',start_at:start,end_at:null,description:null,location_id:null,location_name:null,capacity:2,visibility:'PRIVATE',club_id:null,participants:[B,C],options:[{id:randomUUID(),start_at:start,end_at:null}]};
  const shared=(await first.query('select public.save_shared_moment($1,$2) result',[randomUUID(),JSON.stringify(data)])).rows[0].result;
  await become(first,B);await become(second,C);
  const answer=client=>client.query("select public.shared_moment_action('answer',$1,$2,null) result",[randomUUID(),JSON.stringify({id,answer:'ACCEPTED',schedule_revision:shared.schedule_revision})]).then(r=>r.rows[0].result);
  const result=await overlap(()=>answer(first),()=>answer(second));
  assert.equal(result.first.participation_status,'REGISTERED');assert.equal(result.second.value?.participation_status,'WAITLISTED');
  assert.equal(Number((await owner.query("select count(*) from public.moment_participants where moment_id=$1 and participation_status='REGISTERED'",[id])).rows[0].count),2);
  await become(first);await become(second);
 });
 await t.test('simultaneous cleanup workers claim disjoint batches without waiting',async()=>{
  await owner.query("insert into public.activities(id,user_id,source_file_url) values($1,$2,$3)",[A,A,A+'/concurrent-cleanup.gpx']);
  await first.query('select public.delete_personal_activity($1,1)',[A]);
  await become(first,A,'service_role');await become(second,A,'service_role');
  const claim=client=>client.query('select public.claim_storage_cleanup(20) result').then(r=>r.rows[0].result);
  const result=await overlap(()=>claim(first),()=>claim(second),{waitForLock:false});
  assert.equal(result.first.length,1);assert.deepEqual(result.second.value,[]);
  assert.equal(new Set([...result.first,...result.second.value].map(job=>job.id)).size,1);
 });
 await t.test('an upload registers before account deletion, and its late files stay queued until the upload lease expires',async()=>{
  const session=randomUUID(),op=randomUUID(),deletion=randomUUID();
  await owner.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,C]);
  await owner.query("update private.cleanup_runtime set configured_at=now(),last_success_at=now()");
  const beginUpload=client=>client.query("select public.begin_file_upload($1,$2,$3,'avatars',$1,$4,'jpeg','png','image/jpeg') result",[C,session,op,'c'.repeat(64)]).then(r=>r.rows[0].result);
  const result=await overlap(()=>beginUpload(first),()=>second.query('select public.begin_account_deletion($1,$2,$3) result',[C,deletion,'d'.repeat(64)]));
  assert.equal(result.first.state,'uploading');assert.equal(result.second.value.rows[0].result.stage,'queued');
  const lease=randomUUID();await owner.query('update private.account_deletions set lease=$1 where id=$2',[lease,deletion]);
  assert.equal((await first.query('select public.purge_account_records($1,$2) result',[deletion,lease])).rows[0].result,true);
  const pending=(await owner.query('select path,available_at from private.storage_cleanup where user_id=$1',[C])).rows;
  assert.equal(pending.length,2,'Even objects absent from Storage are registered for later deletion');
  assert.ok(pending.every(item=>new Date(item.available_at)>=new Date(result.first.leased_until)));
  assert.equal((await first.query('select public.account_ready_for_identity($1,$2) result',[deletion,lease])).rows[0].result,false);
 });
 await t.test('an account deletion that wins the race denies a new upload before any storage receipt exists',async()=>{
  const session=randomUUID(),op=randomUUID();await owner.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,B]);
  const result=await overlap(()=>first.query('select public.begin_account_deletion($1,$2,$3)',[B,randomUUID(),'e'.repeat(64)]),()=>second.query("select public.begin_file_upload($1,$2,$3,'activities',null,$4,'gpx',null,'application/gpx+xml')",[B,session,op,'f'.repeat(64)]));
  assert.equal(result.second.error?.code,'42501');
  assert.equal((await owner.query('select count(*)::int n from private.file_uploads where operation_id=$1',[op])).rows[0].n,0);
 });

});
