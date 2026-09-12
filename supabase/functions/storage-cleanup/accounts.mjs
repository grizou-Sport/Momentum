const uuid=/^[0-9a-f-]{36}$/i;
// Banning prevents fresh sessions; database/Storage write guards also cover an unexpired old JWT.
export async function processAccountDeletions({rpc,request,deadline=Infinity}) {
 let failed=0;
 const jobs=await rpc('claim_account_deletions');
 if(!Array.isArray(jobs)||jobs.length>3)throw new Error('Invalid deletion batch');
 for(const job of jobs) {
  if(performance.now()>=deadline)break;
  if(!uuid.test(job.id)||!uuid.test(job.user_id)||!uuid.test(job.lease))throw new Error('Invalid deletion receipt');
  try {
   if(job.stage==='queued') {
    await request(`/auth/v1/admin/users/${job.user_id}`,{ban_duration:'876000h'},'PUT');
    if(!await rpc('purge_account_records',{p_id:job.id,p_lease:job.lease}))throw new Error('Lease changed');
   }
   const ready=await rpc('account_ready_for_identity',{p_id:job.id,p_lease:job.lease});
   if(ready)await request(`/auth/v1/admin/users/${job.user_id}`,{should_soft_delete:false},'DELETE',true);
   // The database also verifies that auth.users is actually absent before completing the receipt.
   await rpc('finish_account_deletion',{p_id:job.id,p_lease:job.lease,p_success:ready===true});
  } catch (_) {
   failed++;
   await rpc('finish_account_deletion',{p_id:job.id,p_lease:job.lease,p_success:false});
  }
 }
 return {failed};
}
