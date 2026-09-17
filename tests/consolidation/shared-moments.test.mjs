import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './database-fixture.mjs';
import { createRequire } from 'node:module';
const {request} = createRequire(import.meta.url)('../../js/momentum-shared-commands.js');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const day='2026-10-01T08:00:00.000Z', later='2026-10-02T08:00:00.000Z';
const proposal=(changes={})=>({id:randomUUID(),title:'Balade fictive',moment_type:'SOCIAL',status:'CONFIRMED',date_mode:'fixed',start_at:day,end_at:null,
 description:null,location_id:null,location_name:null,capacity:3,visibility:'PRIVATE',club_id:null,participants:[B],options:[{id:randomUUID(),start_at:day,end_at:null}],...changes});
const save=async(db,data,revision=null,op=randomUUID())=>(await db.query('select public.save_shared_moment($1,$2,$3) result',[op,JSON.stringify(data),revision])).rows[0].result;
const action=async(db,type,data,revision=null,op=randomUUID())=>(await db.query('select public.shared_moment_action($1,$2,$3,$4) result',[type,op,JSON.stringify(data),revision])).rows[0].result;
const current=async(db,id)=>(await db.query('select * from public.moments where id=$1',[id])).rows[0];
const become=(db,user)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
async function connectedFixture(t) {
 const db=await fixture();t.after(()=>db.close());
 await db.exec('reset role');
 await db.query('insert into public.connections(user_low_id,user_high_id) values($1,$2)',[A,B]);
 await db.exec('set role authenticated');
 return db;
}

test('TOG: save is atomic, a lost response replays the exact receipt, and stale editing fails',async t=>{
 const db=await connectedFixture(t),data=proposal(),op=randomUUID();
 const first=await save(db,data,null,op);
 assert.deepEqual(await save(db,data,null,op),first);
 assert.equal((await db.query('select count(*) from public.moments')).rows[0].count,1);
 assert.equal((await db.query('select count(*) from public.moment_participants')).rows[0].count,2);
 assert.equal((await db.query('select count(*) from public.moment_date_options where is_selected')).rows[0].count,1);
 await assert.rejects(save(db,{...data,title:'Changed'},null,op),e=>e.code==='40001');
 const edited=await save(db,{...data,title:'Le nouveau titre'},first.revision);
 assert.ok(edited.revision>first.revision);
 await assert.rejects(save(db,data,first.revision),e=>e.code==='40001');
 await become(db,B);
 await assert.rejects(save(db,data,edited.revision),e=>e.code==='42501');
 await db.exec('reset role; set role anon');
 await assert.rejects(save(db,data),e=>e.code==='42501');
});

test('TOG: a bad participant, late bad slot, missing confirmed date or NULL payload leaves no rows',async t=>{
 const db=await connectedFixture(t);
 await assert.rejects(save(db,proposal({participants:[randomUUID()]})),e=>e.code==='42501');
 const bad=proposal();bad.options.push({id:randomUUID(),start_at:'not-a-date'});
 await assert.rejects(save(db,bad),e=>e.code==='22007');
 await assert.rejects(save(db,proposal({options:[]})),e=>e.code==='22023');
 await assert.rejects(db.query('select public.save_shared_moment($1,null)',[randomUUID()]),e=>e.code==='22023');
 assert.equal((await db.query('select count(*) from public.moments')).rows[0].count,0);
 assert.equal((await db.query('select count(*) from public.moment_date_options')).rows[0].count,0);
 assert.equal((await db.query('select count(*) from public.moment_participants')).rows[0].count,0);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*) from private.shared_moment_operations')).rows[0].count,0);
});

test('TOG: drafts preserve selections privately; publishing needs a coherent date and cannot revert',async t=>{
 const db=await connectedFixture(t),data=proposal({title:'',status:'DRAFT',start_at:null,options:[]});
 const draft=await save(db,data);
 await become(db,B);
 assert.equal((await db.query('select count(*) from public.moments')).rows[0].count,0);
 assert.equal((await db.query('select count(*) from public.moment_participants')).rows[0].count,0);
 await assert.rejects(action(db,'answer',{id:data.id,answer:'ACCEPTED',schedule_revision:draft.schedule_revision}),e=>e.code==='42501');
 await become(db,A);
 await assert.rejects(save(db,{...data,title:'Prêt',status:'CONFIRMED'},draft.revision),e=>e.code==='22023');
 const published=proposal({id:data.id});
 const result=await save(db,published,draft.revision);
 await assert.rejects(save(db,data,result.revision),e=>e.code==='22023');
 await become(db,B);
 assert.equal((await db.query('select count(*) from public.moments')).rows[0].count,1);
 assert.equal((await db.query('select invitation_status from public.moment_participants where user_id=$1',[B])).rows[0].invitation_status,'PENDING');
});

