import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fixture } from './consolidation/database-fixture.mjs';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const SA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',SB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const migration=await readFile(new URL('../supabase/migrations/20260923143302_legal_framework.sql',import.meta.url),'utf8');
const hash=text=>createHash('sha256').update(text).digest('hex');
async function actor(db,id=A,session=id===A?SA:SB) {
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:session,user_metadata:{terms_accepted:true}})]);
 await db.exec(id?'set role authenticated':'set role anon');
}
async function setup(t) {
 const db=await fixture();t.after(()=>db.close());await db.exec('reset role');
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[SA,A,SB,B]);
 await db.exec(migration);await actor(db);return db;
}
async function release(db,terms='1.0',privacy='1.0') {
 await db.exec('reset role');
 for(const [kind,version] of [['terms',terms],['privacy',privacy],['guest','1.0']])
 await db.query("insert into private.legal_documents(kind,version,content,public_path,effective_at,approved_at) values($1,$2,$3,$4,now()-interval '1 day',now()) on conflict do nothing",[kind,version,kind+' '+version,`legal/versions/${kind}-${version}.html`]);
 await db.query("insert into private.legal_release(singleton,terms_version,privacy_version,guest_version,enabled) values(true,$1,$2,'1.0',true) on conflict(singleton) do update set terms_version=excluded.terms_version,privacy_version=excluded.privacy_version,enabled=true",[terms,privacy]);
 await actor(db);
}
const call=async(db,name,args=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
const accept=(db,terms='1.0',privacy='1.0')=>call(db,'accept_current_terms',[terms,hash('terms '+terms),privacy,hash('privacy '+privacy)]);

test('LEG-02/03/04/05: server proof is isolated, immutable, idempotent and cannot be forged in metadata',async t=>{
 const db=await setup(t);
 assert.deepEqual(await call(db,'legal_public_status'),{enabled:false});
 await assert.rejects(db.query('insert into public.passports(user_id) values($1)',[A]),e=>e.code==='ML001');
 await db.exec('reset role');await assert.rejects(db.query('insert into auth.users values($1)',[randomUUID()]),e=>e.code==='42501');await actor(db);
 await release(db);
 assert.equal((await call(db,'legal_account_status')).accepted,false);
 await assert.rejects(db.query('select public.save_minimal_onboarding(1,$1,$2)',[JSON.stringify({display_name:'Fictitious'}),randomUUID()]),e=>e.code==='ML001');
 await assert.rejects(accept(db,'0.1'),e=>e.code==='40001');
 assert.equal((await call(db,'legal_account_status')).history.length,0);
 const first=await accept(db);assert.equal(first.accepted,true);assert.equal(first.history.length,2);
 assert.deepEqual(await accept(db),first);
 assert.deepEqual(first.history.map(e=>e.event_type).sort(),['notice_delivered','terms_accept']);
 for(const item of first.history) {assert.ok(item.occurred_at);assert.match(item.path,/^legal\/versions\//);assert.ok(item.effective_at);assert.equal('user_id' in item,false);assert.equal('ip' in item,false);}
 await assert.rejects(db.query('update private.legal_events set version=$1',['fake']),e=>e.code==='42501');
 await assert.rejects(db.query('insert into private.legal_events(user_id,event_type,scope,version,document_sha256) values($1,$2,$3,$4,$5)',[B,'terms_accept','terms','1.0',hash('terms 1.0')]),e=>e.code==='42501');
 await db.query('insert into public.passports(user_id,display_name) values($1,$2)',[A,'Fictitious A']);
 await actor(db,B);assert.equal((await call(db,'legal_account_status')).accepted,false);assert.deepEqual((await call(db,'legal_account_status')).history,[]);
 await assert.rejects(db.query('insert into public.passports(user_id) values($1)',[B]),e=>e.code==='ML001');
 await release(db,'1.0','1.1');assert.equal((await call(db,'legal_account_status')).accepted,true,'Informative privacy change does not require terms again');
 await release(db,'2.0','1.1');assert.equal((await call(db,'legal_account_status')).accepted,false);
 const exported=await call(db,'begin_personal_export');const page=await call(db,'read_personal_export',[exported.export_id]);
 assert.equal(page.items.filter(i=>i.kind==='legal_events').length,2,'Rights do not require new terms');assert.equal(exported.counts.legal_events,2);
 assert.equal(typeof (await call(db,'prepare_account_deletion')).ready,'boolean');
 await assert.rejects(db.query('update public.passports set display_name=$1 where user_id=$2',['Blocked',A]),e=>e.code==='ML001');
 await db.exec('reset role');await assert.rejects(db.query("update private.legal_documents set content='changed' where kind='terms'"),e=>e.code==='42501');
 await assert.rejects(db.query("update private.legal_events set origin='changed'"),e=>e.code==='42501');
 await db.query('delete from auth.sessions where id=$1',[SA]);await actor(db);await assert.rejects(call(db,'legal_account_status'),e=>e.code==='42501');
 await actor(db,'');await assert.rejects(call(db,'legal_account_status'),e=>e.code==='42501');
});

test('LEG-08/10/11: service uploads and guest RPCs cannot bypass version checks; withdrawal remains possible',async t=>{
 const db=await setup(t);await release(db);
 await db.exec('reset role');await assert.rejects(db.query("insert into private.file_uploads(user_id,operation_id,bucket,fingerprint,path,mime) values($1,$2,'activities',$3,'fixture.gpx','application/gpx+xml')",[A,randomUUID(),'a'.repeat(64)]),e=>e.code==='42501');
 await actor(db);await accept(db);
 const M=randomUUID(),G=randomUUID();
 await db.query("insert into public.moments(id,user_id,created_by,title,status,start_at) values($1,$2,$2,'Fictitious moment','CONFIRMED',now()+interval '7 days')",[M,A]);
 const invitation=await call(db,'create_guest_invitation',[M,G,'Fictitious guest','',false]);
 assert.ok(invitation.secret);await actor(db,'');
 const opened=await call(db,'exchange_guest_invitation',[invitation.secret]);assert.ok(opened.session);
 const args=[opened.session,'Alex fictitious','yes','{}',0];
 assert.equal((await call(db,'respond_guest_invitation',args)).error,'legal_notice_required');
 await assert.rejects(db.query("select private.guest_command_internal('respond',$1)",[JSON.stringify({session:opened.session,name:'Bypass',answer:'yes',availability:{},revision:0})]),e=>e.code==='42501');
 assert.equal((await call(db,'respond_guest_with_notice',[...args,'wrong',hash('guest 1.0')])).error,'legal_notice_required');
 const response=await call(db,'respond_guest_with_notice',[...args,'1.0',hash('guest 1.0')]);assert.equal(response.view.answer,'yes');
 assert.deepEqual(await call(db,'respond_guest_with_notice',[...args,'1.0',hash('guest 1.0')]),response);
 await db.exec('reset role');await db.exec('update private.legal_release set enabled=false');await actor(db,'');
 const withdrawn=await call(db,'withdraw_guest_response',[opened.session]);assert.equal(withdrawn.view.answer,'none');assert.equal(withdrawn.view.display_name,null);assert.deepEqual(withdrawn.view.availability,{});
 assert.deepEqual(await call(db,'withdraw_guest_response',[opened.session]),withdrawn);
 assert.equal((await call(db,'withdraw_guest_response',['b'.repeat(64)])).error,'invitation_unavailable');
 await db.exec('reset role');assert.deepEqual((await db.query('select response_history from private.guest_invitations where id=$1',[G])).rows[0].response_history,[]);
});
