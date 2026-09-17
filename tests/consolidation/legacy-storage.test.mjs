import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const origin='https://njcqcpyiiibudlalnzoa.supabase.co';
test('MOM-15: editing an old signed source preserves the file, memory and exact retry',async t=>{
  const db=await fixture();t.after(()=>db.close());
  const old=origin+'/storage/v1/object/sign/activities/'+A+'/source.fit?token=old-secret';
  await db.query("insert into public.activities(id,user_id,activity_date,status,activity_type,source_file_url,gpx_url) values($1,$2,'2026-07-01','done','hiking',$3,$4)",[ID,A,old,A+'/trace.gpx']);
  await db.query("insert into public.activity_flow_assessments(activity_id,user_id,retained_memory) values($1,$2,'Le lac')",[ID,A]);
  const call=()=>db.query('select public.save_personal_moment($1,$2,null,null,1) result',[OP,JSON.stringify({id:ID,notes:'Corrigé'})]);
  const first=await call();assert.deepEqual(await call(),first);
  const row=(await db.query('select * from public.activities where id=$1',[ID])).rows[0];
  assert.equal(row.source_file_url,A+'/source.fit');assert.equal(row.gpx_url,A+'/trace.gpx');assert.equal(row.notes,'Corrigé');
  assert.equal((await db.query('select retained_memory from public.activity_flow_assessments')).rows[0].retained_memory,'Le lac');
  await db.exec('reset role');assert.equal((await db.query('select count(*) from private.storage_cleanup')).rows[0].count,0);
});
test('SEC-12: legacy links cannot attach another owner or an external file',async t=>{
  const db=await fixture();t.after(()=>db.close());
  for(const source of [origin+'/storage/v1/object/public/activities/'+B+'/secret.fit','https://evil.test/storage/v1/object/public/activities/'+A+'/x.fit']){
    await assert.rejects(db.query('select public.save_personal_moment($1,$2)',[OP,JSON.stringify({id:ID,activity_date:'2026-07-01',status:'done',activity_type:'hiking',source_file_url:source})]),e=>e.code==='42501');
  }
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count,0);
});
test('SEC-16: the SQL export snapshot strips access secrets from URLs and nested payloads',async t=>{
  const db=await fixture();t.after(()=>db.close());
  const url=origin+'/storage/v1/object/sign/activities/'+A+'/source.fit?token=private-secret#private-fragment';
  await db.query('insert into public.activities(id,user_id,source_file_url,notes,weather) values($1,$2,$3,$4,$5)',[ID,A,url,'Un souvenir ? oui #lac',JSON.stringify({token:'private-secret',nested:[{file_url:'https://user:private-secret@example.test/image?token=private-secret',distance:12}]})]);
  const job=(await db.query('select public.begin_personal_export() result')).rows[0].result;
  const page=(await db.query('select public.read_personal_export($1,0,200) result',[job.export_id])).rows[0].result;
  const payload=page.items.find(x=>x.kind==='activities').payload;
  assert.ok(!JSON.stringify(payload).includes('private-secret'));assert.ok(!JSON.stringify(payload).includes('private-fragment'));
  assert.equal(payload.notes,'Un souvenir ? oui #lac');assert.equal(payload.weather.nested[0].file_url,'https://example.test/image');
});
