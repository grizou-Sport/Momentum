import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const ACT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',MOM='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',CLUB='cccccccc-cccc-4ccc-8ccc-cccccccccccc',JOB='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const HASH='a'.repeat(64);
async function service(db){await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);set role service_role");}
async function owner(db){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);await db.exec('set role authenticated');}
const rpc=async(db,name,args=[],placeholders=args.map((_,i)=>'$'+(i+1)).join(','))=>(await db.query(`select public.${name}(${placeholders}) result`,args)).rows[0].result;
async function ready(db){await db.exec("reset role;update private.cleanup_runtime set configured_at=now(),last_success_at=now()");await service(db);}

test('SEC-19: account removal waits for files and Auth, preserves another participant and accepts safe retries',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.exec('reset role');
 await db.query("insert into public.clubs(id,owner_id,name,slug,category,location_name) values($1,$2,'Club fictif','club-fictif','sport','Lausanne')",[CLUB,A]);
 await db.query("insert into public.club_members(club_id,user_id,role,membership_status) values($1,$2,'OWNER','ACCEPTED'),($1,$3,'MEMBER','ACCEPTED')",[CLUB,A,B]);
 await db.query("insert into public.moments(id,user_id,created_by,club_id,title,status,story) values($1,$2,$2,$3,'Sortie fictive','CONFIRMED','Note personnelle')",[MOM,A,CLUB]);
 await db.query("insert into public.moment_participants(moment_id,user_id,role,invitation_status,participation_status) values($1,$2,'OWNER','ACCEPTED','REGISTERED'),($1,$3,'PARTICIPANT','ACCEPTED','REGISTERED')",[MOM,A,B]);
 await db.query("insert into public.activities(id,user_id,moment_id,source_file_url,notes) values($1,$2,$4,$5,'Privé A'),($3,$3,$4,null,'Privé B')",[ACT,A,B,MOM,A+'/source.gpx']);
 await db.query("insert into storage.objects(bucket_id,name,owner_id) values('activities',$1,$2),('moment-media',$3,$4)",[A+'/source.gpx',A,MOM+'/other.jpg',B]);
 await db.query("insert into public.moment_media(moment_id,user_id,file_path) values($1,$2,$3)",[MOM,B,MOM+'/other.jpg']);
 await owner(db);await assert.rejects(rpc(db,'begin_account_deletion',[A,JOB,HASH]),e=>e.code==='42501');
 await ready(db);const first=await rpc(db,'begin_account_deletion',[A,JOB,HASH]);assert.deepEqual(await rpc(db,'begin_account_deletion',[A,JOB,HASH]),first);
 await assert.rejects(rpc(db,'begin_account_deletion',[A,JOB,'b'.repeat(64)]),e=>e.code==='40001');
 assert.equal(await rpc(db,'account_deletion_status',[JOB,'b'.repeat(64)]),null);
 await owner(db);await assert.rejects(db.query("insert into public.activities(user_id,notes) values($1,'Nouveau')",[A]),e=>e.code==='42501');
 await assert.rejects(db.query("insert into storage.objects(bucket_id,name,owner_id) values('activities',$1,$2)",[A+'/later.gpx',A]),e=>e.code==='42501');
 await service(db);const job=(await rpc(db,'claim_account_deletions'))[0];assert.equal((await rpc(db,'claim_account_deletions')).length,0);
 assert.equal(await rpc(db,'purge_account_records',[JOB,job.lease]),true);assert.equal(await rpc(db,'purge_account_records',[JOB,job.lease]),true);
 assert.equal(await rpc(db,'account_ready_for_identity',[JOB,job.lease]),false);
 const files=await rpc(db,'claim_storage_cleanup',[20]);assert.equal(files.length,1);assert.equal(files[0].path,A+'/source.gpx');
 // Only in this fake Storage adapter: simulate the provider removing this object's catalog entry.
 await db.exec('reset role');await db.query("delete from storage.objects where bucket_id='activities' and name=$1",[files[0].path]);await service(db);
 await rpc(db,'finish_storage_cleanup',[files[0].id,files[0].lease,true]);
 assert.equal(await rpc(db,'account_ready_for_identity',[JOB,job.lease]),true);
 await assert.rejects(rpc(db,'finish_account_deletion',[JOB,job.lease,true]),e=>e.code==='55000');
 // Only a synthetic Auth account is removed, using the captured foreign keys.
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[A]);await service(db);
 assert.equal(await rpc(db,'finish_account_deletion',[JOB,job.lease,true]),true);
 assert.equal((await rpc(db,'account_deletion_status',[JOB,HASH])).stage,'complete');
 await db.exec('reset role');
 assert.equal((await db.query('select user_id,notes from public.activities')).rows[0].user_id,B);
 assert.equal((await db.query('select user_id from public.moment_participants')).rows[0].user_id,B);
 assert.equal((await db.query('select user_id from public.moment_media')).rows[0].user_id,B);
 const club=(await db.query('select * from public.clubs')).rows[0];assert.equal(club.status,'ARCHIVED');assert.equal(club.owner_id,null);
 const shared=(await db.query('select * from public.moments')).rows[0];assert.equal(shared.story,null);assert.equal(shared.status,'CANCELLED');assert.equal(shared.created_by,null);
 assert.equal((await db.query('select owner_id from storage.objects')).rows[0].owner_id,B);
});

test('SEC-19: deletion cannot start without a recently verified cleanup worker',async t=>{
 const db=await fixture();t.after(()=>db.close());
 assert.equal((await rpc(db,'prepare_account_deletion')).ready,false);
 await service(db);await assert.rejects(rpc(db,'begin_account_deletion',[A,JOB,HASH]),e=>e.code==='55000');
 await db.exec('reset role');assert.equal((await db.query('select count(*) from private.account_deletions')).rows[0].count,0);
});

test('SEC-19: another person’s historical nutrition snapshot survives retirement of its catalogue owner',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.exec('reset role');
 await db.query('insert into public.activities(id,user_id) values($1,$2)',[ACT,B]);
 const product=(await db.query("insert into public.nutrition_products(name,category,unit_label,created_by,carbohydrates_g) values('Produit historique fictif','gel','unité',$1,22) returning id",[A])).rows[0].id;
 // Trusted legacy import: A's catalogue product was previously referenced by B's snapshot.
 await db.query("insert into public.activity_nutrition_items(activity_id,product_id,quantity,product_name_snapshot,unit_label_snapshot,phase) values($1,$2,2,'','', 'consumed')",[ACT,product]);
 await ready(db);await rpc(db,'begin_account_deletion',[A,JOB,HASH]);const job=(await rpc(db,'claim_account_deletions'))[0];
 await rpc(db,'purge_account_records',[JOB,job.lease]);await db.exec('reset role');
 const snapshot=(await db.query('select * from public.activity_nutrition_items')).rows[0];assert.equal(snapshot.carbohydrates_g_snapshot,'22');assert.equal(snapshot.quantity,'2');
 const catalogue=(await db.query('select * from public.nutrition_products where id=$1',[product])).rows[0];assert.equal(catalogue.created_by,null);assert.equal(catalogue.is_active,false);assert.equal(catalogue.is_global,false);
 await db.query('delete from auth.users where id=$1',[A]);
 assert.equal((await db.query('select count(*) from public.activity_nutrition_items')).rows[0].count,1);
});
