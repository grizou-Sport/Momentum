import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const moment = (changes = {}) => ({ id: ID, user_id: A, activity_date: '2026-07-01', status: 'done', activity_category: 'sport', activity_type: 'running', sport: 'running', duration_min: 60, rpe: null, ...changes });
const command = (db, payload, assessment = null, nutrition = null, operation = OP, revision = null) => db.query('select public.save_personal_moment($1,$2,$3,$4,$5) result', [operation, JSON.stringify(payload), assessment == null ? null : JSON.stringify(assessment), nutrition == null ? null : JSON.stringify(nutrition), revision]);
async function fixture() {
  const db = new PGlite();
  await db.exec(await read('./baseline.sql'));
  await db.exec(await read('../../supabase/migrations/20260905100319_activity_nutrition_v1.sql'));
  await db.exec(`insert into auth.users values ('${A}'),('${B}');`);
  await db.exec(await read('../../supabase/migrations/20260911184622_cdc_personal_moment_foundation.sql'));
  await db.exec(await read('../../supabase/migrations/20260911185216_cdc_nutrition_phases.sql'));
  await db.exec(await read('../../supabase/migrations/20260911185612_cdc_daily_observations.sql'));
  await db.exec(await read('../../supabase/migrations/20260911190711_cdc_minimal_onboarding.sql'));
  await db.exec(await read('../../supabase/migrations/20260911191134_cdc_account_export.sql'));
  await db.exec(await read('../../supabase/migrations/20260911192153_cdc_personal_story.sql'));
  await db.exec(await read('./sharing-policies.sql'));
  await db.exec(await read('../../supabase/migrations/20260911192914_cdc_shared_moment_privacy.sql'));
  await db.exec(await read('../../supabase/migrations/20260911194108_cdc_guest_invitations.sql'));
  await db.exec(await read('../../supabase/migrations/20260911194959_cdc_export_guest_responses.sql'));
  await db.exec(await read('../../supabase/migrations/20260911195144_cdc_shared_profile_privacy.sql'));
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({origin:'https://momentum-alpha-rho.vercel.app','x-forwarded-for':'192.0.2.10'})]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [A]);
  await db.exec('set role authenticated');
  return db;
}

test('MOM-02/16/18, SEC-12: atomic save, replay and ownership run in PostgreSQL', async t => {
  const db = await fixture(); t.after(() => db.close());
  const payload = moment({ source_hash: 'a'.repeat(64) });
  const memory = { perceived_challenge: null, perceived_mastery: null, retained_memory: 'Le lac au lever du jour.' };
  const first = await command(db, payload, memory);
  assert.equal(first.rows[0].result.revision, 1);
  assert.deepEqual(await command(db, payload, memory), first);
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count, 1);
  const saved = (await db.query('select * from public.activity_flow_assessments')).rows[0];
  assert.equal(saved.perceived_challenge, null); assert.equal(saved.perceived_mastery, null); assert.equal(saved.retained_memory, memory.retained_memory);
  assert.equal((await db.query('select rpe from public.activities')).rows[0].rpe, null);
  await assert.rejects(command(db, { ...payload, duration_min: 70 }, memory), e => e.code === '40001');
  await assert.rejects(command(db, { ...payload, id: B }, null, null, B), e => e.code === '23505');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [B]);
  assert.equal((await db.query('select * from public.activities')).rows.length, 0);
  await assert.rejects(command(db, moment({ user_id: B }), null, null, B), e => e.code === '42501');
  await db.exec('reset role; set role anon');
  await assert.rejects(command(db, payload), e => e.code === '42501');
});

test('MOM-16: a failed experience rolls back the activity and receipt; retry can succeed', async t => {
  const db = await fixture(); t.after(() => db.close());
  await assert.rejects(command(db, moment(), { perceived_challenge: 11 }), e => e.code === '23514');
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count, 0);
  await command(db, moment(), { retained_memory: 'Souvenir seul' });
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count, 1);
});

