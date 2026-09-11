import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const service=async db=>{await db.exec('reset role; set role service_role');};
const authenticated=async(db,user=A)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');};
const claim=async db=>(await db.query('select public.claim_storage_cleanup(20) result')).rows[0].result;

test('SEC-19: deleting an activity queues files atomically, denies reuse and resumes failed cleanup',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.query("insert into public.activities(id,user_id,source_file_url,gpx_url) values($1,$2,$3,$3)",[ID,A,A+'/trace.gpx']);
 await db.query("insert into public.activity_media(activity_id,user_id,file_path) values($1,$2,$3)",[ID,A,A+'/photo.jpg']);
 await db.query("insert into storage.objects(bucket_id,name,owner_id) values ('activities',$1,$3),('activity-media',$2,$3)",[A+'/trace.gpx',A+'/photo.jpg',A]);
 await assert.rejects(db.query('select public.delete_personal_activity($1,999)',[ID]),e=>e.code==='40001');
 await db.exec('reset role');assert.equal((await db.query('select count(*) from private.storage_cleanup')).rows[0].count,0);await authenticated(db);
 const result=(await db.query('select public.delete_personal_activity($1,1) result',[ID])).rows[0].result;
 assert.equal(result.pending_files,2);assert.equal((await db.query('select count(*) from public.activity_media')).rows[0].count,0);
 assert.equal((await db.query('select count(*) from storage.objects')).rows[0].count,0,'new file reads are denied while cleanup runs');
 await assert.rejects(db.query("insert into public.activities(user_id,source_file_url) values($1,$2)",[A,A+'/trace.gpx']),e=>e.code==='23514');
 await assert.rejects(claim(db),e=>e.code==='42501');
 await service(db);const jobs=await claim(db);assert.equal(jobs.length,2);assert.equal((await claim(db)).length,0);
 assert.equal((await db.query('select public.finish_storage_cleanup($1,$2,false) result',[jobs[0].id,jobs[0].lease])).rows[0].result,true);
 assert.equal((await db.query('select public.finish_storage_cleanup($1,$2,true) result',[jobs[0].id,jobs[0].lease])).rows[0].result,false,'a stale worker cannot acknowledge the next attempt');
 await db.exec("reset role; update private.storage_cleanup set available_at=now()-interval '1 second' where state='pending'; set role service_role");
 const retry=await claim(db);assert.equal(retry.length,1);assert.notEqual(retry[0].lease,jobs[0].lease);
 await db.query('select public.finish_storage_cleanup($1,$2,true)',[retry[0].id,retry[0].lease]);
 await authenticated(db);assert.equal((await db.query('select public.delete_personal_activity($1,1) result',[ID])).rows[0].result.pending_files,1);
 await db.exec('reset role');assert.equal((await db.query('select count(*) from storage.objects')).rows[0].count,2,'SQL never removes the physical-storage catalog');
});

test('SEC-19/21: another account file is never queued; a file still referenced elsewhere remains usable',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.query("insert into public.activities(id,user_id,source_file_url) values($1,$2,$3),($4,$2,$3)",[ID,A,A+'/shared.gpx',B]);
 await db.query('select public.delete_personal_activity($1,1)',[ID]);
 await db.exec('reset role');assert.equal((await db.query('select count(*) from private.storage_cleanup')).rows[0].count,0);await authenticated(db);
 await db.query('select public.delete_personal_activity($1,1)',[B]);
 await db.exec('reset role');assert.equal((await db.query('select count(*) from private.storage_cleanup')).rows[0].count,1);
 await db.query("insert into storage.objects(bucket_id,name,owner_id) values('moment-media','shared/victim.jpg',$1)",[B]);await authenticated(db);
 await assert.rejects(db.query("select public.discard_uploaded_file('moment-media','shared/victim.jpg')"),e=>e.code==='42501');
 await assert.rejects(db.query('select * from private.storage_cleanup'),e=>e.code==='42501');
});

test('SEC-19: lost upload replies are collected after 24h; recent uploads and referenced files are retained',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.query("insert into storage.objects(bucket_id,name,owner_id,created_at) values('activities',$1,$4,now()-interval '25 hours'),('activities',$2,$4,now()-interval '25 hours'),('activities',$3,$4,now())",[A+'/orphan.gpx',A+'/used.gpx',A+'/recent.gpx',A]);
 await db.query('insert into public.activities(user_id,source_file_url) values($1,$2)',[A,A+'/used.gpx']);
 await service(db);assert.equal((await db.query('select public.collect_orphan_uploads() result')).rows[0].result,1);
 const jobs=await claim(db);assert.equal(jobs.length,1);assert.equal(jobs[0].path,A+'/orphan.gpx');
 await db.exec("reset role; update private.storage_cleanup set leased_until=now()-interval '1 second'; set role service_role");
 const resumed=await claim(db);assert.equal(resumed.length,1);assert.notEqual(resumed[0].lease,jobs[0].lease);
});
