import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inspectCDC } from '../scripts/cdc-validation.mjs';
import { buildEnvironment, productionOrigin } from '../scripts/build-environment.mjs';
import { root } from '../scripts/lib.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'momentum-release-'));
  t.after(() => rmSync(dir, { recursive:true, force:true }));
  const write = (file, content) => { mkdirSync(join(dir, file, '..'), {recursive:true}); writeFileSync(join(dir,file), typeof content === 'string' ? content : JSON.stringify(content)); };
  const spec = '| ACC-01 | Task | Outcome |\n| LIV-06 | Published smoke test | Outcome |\n';
  const verified = {status:'verified',evidence:['proof.md']};
  const manifest = {status:'ready-for-release',specification:'spec.md',acceptance:'acceptance.json',requiredFiles:['app.js'],preDeployment:verified,requirements:Array.from({length:33},(_,i)=>({id:'chapter-'+String(i+1).padStart(2,'0'),...verified,...(i===31?{status:'unverified',evidence:[]}: {})}))};
  const acceptance = {sha256:createHash('sha256').update(spec).digest('hex'),scenarios:[{id:'ACC-01',result:'passed',evidence:['proof.md']},{id:'LIV-06',result:'not-run',evidence:[]}]};
  write('app.js','void 0;');write('proof.md','Fixture proof');write('spec.md',spec);
  const save = () => { write('specs/cdc/2026-09-08.delivery.json',manifest);write('acceptance.json',acceptance); };
  save(); return {dir,write,save,manifest,acceptance};
}
test('production readiness requires all pre-release proof and permits only the published smoke test to remain pending',t=>{
  const f=fixture(t);assert.deepEqual(inspectCDC(f.dir,'release'),[]);
  assert.ok(inspectCDC(f.dir).some(x=>x.includes('LIV-06')));
  f.acceptance.scenarios[0].result='partial';f.save();assert.ok(inspectCDC(f.dir,'release').some(x=>x.includes('ACC-01: partial')));
});
test('missing chapters, missing evidence and silently removed scenarios block readiness',t=>{
  const f=fixture(t);f.manifest.requirements.pop();f.acceptance.scenarios.shift();f.manifest.preDeployment={status:'verified',evidence:['missing.md']};f.save();
  const errors=inspectCDC(f.dir,'release').join('\n');assert.match(errors,/chapter-33/);assert.match(errors,/missing.md/);assert.match(errors,/ACC-01: must appear/);
});
test('complete delivery additionally requires the actual published commit, URL and successful smoke-test evidence',t=>{
  const f=fixture(t);f.manifest.status='verified';f.manifest.requirements[31]={id:'chapter-32',status:'verified',evidence:['proof.md']};f.acceptance.scenarios[1]={id:'LIV-06',result:'passed',evidence:['proof.md']};f.save();assert.ok(inspectCDC(f.dir).some(x=>x.includes('Published')));
  f.manifest.deployment={status:'verified',commit:'a'.repeat(40),url:'https://example.invalid',evidence:['proof.md']};f.save();assert.deepEqual(inspectCDC(f.dir),[]);
});
test('preview configuration rejects production, privileged keys, external endpoints and ambiguous targets',()=>{
  const publicKey='sb_publishable_fixture';
  assert.deepEqual(buildEnvironment({VERCEL_ENV:'preview'}),{target:'preview',configured:false,url:'',key:''});
  for(const url of [productionOrigin,'https://example.invalid','https://'+ 'a'.repeat(20)+'.supabase.co/path','http://127.0.0.1:54321']) assert.throws(()=>buildEnvironment({VERCEL_ENV:'preview',MOMENTUM_TEST_SUPABASE_URL:url,MOMENTUM_TEST_SUPABASE_KEY:publicKey}));
  assert.throws(()=>buildEnvironment({VERCEL:'1'}));
  assert.throws(()=>buildEnvironment({VERCEL_ENV:'preview',MOMENTUM_TEST_SUPABASE_URL:'https://'+'a'.repeat(20)+'.supabase.co',MOMENTUM_TEST_SUPABASE_KEY:'sb_secret_fixture'}));
  assert.equal(buildEnvironment({MOMENTUM_TEST_SUPABASE_URL:'http://127.0.0.1:54321',MOMENTUM_TEST_SUPABASE_KEY:publicKey}).configured,true);
});
test('an incomplete CDC can build an isolated preview but cannot build production',t=>{
  const f=fixture(t);f.manifest.status='implementation-in-progress';f.save();
  for(const file of ['scripts/lib.mjs','scripts/build.mjs','scripts/cdc-validation.mjs','scripts/build-environment.mjs']) f.write(file,readFileSync(join(root,file),'utf8'));
  f.write('login.html','<script src="js/supabase.js"></script><input name="password">');f.write('js/supabase.js',`fetch('${productionOrigin}')`);
  const env={...process.env,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),MOMENTUM_TEST_SUPABASE_URL:'',MOMENTUM_TEST_SUPABASE_KEY:''};
  const preview=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:f.dir,env,encoding:'utf8'});assert.equal(preview.status,0,preview.stderr);
  assert.doesNotMatch(readFileSync(join(f.dir,'dist/js/supabase.js'),'utf8'),/njcqcpyiiibudlalnzoa/);
  assert.match(readFileSync(join(f.dir,'dist/login.html'),'utf8'),/espaces personnels sont désactivés/);
  rmSync(join(f.dir,'dist'),{recursive:true});
  const production=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:f.dir,env:{...env,VERCEL_ENV:'production'},encoding:'utf8'});assert.notEqual(production.status,0);assert.match(production.stderr,/Production release is not ready/);assert.equal(existsSync(join(f.dir,'dist')),false);
});