test('PER-07/08/11/12: planned and consumed snapshots stay separate and stable', async t => {
  const db = await fixture(); t.after(() => db.close());
  const product = (await db.query("insert into public.nutrition_products(name,category,unit_label,created_by,carbohydrates_g,sodium_mg) values ('Produit fictif','gel','sachet',$1,25,null) returning id", [A])).rows[0].id;
  const first = await command(db, moment(), null, { planned: [{ product_id: product, quantity: 2 }] });
  assert.equal((await db.query("select count(*) from public.activity_nutrition_items where phase='consumed'")).rows[0].count, 0);
  await db.query('update public.nutrition_products set carbohydrates_g=50 where id=$1', [product]);
  const second = await command(db, moment(), null, { planned: [{ product_id: product, quantity: 3 }], consumed: [{ product_id: product, quantity: 1, copy_from_planned: true }] }, B, first.rows[0].result.revision);
  const items = (await db.query('select * from public.activity_nutrition_items order by phase')).rows;
  assert.equal(items.length, 2); assert.equal(items[0].quantity, '1'); assert.equal(items[1].quantity, '3');
  assert.equal(items[0].carbohydrates_g_snapshot, '25'); assert.equal(items[1].carbohydrates_g_snapshot, '25');
  assert.equal(items[0].sodium_mg_snapshot, null);
  await assert.rejects(command(db, moment(), null, null, A, first.rows[0].result.revision), e => e.code === '40001');
  assert.equal(second.rows[0].result.revision, 2);
});

test('DAT-22/23: explicit observation corrections retain source data and protect concurrent edits', async t => {
  const db = await fixture(); t.after(() => db.close());
  const input = ['2026-07-01', JSON.stringify({ sleep_hours: 7, motivation: 6, sleep_quality_value: 3 }), [], 'Je ne suis pas malade', null, 0];
  const call = values => db.query('select public.save_daily_observations($1,$2,$3,$4,$5,$6) result', values);
  const result = (await call(input)).rows[0].result;
  assert.equal(result.daily.raw_data.manual_corrections.sleep_hours, 7);
  assert.deepEqual(result.day.context_annotations, []);
  await assert.rejects(call(input), e => e.code === '40001');
  const cleared = (await call([input[0], '{"sleep_hours":null}', ['vacation'], input[3], result.daily.updated_at, result.day.revision])).rows[0].result;
  assert.equal(cleared.daily.raw_data.manual_corrections.sleep_hours, null);
  assert.equal(cleared.daily.raw_data.previous_corrections.length, 1);
  assert.equal(cleared.day.note, input[3]);
});

test('ACC-03/04/08: minimal onboarding is resumable, idempotent and preserves legacy profiles', async t => {
  const db = await fixture(); t.after(() => db.close());
  const save = (step, values, operation, version = null) => db.query('select public.save_minimal_onboarding($1,$2,$3,$4) result', [step, JSON.stringify(values), operation, version]);
  const first = await save(1,{display_name:'Camille'},OP);
  assert.deepEqual(await save(1,{display_name:'Camille'},OP),first);
  assert.equal((await db.query('select count(*) from public.passports')).rows[0].count,1);
  const second = await save(2,{skipped:true},B,first.rows[0].result.updated_at);
  const third = await save(3,{intention:'Marcher dehors'},A,second.rows[0].result.updated_at);
  assert.equal(third.rows[0].result.complete,true);
  const passport=(await db.query('select * from public.passports')).rows[0];
  assert.equal(passport.birth_date,null); assert.equal(passport.height_cm,null);
  assert.equal(passport.personalization.open_intention,'Marcher dehors');
  assert.equal((await db.query('select count(*) from public.user_load_estimates')).rows[0].count,0);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
  await db.query("insert into public.passports(user_id,display_name,personalization) values($1,'Ancien profil','{\"onboarding_completed\":true,\"keep\":\"original\"}')",[B]);
  assert.equal((await save(1,{display_name:'Remplacement'},OP)).rows[0].result.complete,true);
  assert.equal((await db.query('select display_name from public.passports')).rows[0].display_name,'Ancien profil');
});

