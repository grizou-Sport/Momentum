const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const access=require('../../js/momentum-access.js');
const user={id:'fictitious-account'};
function client({session={user},sessionError=null,userError=null,profile={personalization:{onboarding_completed:true}},profileError=null}={}){
 let writes=0;
 return {auth:{async getSession(){return {data:{session},error:sessionError};},async getUser(){return {data:{user},error:userError};}},from(name){assert.equal(name,'passports');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:profile,error:profileError};},insert(){writes++;}};},writes:()=>writes};
}
test('ACC-04/05/06: legacy profiles stay ready; temporary failures never mean missing or expired accounts',async()=>{
 const db=client();assert.equal((await access.check(db)).status,'ready');assert.equal(db.writes(),0);
 assert.equal((await access.check(client({profileError:{code:'server_error'}}))).status,'temporary_error');
 assert.equal((await access.check(client({userError:{code:'unexpected_failure'}}))).status,'temporary_error');
 assert.equal((await access.check(client({sessionError:{message:'Network failure'}}))).status,'temporary_error');
 assert.equal((await access.check(client({session:null}))).status,'anonymous');
 assert.equal((await access.check(client({userError:{code:'session_not_found'}}))).status,'expired');
 assert.equal((await access.check(client({profile:null}))).status,'onboarding');
});
test('ACC-07: return destinations reject external, executable, credentialed and control-character URLs while preserving internal deep links',()=>{
 const origin='https://momentum.example';
 for(const value of ['https://evil.example/index.html','//evil.example/index.html','javascript:alert(1)','https://name:password@momentum.example/index.html','\\evil.example','\n/index.html','/login.html','/welcome.html','/invite.html','/%2f%2fevil.example'])assert.equal(access.safeReturn(value,origin),'index.html',value);
 assert.equal(access.safeReturn('/you.html?tab=account#passport',origin),'you.html?tab=account#passport');
 assert.equal(access.safeReturn(origin+'/progression.html#fitness',origin),'progression.html#fitness');
});
test('ACC-10: a stalled access check leaves an accessible retry, then resolves the same page-ready promise after recovery',async()=>{
 function element(tag){return {tag,children:[],dataset:{},attrs:{},textContent:'',append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;}};}
 const document={head:element('head'),body:element('body'),documentElement:element('html'),createElement:element};
 const timers=[];let stalled=true,resolveLate;
 const window={MomentumAccess:{safeReturn:access.safeReturn,check(){return stalled?new Promise(r=>{resolveLate=r;}):Promise.resolve({status:'ready',user});}}};
 const context={window,document,location:{pathname:'/you.html',search:'',hash:'#passport',origin:'http://localhost',replace(){assert.fail('A network timeout must not redirect');}},setTimeout(fn,ms){const task={fn,ms};timers.push(task);return task;},clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../js/guard.js'),'utf8'),context);
 const ready=window.momentumPageReady;
 timers.find(t=>t.ms===12000).fn();await new Promise(r=>setImmediate(r));
 const panel=document.body.children[0];assert.equal(panel.attrs.role,'status');assert.equal(panel.attrs['aria-live'],'polite');assert.equal(document.documentElement.dataset.accessPending,'true');
 const retry=panel.children.find(n=>n.tag==='button');assert.equal(retry.textContent,'Réessayer');
 stalled=false;await retry.onclick();assert.equal(await ready,user);assert.equal(window.momentumPageReady,ready);assert.equal(panel.removed,true);assert.equal(document.documentElement.dataset.accessPending,undefined);
 resolveLate({status:'anonymous'});await new Promise(r=>setImmediate(r)); // Late old result cannot redirect the recovered page.
});

function recoveryFixture({profileError=null}={}){
 const elements=new Map(),timers=[],redirects=[];
 function element(id){if(!elements.has(id))elements.set(id,{id,hidden:false,value:'FixtureNewPassword!123',validity:{valid:true},handlers:{},classList:{toggle(){}},addEventListener(name,fn){this.handlers[name]=fn;},setAttribute(){},focus(){},querySelector(){return element(id+'-submit');},querySelectorAll(){return [];}});return elements.get(id);}
 for(const id of ['authForm','recoveryForm','newPasswordForm'])for(const name of ['email','password','confirmPassword','terms'])element(id)[name]=element(id+'-'+name);
 const db=client({session:null,profileError});let updates=0,listener;
 db.auth.updateUser=async()=>{updates++;return {error:null};};db.auth.onAuthStateChange=fn=>{listener=fn;};
 const location={href:'http://localhost/login.html?recovery=1&returnTo=you.html%23passport',search:'?recovery=1&returnTo=you.html%23passport',hash:'',origin:'http://localhost',replace(value){redirects.push(value);}};
 const window={location,MomentumAccess:access};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../js/auth.js'),'utf8'),{window,location,momentumDB:db,document:{getElementById:element,querySelectorAll(){return [];}},URL,URLSearchParams,setTimeout(fn){timers.push(fn);}});
 listener('PASSWORD_RECOVERY');
 return {elements,element,timers,redirects,updates:()=>updates,submit:()=>element('newPasswordForm').handlers.submit({preventDefault(){}})};
}
test('ACC-09: password recovery opens the password form and returns to the safe original destination',async()=>{
 const f=recoveryFixture();assert.equal(f.element('newPasswordForm').hidden,false);assert.equal(f.element('authForm').hidden,true);
 await f.submit();assert.equal(f.updates(),1);assert.equal(f.timers.length,1);f.timers[0]();assert.deepEqual(f.redirects,['you.html#passport']);
});
test('ACC-09: a passport read failure after password change offers login with the new password without a false redirect or unhandled timer rejection',async()=>{
 const f=recoveryFixture({profileError:{code:'server_error'}});await f.submit();
 assert.equal(f.updates(),1);assert.equal(f.timers.length,0);assert.deepEqual(f.redirects,[]);
 assert.equal(f.element('newPasswordForm').hidden,true);assert.equal(f.element('authForm').hidden,false);
 assert.match(f.element('authMessage').textContent,/mot de passe est mis à jour/);assert.match(f.element('authMessage').textContent,/Continuer/);
});
