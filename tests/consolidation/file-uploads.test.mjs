import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';

const code=await readFile(new URL('../../js/momentum-uploads.js',import.meta.url),'utf8');
function fixture(responses) {
 const calls=[],session={access_token:'test-session',user:{id:'user-a'}};
 const window={MomentumConfig:{url:'https://test.supabase.co',publishableKey:'public-key'},momentumDB:{auth:{async getSession(){return {data:{session}};}}}};
 vm.runInNewContext(code,{window,crypto:{randomUUID},AbortSignal,async fetch(url,options){
  calls.push({url,...options});const next=responses.shift();
  if(next instanceof Error)throw next;
  return Response.json(next?.error?{error:next.error}:{path:'user/file.webp',operation:options.headers['x-file-operation']},{status:next?.status||201});
 }});
 return {upload:window.MomentumUploads.upload,forget:window.MomentumUploads.forget,calls,session};
}
test('upload retry retains its receipt after a lost response, but never shares it across accounts',async()=>{
 const f=fixture([new Error('offline'),{},{}]),file=new File(['bytes'],'photo.png',{type:'image/png'});
 await assert.rejects(f.upload(file,{bucket:'avatars'}),/envoi n’est pas confirmé/);
 await f.upload(file,{bucket:'avatars'});
 assert.equal(f.calls[0].headers['x-file-operation'],f.calls[1].headers['x-file-operation']);
 f.session.user.id='user-b';await f.upload(file,{bucket:'avatars'});
 assert.notEqual(f.calls[1].headers['x-file-operation'],f.calls[2].headers['x-file-operation']);
 assert.ok(f.calls.every(c=>c.body===file&&c.credentials==='omit'&&c.referrerPolicy==='no-referrer'));
});
test('an in-flight response can be retried; retired uploads and discarded associations get a new receipt',async()=>{
 const f=fixture([{status:409,error:'upload_in_progress'},{status:409,error:'upload_retired'},{},{}]),file=new File(['bytes'],'photo.jpg');
 await assert.rejects(f.upload(file,{bucket:'moment-media'}),/encore en cours/);
 await assert.rejects(f.upload(file,{bucket:'moment-media'}),/déjà été retiré/);
 await f.upload(file,{bucket:'moment-media'});f.forget(file);await f.upload(file,{bucket:'moment-media'});
 assert.equal(f.calls[0].headers['x-file-operation'],f.calls[1].headers['x-file-operation']);
 assert.notEqual(f.calls[1].headers['x-file-operation'],f.calls[2].headers['x-file-operation']);
 assert.notEqual(f.calls[2].headers['x-file-operation'],f.calls[3].headers['x-file-operation']);
});
test('avatar crops without a filename use their actual image type and validation errors stay readable',async()=>{
 const f=fixture([{status:422,error:'image_dimensions'}]);
 await assert.rejects(f.upload(new Blob(['crop'],{type:'image/jpeg'}),{bucket:'avatars'}),error=>error.name==='MomentumUploadError'&&error.userMessage.includes('12 mégapixels'));
 assert.equal(f.calls[0].headers['x-file-extension'],'jpeg');
});