test('SEC-13/15/16: snapshot export crosses 1000 rows, stays stable and denies other accounts', async t => {
  const db = await fixture(); t.after(() => db.close());
  await db.query("insert into public.activities(user_id,activity_date,status,sport,activity_type,duration_min) select $1,'2020-01-01'::date+n,'done','running','running',60 from generate_series(0,1204) n",[A]);
  await db.query("insert into public.passports(user_id,display_name,personalization) values($1,'Camille','{\"access_token\":\"never-export-this\",\"keep\":\"my intention\"}')",[A]);
  const job=(await db.query('select public.begin_personal_export() result')).rows[0].result;
  assert.equal(job.counts.activities,1205);
  await db.query('update public.activities set duration_min=90 where user_id=$1',[A]);
  const collected=[];let cursor=0;
  for(let page=0;page<10;page++){
    const result=(await db.query('select public.read_personal_export($1,$2,200) result',[job.export_id,cursor])).rows[0].result;
    collected.push(...result.items);cursor=result.next_cursor;if(result.done)break;
  }
  assert.equal(collected.length,job.total);assert.equal(collected.filter(x=>x.kind==='activities').length,1205);
  assert.equal(collected.find(x=>x.kind==='activities').payload.duration_min,60);
  assert.doesNotMatch(JSON.stringify(collected),/never-export-this|access_token/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
  await assert.rejects(db.query('select public.read_personal_export($1)',[job.export_id]),e=>e.code==='42501');
});

test('PER-01/02/03: an intention has no fabricated deadline and a marked Moment is never copied',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const profile=(await db.query("insert into public.passports(user_id,display_name,personalization) values ($1,'Camille','{}') returning *",[A])).rows[0];
 const args=['Retrouver les sentiers','active',profile.updated_at,OP];
 const save=()=>db.query('select public.save_personal_intention($1,$2,$3,$4) result',args);
 const first=(await save()).rows[0].result;
 assert.equal(first.personalization.open_intention,'Retrouver les sentiers');assert.deepEqual((await save()).rows[0].result,first);
 assert.equal((await db.query('select count(*) from public.user_missions')).rows[0].count,0);
 await assert.rejects(db.query('select public.save_personal_intention($1,$2,$3,$4)', ['Autre','active',profile.updated_at,B]),e=>e.code==='40001');
 const paused=(await db.query('select public.save_personal_intention($1,$2,$3,$4) result',['Retrouver les sentiers','paused',first.updated_at,B])).rows[0].result;
 assert.equal(paused.personalization.open_intention_status,'paused');
 const saved=(await command(db,moment())).rows[0].result;
 const mark=()=>db.query('select public.mark_personal_moment($1,true,$2) result',[ID,saved.revision]);
 const marked=(await mark()).rows[0].result;assert.equal(marked.is_memorable,true);assert.deepEqual((await mark()).rows[0].result,marked);
 assert.equal((await db.query('select count(*) from public.activities')).rows[0].count,1);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
 await assert.rejects(mark(),e=>e.code==='42501');
});

test('SEC-10/12: sharing excludes private activity fields; membership cannot elevate its own role',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.query("insert into public.moments(id,user_id,created_by,title,status,capacity) values ($1,$2,$2,'Moment fictif','CONFIRMED',1)",[OP,A]);
 await db.query("insert into public.moment_participants(moment_id,user_id,role,invitation_status,participation_status) values ($1,$2,'OWNER','ACCEPTED','REGISTERED'),($1,$3,'PARTICIPANT','PENDING','INVITED')",[OP,A,B]);
 await command(db,moment({notes:'Note privée',rpe:8}));
 await db.query('update public.activities set moment_id=$1 where id=$2',[OP,ID]);
 await db.query('insert into public.moment_activities(moment_id,activity_id,added_by) values ($1,$2,$3)',[OP,ID,A]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
 assert.equal((await db.query('select * from public.activities')).rows.length,0);
 const shared=(await db.query('select public.shared_moment_activities($1) result',[OP])).rows[0].result;
 assert.equal(shared.length,1);assert.equal(shared[0].activities.duration_min,60);
 assert.equal('rpe' in shared[0].activities,false);assert.equal('notes' in shared[0].activities,false);assert.equal('avg_hr' in shared[0].activities,false);
 await assert.rejects(db.query("update public.moment_participants set role='OWNER' where user_id=$1",[B]),e=>e.code==='42501');
 await db.query("update public.moment_participants set invitation_status='ACCEPTED',participation_status='REGISTERED' where user_id=$1",[B]);
 assert.equal((await db.query('select participation_status from public.moment_participants where user_id=$1',[B])).rows[0].participation_status,'WAITLISTED');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await db.query('delete from public.moments where id=$1',[OP]);
 const preserved=(await db.query('select * from public.activities where id=$1',[ID])).rows[0];assert.equal(preserved.moment_id,null);assert.equal(preserved.notes,'Note privée');
});