test('TOG: departed Circle members stay selected; answered slots cannot be removed or rewritten',async t=>{
 const db=await connectedFixture(t),data=proposal();
 const first=await save(db,data);
 await become(db,B);
 await action(db,'availability',{id:data.id,option_id:data.options[0].id,answer:'AVAILABLE',schedule_revision:first.schedule_revision});
 await db.exec('reset role');await db.query("update public.connections set status='removed'");await db.exec('set role authenticated');
 await become(db,A);
 const edit=await save(db,{...data,title:'Titre modifié'},(await current(db,data.id)).revision);
 assert.equal((await db.query('select invitation_status from public.moment_participants where user_id=$1',[B])).rows[0].invitation_status,'PENDING');
 await assert.rejects(save(db,{...data,start_at:later,options:[{id:randomUUID(),start_at:later,end_at:null}]},edit.revision),e=>e.code==='22023');
 await assert.rejects(save(db,{...data,start_at:later,options:[{...data.options[0],start_at:later}]},edit.revision),e=>e.code==='22023');
 assert.equal((await db.query('select availability_status from public.moment_availability')).rows[0].availability_status,'AVAILABLE');
 assert.equal((await current(db,data.id)).title,'Titre modifié');
});

test('TOG: choosing a date is one transaction, clears the old selection and invalidates old confirmations',async t=>{
 const db=await connectedFixture(t),data=proposal();
 data.options.push({id:randomUUID(),start_at:later,end_at:null});
 const first=await save(db,data);
 await become(db,B);
 await action(db,'answer',{id:data.id,answer:'ACCEPTED',schedule_revision:first.schedule_revision});
 await become(db,A);
 const before=await current(db,data.id),op=randomUUID(),selection={id:data.id,option_id:data.options[1].id};
 const changed=await action(db,'confirm_date',selection,before.revision,op);
 assert.deepEqual(await action(db,'confirm_date',selection,before.revision,op),changed);
 assert.equal((await db.query('select id from public.moment_date_options where is_selected')).rows[0].id,data.options[1].id);
 assert.equal(new Date((await current(db,data.id)).start_at).toISOString(),later);
 const participant=(await db.query('select * from public.moment_participants where user_id=$1',[B])).rows[0];
 assert.equal(participant.participation_status,'REGISTERED');
 assert.notEqual(participant.confirmed_schedule_revision,changed.schedule_revision);
 await become(db,B);
 await assert.rejects(action(db,'answer',{id:data.id,answer:'ACCEPTED',schedule_revision:first.schedule_revision}),e=>e.code==='40001');
 const refreshed=await action(db,'answer',{id:data.id,answer:'ACCEPTED',schedule_revision:changed.schedule_revision});
 assert.equal(refreshed.participation_status,'REGISTERED');
});

test('TOG: capacity includes organizer, waitlisted member can retry after a place opens',async t=>{
 const db=await connectedFixture(t),data=proposal({capacity:1});
 const first=await save(db,data);
 await become(db,B);
 const waiting=await action(db,'answer',{id:data.id,answer:'ACCEPTED',schedule_revision:first.schedule_revision});
 assert.equal(waiting.participation_status,'WAITLISTED');
 await become(db,A);
 const increased=await save(db,{...data,capacity:2},(await current(db,data.id)).revision);
 await become(db,B);
 const accepted=await action(db,'answer',{id:data.id,answer:'ACCEPTED',schedule_revision:increased.schedule_revision});
 assert.equal(accepted.participation_status,'REGISTERED');
});

test('TOG: browser retry keeps an immutable request and deduplicates double clicks',async()=>{
 const calls=[];let release;
 const rpc=async(name,args)=>{calls.push({name,args});if(calls.length===1)await new Promise(resolve=>{release=resolve;});return calls.length===1 ? {error:{message:'network lost'}} : {data:{id:'saved'}};};
 const input={id:'saved',title:'Original'};
 const saveRequest=request(rpc,'save',input,7,'operation');input.title='Changed afterwards';
 const first=saveRequest.run(),double=saveRequest.run();
 assert.equal(first,double);await Promise.resolve();assert.equal(calls.length,1);release();
 assert.equal((await first).uncertain,true);
 assert.equal((await saveRequest.run()).ok,true);
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[1].args.p_data.title,'Original');
 await saveRequest.run();assert.equal(calls.length,2);
});

