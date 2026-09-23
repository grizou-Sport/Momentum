import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { inspectLegal, processingFingerprint } from '../scripts/legal-publication.mjs';
const require=createRequire(import.meta.url), legal=require('../js/momentum-legal.js'), access=require('../js/momentum-access.js');
const text='<!doctype html><html lang="fr"><body>Fictitious terms</body></html>',hash=createHash('sha256').update(text).digest('hex');
const release={enabled:true,terms:{version:'1.0',path:'legal/versions/terms-1.0.html',sha256:hash},privacy:{version:'1.0',path:'legal/versions/privacy-1.0.html',sha256:hash}};
test('LEG-02/03: missing, tampered or unavailable document cannot be accepted; network errors are retryable',async()=>{
 const fetch=async()=>new Response(text);
 assert.deepEqual(await legal.verifyDocuments(release,fetch,webcrypto),release);
 await assert.rejects(legal.verifyDocuments({...release,enabled:false},fetch,webcrypto));
 await assert.rejects(legal.verifyDocuments(release,async()=>new Response('changed'),webcrypto),/changé/);
 await assert.rejects(legal.verifyDocuments(release,async()=>new Response('',{status:404}),webcrypto),/indisponible/);
 assert.throws(()=>legal.documentPath({...release.terms,path:'https://untrusted.invalid/terms.html'}));
 assert.throws(()=>legal.documentPath({...release.terms,path:'legal/versions/../terms.html'}));
 let calls=0;const db={async rpc(name,body){calls++;assert.equal(name,'accept_current_terms');assert.equal(body.p_sha256,hash);assert.equal(body.user_id,undefined);return calls===1?{error:{code:'network'}}:{data:{accepted:true}};}};
 await assert.rejects(legal.accept(db,release),/non confirmée/);assert.deepEqual(await legal.accept(db,release),{accepted:true});
});
test('LEG-04: missing server proof stops before reading a profile, regardless of user metadata',async()=>{
 const user={id:'fixture',user_metadata:{terms_accepted:true}};
 const db={auth:{getSession:async()=>({data:{session:{user}}}),getUser:async()=>({data:{user}})},rpc:async()=>({data:{enabled:true,accepted:false}}),from(){assert.fail('No profile read before legal finalization');}};
 assert.equal((await access.check(db)).status,'legal_required');
 db.rpc=async()=>({error:{message:'offline'}});assert.equal((await access.check(db)).status,'temporary_error');
});
test('LEG-13: release refuses missing decisions, proofs, stale bytes and unrun scenarios',t=>{
 const root=mkdtempSync(join(tmpdir(),'momentum-legal-gate-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const write=(path,data)=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),typeof data==='string'?data:JSON.stringify(data));};
 const manifest={status:'approved',review:{operator:'fixture-operator',legal:'fixture-review',reviewed_at:'2026-09-23'},facts:{},documents:[],scenarios:[]};
 const evidence=['docs/legal/proof.md'];write(evidence[0],'Synthetic fixture evidence');
 for(let i=1;i<=10;i++)manifest.facts['L'+String(i).padStart(2,'0')]={status:'verified',evidence};
 for(let i=1;i<=14;i++)manifest.scenarios.push({id:'LEG-'+String(i).padStart(2,'0'),result:'passed',evidence});
 for(const[kind,entry]of Object.entries({terms:'conditions',privacy:'confidentialite',identification:'mentions-legales',storage:'cookies',guest:'guest-notice'})){
  const path='legal/versions/'+kind+'-1.0.html';write(path,text);write(entry+'.html',text);manifest.documents.push({kind,path,version:'1.0',effective_at:'2026-09-23',sha256:hash});
 }
 manifest.review.source_sha256=processingFingerprint(root);
 const save=()=>write('legal/publication.json',manifest);save();assert.deepEqual(inspectLegal(root),[]);
 write('js/new-provider.js','fetch("https://unreviewed.invalid")');assert.ok(inspectLegal(root).some(error=>error.includes('Processing code changed')));
 manifest.facts.L01.status='pending';manifest.scenarios[2].result='not-run';save();write('conditions.html',text+'changed');
 const errors=inspectLegal(root).join('\n');assert.match(errors,/L01/);assert.match(errors,/LEG-03/);assert.match(errors,/hash must agree/);
});
test('LEG-06/11: weather calls reduce coordinate precision without transferring account data',async()=>{
 const urls=[];const context={URLSearchParams,Date,iso:()=> '2026-09-23',fetch:async url=>{urls.push(new URL(url));return {ok:true,json:async()=>({daily:{time:[]}})};}};
 vm.runInNewContext(readFileSync(new URL('../js/home-weather.js',import.meta.url),'utf8'),context);
 await context.getWeather(46.519653,6.632273,'2026-09-23');await context.getLivingWeatherWindow(46.519653,6.632273);
 assert.equal(urls.length,2);for(const url of urls){assert.equal(url.searchParams.get('latitude'),'46.52');assert.equal(url.searchParams.get('longitude'),'6.63');assert.equal(url.searchParams.has('user_id'),false);}
});

test('LEG-02/03: refusing terms prevents signup; double submit and network retry reuse one account',async()=>{
 const elements=new Map(),redirects=[];let signups=0,accepts=0,finishSignup;
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:'',validity:{valid:true},handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(name,fn){this.handlers[name]=fn;}});return elements.get(id);};
 const form=element('authForm');for(const name of ['email','password','confirmPassword','terms'])form[name]=element('field-'+name);
 form.email.value='fixture@example.test';form.password.value=form.confirmPassword.value='FictitiousPassword!123';
 const user={id:'fictional',email:form.email.value};
 const db={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){},signUp(){signups++;return new Promise(resolve=>{finishSignup=()=>resolve({data:{user,session:{user}}});});}},from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{personalization:{onboarding_completed:true}}})};}};
 const location={href:'https://fixture.test/login.html',search:'',hash:'',origin:'https://fixture.test',replace:value=>redirects.push(value)};
 const context={location,URL,URLSearchParams,document:{getElementById:element,querySelectorAll:()=>[]},momentumDB:db,window:{location,MomentumAccess:access,MomentumLegal:{status:async()=>({...release,accepted:true}),verifyDocuments:async()=>{},documentPath:legal.documentPath,accept:async()=>{if(++accepts===1)throw new Error('Acceptation non confirmée.');}}}};
 vm.runInNewContext(readFileSync(new URL('../js/auth.js',import.meta.url),'utf8'),context);
 context.showMode('signup');await new Promise(resolve=>setImmediate(resolve));
 const submit=()=>form.handlers.submit({preventDefault(){}});
 await submit();assert.equal(signups,0);assert.match(element('authMessage').textContent,/accord/);
 form.terms.checked=true;const pending=submit();await submit();context.showMode('login');finishSignup();await pending;
 assert.equal(signups,1);assert.equal(accepts,1);assert.equal(redirects.length,0);assert.match(element('authMessage').textContent,/non confirmée/);
 await submit();assert.equal(signups,1);assert.equal(accepts,2);assert.deepEqual(redirects,['index.html']);
});
