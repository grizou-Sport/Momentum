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

const origin='https://project.supabase.co';
function fileFixture(data,{fail=false}={}) {
  const calls=[],items=Object.entries(data).flatMap(([kind,rows])=>rows.map(payload=>({kind,payload}))).map((item,i)=>({...item,sequence:i+1}));
  return {calls,async rpc(name){return {data:name==='begin_personal_export'?{export_id:'files',total:items.length,counts:Object.fromEntries(Object.entries(data).map(([kind,rows])=>[kind,rows.length])),created_at:'2026-09-01',timezone:'Europe/Zurich'}:{items,total:items.length,next_cursor:items.length,done:true}};},
    storage:{from(bucket){return {async createSignedUrl(path,seconds){calls.push({bucket,path,seconds});return fail?{error:new Error('Storage unavailable')}:{data:{signedUrl:origin+'/storage/v1/object/sign/'+bucket+'/'+path+'?token=new-export-only'}};}};}}};
}
test('SEC-14: old signed URLs become fresh links; both distinct sources and avatars are exported',async()=>{
  const db=fileFixture({activities:[{source_file_url:origin+'/storage/v1/object/sign/activities/owner/source.fit?token=old-secret',gpx_url:'owner/trace.gpx'}],activity_media:[{file_path:'owner/photo.jpg'}],passports:[{avatar_url:origin+'/storage/v1/object/public/avatars/owner/avatar.jpg?cache=42'}],clubs:[{logo_url:origin+'/storage/v1/object/public/club-logos/club/logo.jpg'}]});
  const result=await exporter.collect(db,{withFiles:true,storageOrigin:origin});
  assert.equal(result.files.length,5);assert.equal(db.calls.length,5);
  assert.ok(db.calls.every(x=>!x.path.includes('http')&&x.seconds===3600));
  assert.ok(db.calls.some(x=>x.bucket==='avatars'));assert.ok(db.calls.some(x=>x.path==='owner/trace.gpx'));
  assert.ok(!JSON.stringify(result).includes('old-secret'));assert.ok(result.files.every(x=>x.url.endsWith('token=new-export-only')));
});
test('SEC-14/15: repeated references sign once, while a failed file prevents complete export',async()=>{
  const data={activities:[{source_file_url:'owner/file.gpx',gpx_url:'owner/file.gpx'}]};
  const db=fileFixture(data);assert.equal((await exporter.collect(db,{withFiles:true})).files.length,1);
  await assert.rejects(exporter.collect(fileFixture(data,{fail:true}),{withFiles:true}),/fichier n’est pas récupérable/);
});
test('SEC-16/21: metadata strips old access secrets recursively without changing personal notes',async()=>{
  const result=await exporter.collect(fileFixture({activities:[{source_file_url:origin+'/storage/v1/object/sign/activities/owner/a.fit?token=private#secret',notes:'Un souvenir ? oui #lac',raw_data:{access_token:'private',items:[{refresh_token:'private',file_url:'https://user:pass@example.test/a?token=private#secret',distance:12}]}}]}));
  assert.ok(!JSON.stringify(result).includes('private'));assert.ok(!JSON.stringify(result).includes('user:pass'));
  assert.equal(result.data.activities[0].notes,'Un souvenir ? oui #lac');assert.equal(result.data.activities[0].raw_data.items[0].distance,12);
});
test('SEC-12/21: external origins, alternate buckets and ambiguous paths are never signed',async()=>{
  const bad=['https://evil.test/storage/v1/object/public/activities/owner/file.fit',origin+'/storage/v1/object/public/avatars/owner/file.fit',origin+'/storage/v1/object/public/activities/owner/../secret.fit',origin+'/storage/v1/object/public/activities/owner/%2e%2e/secret.fit','owner/./file.fit','owner/file?token=x','//evil.test/file','owner/\\file','owner/file\u0000.fit'];
  for(const path of bad){const db=fileFixture({activities:[{source_file_url:path}]});await assert.rejects(exporter.collect(db,{withFiles:true,storageOrigin:origin}),/référence de fichier/);assert.equal(db.calls.length,0);}
});
test('SEC-14: a legacy cover is included once or explicitly blocks complete export',async()=>{
 const db=fileFixture({moment_media:[{file_path:'owner/cover.jpg'}],moments:[{cover_image_url:origin+'/storage/v1/object/sign/moment-media/owner/cover.jpg?token=old-cover'}]});
 const result=await exporter.collect(db,{withFiles:true,storageOrigin:origin});assert.equal(result.files.length,1);assert.equal(result.files[0].bucket,'moment-media');assert.ok(!JSON.stringify(result).includes('old-cover'));
 await assert.rejects(exporter.collect(fileFixture({clubs:[{cover_image_url:'unknown-cover.jpg'}]}),{withFiles:true,storageOrigin:origin}),/couverture/);
});