test('SEC-02/03/04/05/07/09: guest scope, confirmation, capacity, revocation and secret renewal',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const M='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await db.query("insert into public.moments(id,user_id,created_by,title,status,capacity,start_at,location_name) values ($1,$2,$2,'Sortie fictive','CONFIRMED',1,now()+interval '7 days','Adresse privée fictive')",[M,A]);
 const call=async(sql,args=[])=> (await db.query(sql,args)).rows[0].result;
 const created=await call("select public.create_guest_invitation($1,$2,'Invité fictif','Au plaisir de marcher ensemble',false) result",[M,ID]);
 assert.match(created.secret,/^[a-f0-9]{64}$/);assert.equal(created.view.location,null);assert.equal('participants' in created.view,false);
 await db.exec('reset role');
 const stored=(await db.query('select secret_hash from private.guest_invitations where id=$1',[ID])).rows[0];assert.notEqual(stored.secret_hash,created.secret);
 await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');
 await assert.rejects(db.query('select * from private.guest_invitations'),e=>e.code==='42501');
 const exchanged=await call('select public.exchange_guest_invitation($1) result',[created.secret]);assert.match(exchanged.session,/^[a-f0-9]{64}$/);assert.equal(exchanged.view.response_state,'unanswered');
 assert.equal((await call('select public.exchange_guest_invitation($1) result',[created.secret])).view.response_state,'unanswered');
 const args=[exchanged.session,'Alex','yes','{}',0];const answer=()=>call('select public.respond_guest_invitation($1,$2,$3,$4,$5) result',args);
 const response=await answer();assert.equal(response.view.response_state,'pending_validation');assert.deepEqual(await answer(),response);
 await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const confirmed=await call("select public.manage_guest_invitation('confirm',$1,$2) result",[ID,response.view.response_revision]);assert.equal(confirmed.view.response_state,'confirmed');
 // A confirmed guest occupies the same capacity counter as a member.
 await db.query("insert into public.moment_participants(moment_id,user_id,role,invitation_status,participation_status) values ($1,$2,'PARTICIPANT','ACCEPTED','REGISTERED')",[M,B]);
 assert.equal((await db.query('select participation_status from public.moment_participants where user_id=$1',[B])).rows[0].participation_status,'WAITLISTED');
 const snapshot=await call('select public.begin_personal_export() result');
 const exported=await call('select public.read_personal_export($1) result',[snapshot.export_id]);
 const exportedGuest=exported.items.find(item=>item.kind==='guest_invitations').payload;assert.equal(exportedGuest.answer,'yes');assert.equal('secret_hash' in exportedGuest,false);assert.equal(JSON.stringify(exported).includes(created.secret),false);
 await db.query("update public.moments set start_at=start_at+interval '1 day' where id=$1",[M]);
 const changed=(await call('select public.list_guest_invitations($1) result',[M])).invitations[0].view;assert.equal(changed.response_needs_refresh,true);
 assert.equal((await call("select public.manage_guest_invitation('confirm',$1,$2) result",[ID,changed.response_revision])).error,'response_conflict');
 await db.exec('reset role; set role anon');await db.query("select set_config('request.jwt.claim.sub','',false)");
 args[4]=changed.response_revision;const reconfirmed=await answer();assert.equal(reconfirmed.view.response_needs_refresh,false);
 await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await call("select public.manage_guest_invitation('confirm',$1,$2) result",[ID,reconfirmed.view.response_revision]);
 const renewed=await call("select public.manage_guest_invitation('renew',$1) result",[ID]);assert.notEqual(renewed.secret,created.secret);assert.equal(renewed.view.response_state,'confirmed');
 await db.exec('reset role; set role anon');await db.query("select set_config('request.jwt.claim.sub','',false)");
 assert.equal((await call('select public.read_guest_invitation($1) result',[exchanged.session])).error,'invitation_unavailable');
 assert.equal((await call('select public.exchange_guest_invitation($1) result',[created.secret])).error,'invitation_unavailable');
 assert.equal((await call('select public.exchange_guest_invitation($1) result',[renewed.secret])).view.response_state,'confirmed');
 await db.exec('reset role; set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await call("select public.manage_guest_invitation('revoke',$1) result",[ID]);
 await db.exec('reset role; set role anon');await db.query("select set_config('request.jwt.claim.sub','',false)");
 assert.equal((await call('select public.exchange_guest_invitation($1) result',[renewed.secret])).error,'invitation_unavailable');
 await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({origin:'https://untrusted.example'})]);
 assert.equal((await call('select public.exchange_guest_invitation($1) result',[renewed.secret])).error,'invitation_unavailable');
});

test('SEC-12: shared identity never exposes the Passport or measurements',async t=>{
 const db=await fixture();t.after(()=>db.close());
 await db.query("insert into public.passports(user_id,display_name,height_cm,weight_kg) values ($1,'Camille',170,60)",[A]);
 await db.exec('reset role');await db.query("insert into public.circle_relationships(requester_id,recipient_id,status) values ($1,$2,'ACCEPTED')",[A,B]);
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
 assert.equal((await db.query('select * from public.passports')).rows.length,0);
 const shared=(await db.query('select public.shared_profiles($1) result',[[A]])).rows[0].result;
 assert.deepEqual(Object.keys(shared[0]).sort(),['avatar_url','display_name','user_id']);assert.equal(shared[0].display_name,'Camille');
});
