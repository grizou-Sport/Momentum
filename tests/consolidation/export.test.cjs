const {test}=require('node:test');const assert=require('node:assert/strict');const exporter=require('../../js/momentum-export.js');
function fake({failPage=false,badCount=false}={}) {
  return {async rpc(name,args){
    if(name==='begin_personal_export')return {data:{export_id:'x',total:1205,counts:{activities:badCount?1204:1205},created_at:'2026-09-01',timezone:'Europe/Zurich'}};
    const cursor=args.p_after;
    if(failPage&&cursor>=1000)return {error:new Error('interruption')};
    const end=Math.min(cursor+200,1205);return {data:{items:Array.from({length:end-cursor},(_,i)=>({sequence:cursor+i+1,kind:'activities',payload:{id:cursor+i}})),total:1205,next_cursor:end,done:end===1205}};
  }};
}
test('SEC-13: client exports every page beyond the default server limit',async()=>{
  const result=await exporter.collect(fake());assert.equal(result.data.activities.length,1205);assert.equal(result.manifest.total,1205);
  assert.ok(result.manifest.exclusions.includes('Contenu binaire des médias et fichiers source'));
});
test('SEC-15: last-page failure and wrong counters reject the whole export',async()=>{
  await assert.rejects(exporter.collect(fake({failPage:true})),/interruption/);
  await assert.rejects(exporter.collect(fake({badCount:true})),/Compteurs/);
});
