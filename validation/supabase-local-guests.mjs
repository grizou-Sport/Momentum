import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function verifyLocalGuests({request,A,B}) {
 const call=async(user,name,body,headers={})=>{
  const response=await request('/rest/v1/rpc/'+name,{user,method:'POST',body,headers});
  assert.equal(response.status,200,'Guest RPC transport: '+name);return response.data;
 };
 const start=new Date(Date.now()+7*86400000).toISOString(),id=randomUUID();
 const moment=await call(A,'save_shared_moment',{p_operation_id:randomUUID(),p_data:{id,title:'Fictitious guest rehearsal',status:'CONFIRMED',date_mode:'fixed',start_at:start,end_at:null,moment_type:'OTHER',description:'Not in the invitation preview',location_id:null,location_name:'Private exact address',capacity:2,visibility:'PRIVATE',club_id:null,participants:[],options:[{id:randomUUID(),start_at:start,end_at:null}]}});
 assert.equal(moment.id,id);
 assert.equal((await call(A,'list_guest_invitations',{p_moment_id:id},{origin:'https://unrelated.example'})).error,'invitation_unavailable');
 assert.deepEqual((await call(A,'list_guest_invitations',{p_moment_id:id})).invitations,[]);
 assert.equal((await call(B,'list_guest_invitations',{p_moment_id:id})).error,'invitation_unavailable');
 const invitation=await call(A,'create_guest_invitation',{p_moment_id:id,p_id:randomUUID(),p_label:'Alex fictitious',p_message:'Chosen public message',p_share_location:false});
 assert.match(invitation.secret,/^[a-f0-9]{64}$/);assert.ok(!invitation.view.location);
 for(const field of ['participants','description','profiles','rpe','notes'])assert.ok(!(field in invitation.view));
 // Reading/exchanging the link cannot constitute a response or consume it.
 const first=await call(null,'exchange_guest_invitation',{p_secret:invitation.secret});
 const second=await call(null,'exchange_guest_invitation',{p_secret:invitation.secret});
 assert.equal(first.view.answer,'none');assert.equal(second.view.answer,'none');
 const answer={p_session:first.session,p_name:'Alex fictitious',p_answer:'yes',p_availability:{},p_revision:first.view.response_revision};
 const replied=await call(null,'respond_guest_invitation',answer);assert.equal(replied.view.response_state,'pending_validation');
 assert.deepEqual(await call(null,'respond_guest_invitation',answer),replied,'Lost-response retry must be idempotent');
 assert.equal((await call(A,'manage_guest_invitation',{p_action:'confirm',p_id:invitation.id,p_revision:replied.view.response_revision})).view.response_state,'confirmed');
 assert.equal((await call(null,'read_guest_invitation',{p_session:first.session})).view.response_state,'confirmed');
 const renewed=await call(A,'manage_guest_invitation',{p_action:'renew',p_id:invitation.id});
 assert.notEqual(renewed.secret,invitation.secret);
 assert.equal((await call(null,'read_guest_invitation',{p_session:first.session})).error,'invitation_unavailable');
 assert.equal((await call(null,'exchange_guest_invitation',{p_secret:invitation.secret})).error,'invitation_unavailable');
 const current=await call(null,'exchange_guest_invitation',{p_secret:renewed.secret});assert.equal(current.view.answer,'yes');
 await call(A,'manage_guest_invitation',{p_action:'revoke',p_id:invitation.id});
 assert.equal((await call(null,'read_guest_invitation',{p_session:current.session})).error,'invitation_unavailable');
 const final=(await call(A,'list_guest_invitations',{p_moment_id:id})).invitations[0];
 assert.equal(final.revoked,true);assert.equal(final.view.answer,'yes');assert.equal(final.view.response_state,'confirmed');
 const anon=await request('/rest/v1/moments?id=eq.'+id);
 assert.ok(anon.status>=400||Array.isArray(anon.data)&&anon.data.length===0,'Anonymous capability cannot read the private Moment');
 return {originRejected:true,privatePreview:true,anonymousResponse:true,ownerConfirmation:true,renewalAndRevocation:true,historicalResponsePreserved:true};
}
