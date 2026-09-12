import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fixture} from './database-fixture.mjs';
import {browserConfiguration} from '../../scripts/build-environment.mjs';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',OP='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const headers=(db,version)=>db.query("select set_config('request.headers',$1,false)",[JSON.stringify(version?{'x-momentum-client':version}:{})]);
const payload={id:ID,user_id:A,activity_date:'2026-09-12',activity_category:'sport',sport:'walking',activity_type:'walking',status:'done',duration_min:80,rpe:null};
const save=db=>db.query('select public.save_personal_moment($1,$2,$3,null,null)',[OP,JSON.stringify(payload),JSON.stringify({retained_memory:'Souvenir fictif conservé'})]);

test('LIV-02: legacy writes fail before rows or receipts; reads and reloaded writes preserve memories and absent effort',async t=>{
 const db=await fixture();t.after(()=>db.close());
 for(const version of [null,'obsolete']){
  await headers(db,version);
  await assert.rejects(save(db),e=>e.code==='MM001');
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count,0);
 }
 await headers(db,'cdc-2026-09-08');await save(db); // Same receipt can succeed after reload.
 await headers(db,null);
 for(const query of [
  ['update public.activities set rpe=5 where id=$1',[ID]],
  ['delete from public.activities where id=$1',[ID]],
  ['update public.activities set rpe=5 where id=$1',[B]],
  ['update public.activity_flow_assessments set retained_memory=$1 where activity_id=$2',['Replaced',ID]],
  ['insert into public.activities(id,user_id,activity_date) values($1,$2,$3)',[B,A,'2026-09-12']]
 ])await assert.rejects(db.query(...query),e=>e.code==='MM001');
 const row=(await db.query('select duration_min,rpe,retained_memory from public.activities a join public.activity_flow_assessments f on f.activity_id=a.id')).rows[0];
 assert.equal(Number(row.duration_min),80);assert.equal(row.rpe,null);assert.equal(row.retained_memory,'Souvenir fictif conservé');
 await headers(db,'cdc-2026-09-08');
 await db.query('update public.activity_flow_assessments set retained_memory=$1 where activity_id=$2',['Après rechargement',ID]);
 assert.equal((await db.query('select retained_memory from public.activity_flow_assessments')).rows[0].retained_memory,'Après rechargement');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
 assert.equal((await db.query('select * from public.activities')).rows.length,0);
 await assert.rejects(save(db),e=>e.code==='42501'); // The public label grants no ownership.
});

test('LIV-02: server maintenance without an end-user identity still runs and every account-protected application table is guarded',async t=>{
 const db=await fixture();t.after(()=>db.close());await save(db);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await headers(db,null);
 await db.query('delete from public.activities where id=$1',[ID]);
 assert.equal((await db.query('select count(*) from public.activity_flow_assessments')).rows[0].count,0);
 const missing=(await db.query("select c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname='aaa_account_writable' and not exists(select 1 from pg_trigger g where g.tgrelid=c.oid and g.tgname='aab_client_write_contract')")).rows;
 assert.deepEqual(missing,[]);
});

test('LIV-02: source and generated browser clients send the same contract and UI gives a safe reload instruction',async()=>{
 for(const source of [await readFile(new URL('../../js/supabase.js',import.meta.url),'utf8'),browserConfiguration({url:'http://127.0.0.1:54321',key:'public-fixture',target:'local'})]){
  let configuration;
  vm.runInNewContext(source,{window:{supabase:{createClient(...args){configuration=args;}}}});
  assert.equal(configuration[2].global.headers['x-momentum-client'],'cdc-2026-09-08');
 }
 const window={};vm.runInNewContext(await readFile(new URL('../../js/momentum-ui.js',import.meta.url),'utf8'),{window});
 const message=window.MomentumUI.errorMessage({code:'MM001',message:'Untrusted database detail'},'save');
 assert.match(message,/Conserve ton texte puis recharge/);assert.doesNotMatch(message,/Untrusted/);
 assert.doesNotMatch(window.MomentumUI.errorMessage({code:'42501'},'save'),/recharge/);
});