test('SEC-01: a Moment can be proposed without any Circle or participants',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const result=await save(db,proposal({participants:[]}));
 assert.equal(result.status,'CONFIRMED');
 assert.equal((await db.query('select count(*) from public.moment_participants')).rows[0].count,1);
});

test('SEC-07/12: a new place refreshes opted-in guests, preserves opt-outs and requires fresh consent',async t=>{
 const db=await connectedFixture(t),data=proposal();
 const first=await save(db,data);
 const call=async(sql,args=[])=>(await db.query(sql,args)).rows[0].result;
 const guests=[];
 for(const share of [true,false]) {
  const id=randomUUID();const guest=await call("select public.create_guest_invitation($1,$2,'Alex fictif','', $3) result",[data.id,id,share]);
  assert.equal(guest.view.location,null);guests.push({id,...guest});
 }
 await db.exec('reset role; set role anon');await become(db,'');
 const session=await call('select public.exchange_guest_invitation($1) result',[guests[0].secret]);
 const response=await call("select public.respond_guest_invitation($1,'Alex','yes','{}',0) result",[session.session]);
 await db.exec('reset role; set role authenticated');await become(db,A);
 await call("select public.manage_guest_invitation('confirm',$1,$2) result",[guests[0].id,response.view.response_revision]);
 const changed=await save(db,{...data,location_name:'Nouveau lieu fictif'},(await current(db,data.id)).revision);
 assert.ok(changed.schedule_revision>first.schedule_revision);
 const list=(await call('select public.list_guest_invitations($1) result',[data.id])).invitations;
 const optedIn=list.find(item=>item.id===guests[0].id).view;
 assert.equal(optedIn.location,'Nouveau lieu fictif');assert.equal(optedIn.response_needs_refresh,true);
 assert.equal(list.find(item=>item.id===guests[1].id).view.location,null);
 assert.equal((await call("select public.manage_guest_invitation('confirm',$1,$2) result",[guests[0].id,optedIn.response_revision])).error,'response_conflict');
 const snapshot=await call('select public.begin_personal_export() result');
 const exported=await call('select public.read_personal_export($1) result',[snapshot.export_id]);
 const exportedGuest=exported.items.find(item=>item.kind==='guest_invitations' && item.payload.id===guests[0].id).payload;
 assert.equal(exportedGuest.share_location,true);assert.equal(exportedGuest.responded_schedule_revision,first.schedule_revision);
 assert.equal(exported.items.find(item=>item.kind==='moments').payload.schedule_revision,changed.schedule_revision);
 assert.equal(JSON.stringify(exported).includes(guests[0].secret),false);
});

test('SEC-12: organizer cannot certify another member’s new schedule; drafts do not leak through exports',async t=>{
 const db=await connectedFixture(t),data=proposal();const saved=await save(db,data);
 await assert.rejects(db.query('update public.moment_participants set confirmed_schedule_revision=$1 where user_id=$2',[saved.schedule_revision,B]),e=>e.code==='42501');
 const draft=proposal({status:'DRAFT',title:'Secret',options:[],start_at:null});await save(db,draft);
 await become(db,B);
 const snapshot=(await db.query('select public.begin_personal_export() result')).rows[0].result;
 const exported=(await db.query('select public.read_personal_export($1) result',[snapshot.export_id])).rows[0].result;
 assert.equal(JSON.stringify(exported).includes(draft.id),false);
});

test('TOG: server rejection is definitive, lost connection is uncertain',async()=>{
 const rejected=request(async()=>({error:{code:'40001',message:'Reload'}}),'confirm_date',{id:'id'},4,'op');
 assert.deepEqual(await rejected.run(),{ok:false,uncertain:false,conflict:true,message:'Le Moment ou ses réponses ont changé. Recharge-le avant de réessayer.'});
 const offline=request(async()=>{throw new Error('offline');},'answer',{id:'id'},null,'op');
 assert.equal((await offline.run()).uncertain,true);
});

test('TOG: a stalled request times out; a late reply cannot replace the retry result',async()=>{
 let finishLate;let calls=0;
 const saved=request(()=>++calls===1 ? new Promise(resolve=>{finishLate=resolve;}) : Promise.resolve({data:{id:'same',revision:2}}),'save',{id:'same'},null,'op',5);
 assert.equal((await saved.run()).uncertain,true);
 const retried=await saved.run();assert.equal(retried.data.revision,2);
 finishLate({data:{id:'same',revision:1}});
 await Promise.resolve();assert.deepEqual(await saved.run(),retried);
});
