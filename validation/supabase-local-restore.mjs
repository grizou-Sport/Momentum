// Offline recovery rehearsal for this disposable LOCAL project only.
// Originals remain stopped and intact; restored services use NEW named volumes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import http from 'node:http';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import pg from 'pg';

const exec=promisify(execFile),docker=process.env.DOCKER_BIN||'docker';
const project='momentum-cdc-validation',network='momentum-cdc-local';
const config=JSON.parse(await readFile(process.env.MOMENTUM_LOCAL_STATUS,'utf8'));
const localConfig=await readFile(process.env.MOMENTUM_LOCAL_CONFIG,'utf8');
const accounts=JSON.parse(await readFile(process.env.MOMENTUM_LOCAL_ACCOUNTS,'utf8'));
const output=path.resolve(process.env.MOMENTUM_RESTORE_OUTPUT);
assert.equal(config.API_URL,'http://127.0.0.1:54321');
assert.equal(new URL(config.DB_URL).hostname,'127.0.0.1');
assert.equal(new URL(config.DB_URL).port,'54322');
assert.match(localConfig,/^project_id = "momentum-cdc-validation"/m);
for(const actor of [accounts.A,accounts.B])assert.match(actor.email,/@example\.invalid$/);
assert.ok(output.startsWith('/private/tmp/'),'Keep backup credentials outside the source tree');
await mkdir(output,{recursive:true,mode:0o700});
await writeFile(path.join(output,'result.json'),JSON.stringify({status:'running',startedAt:new Date().toISOString()}),{mode:0o600});
const run=async(...args)=>(await exec(docker,args,{maxBuffer:32*1024*1024,timeout:60000})).stdout.trim();
const context=JSON.parse(await run('context','inspect'))[0];
const socket=context.Endpoints.docker.Host;
assert.ok(socket.startsWith('unix://'),'Remote Docker engines are forbidden');
const version=await run('version','--format','{{.Server.APIVersion}}');
async function api(method,endpoint,body){
 return new Promise((resolve,reject)=>{
  const request=http.request({socketPath:socket.slice(7),method,path:'/v'+version+endpoint,headers:{'Content-Type':'application/json'},timeout:45000},response=>{
   let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>response.statusCode<300?resolve(data?JSON.parse(data):null):reject(new Error(`Local Docker ${method} ${endpoint.split('?')[0]}: ${response.statusCode}`)));
  });request.on('timeout',()=>request.destroy(new Error('Local Docker timeout')));request.on('error',reject);request.end(body?JSON.stringify(body):undefined);
 });
}
const names=['db','storage','auth','rest','realtime','edge_runtime','kong','pg_meta','inbucket','studio'].map(service=>'supabase_'+service+'_'+project);
const specs=[];
for(const name of names){
 const spec=await api('GET','/containers/'+name+'/json');
 assert.deepEqual(Object.keys(spec.NetworkSettings.Networks),[network]);
 assert.ok(spec.State.Running,'All local services must be running before rehearsal');
 for(const bindings of Object.values(spec.NetworkSettings.Ports))for(const bind of bindings||[])assert.equal(bind.HostIp,'127.0.0.1');
 specs.push(spec);
}
await writeFile(path.join(output,'container-configs.private.json'),JSON.stringify(specs),{mode:0o600});
await writeFile(path.join(output,'config.private.toml'),localConfig,{mode:0o600});
let db;
async function connect(){db=new pg.Client({connectionString:config.DB_URL});await db.connect();}
await connect();
assert.ok((await db.query("select to_regclass('momentum_validation.applied') as marker")).rows[0].marker);
const jobs=(await db.query('select jobid,active from cron.job order by jobid')).rows;
const identifier=value=>'"'+value.replaceAll('"','""')+'"';
async function fingerprint(){
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','storage','vault','cron','momentum_validation') order by 1,2")).rows;
 const result=[];
 for(const {schemaname,tablename} of tables){
  // Cron execution history is runtime telemetry, not application state.
  if(schemaname==='cron'&&tablename==='job_run_details')continue;
  const value=(await db.query(`select count(*)::integer count,md5(coalesce(string_agg(row_json,E'\\n' order by row_json),'')) hash from (select to_jsonb(t)::text row_json from ${identifier(schemaname)}.${identifier(tablename)} t) s`)).rows[0];
  result.push({table:schemaname+'.'+tablename,...value});
 }
 const policies=(await db.query("select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private','auth','storage') order by 1,2,3")).rows;
 return {tables:result,policiesHash:createHash('sha256').update(JSON.stringify(policies)).digest('hex'),policies:policies.length};
}
const suffix='restore-'+Date.now(),replacements=[];
const proof={kind:'offline-local-supabase-recovery',startedAt:new Date().toISOString(),project,scope:'Representative local baseline; no hosted production data',services:names.length};
try{
 for(const job of jobs)await db.query('select cron.alter_job($1,active:=$2)',[job.jobid,false]);
 for(const name of names.filter(name=>name!==names[0]))await api('POST','/containers/'+name+'/stop?t=25');
 // Provider writers are now stopped. The scheduler remains disabled in the copy.
 const before=await fingerprint();
 const secretsBefore=(await db.query("select name,encode(extensions.digest(decrypted_secret,'sha256'),'hex') hash from vault.decrypted_secrets order by name")).rows;
 assert.ok(secretsBefore.length>=2,'The scheduler secrets must actually decrypt before backup');
 console.log('Provider writers stopped; database fingerprint recorded.');
 await writeFile(path.join(output,'before-fingerprint.json'),JSON.stringify(before,null,2),{mode:0o600});
 await db.end();db=null;
 await api('POST','/containers/'+names[0]+'/stop?t=30');
 for(const spec of specs.slice(0,2)){
  const name=spec.Name.slice(1),mount=spec.Mounts[0];
  assert.equal(spec.Mounts.length,1);assert.equal(mount.Type,'volume');
  assert.ok(mount.Name.startsWith(name),'Refuse unrelated volumes');
  const target=name+'-'+suffix,archive=name+'.tar',original=name+'-before-'+suffix;
  await run('volume','create',target);
  // Whole-cluster tar includes WAL and all Storage bytes. Neither source is writable.
  await run('run','--rm','--network','none','--entrypoint','/bin/sh','-v',mount.Name+':/source:ro','-v',output+':/backup',specs[0].Config.Image,'-ec','cd /source && tar -cpf /backup/'+archive+' .');
  await run('run','--rm','--network','none','--entrypoint','/bin/sh','-v',target+':/target','-v',output+':/backup:ro',specs[0].Config.Image,'-ec','cd /target && tar -xpf /backup/'+archive);
  const manifest=async volume=>run('run','--rm','--network','none','--entrypoint','/bin/sh','-v',volume+':/data:ro',specs[0].Config.Image,'-ec','cd /data && find . -type f -exec sha256sum {} + | LC_ALL=C sort');
  const sourceManifest=await manifest(mount.Name),targetManifest=await manifest(target);
  assert.equal(targetManifest,sourceManifest,'Every restored physical file must match');
  console.log('Physical backup and restored volume match: '+name);
  proof[name.includes('_db_')?'databaseVolume':'storageVolume']={files:sourceManifest.split('\n').filter(Boolean).length,manifestSha256:createHash('sha256').update(sourceManifest).digest('hex'),archiveSha256:createHash('sha256').update(await readFile(path.join(output,archive))).digest('hex')};
  const hostConfig=structuredClone(spec.HostConfig);
  hostConfig.Binds=hostConfig.Binds.map(bind=>bind.startsWith(mount.Name+':')?target+bind.slice(mount.Name.length):bind);
  hostConfig.NetworkMode=network;
  const container={...spec.Config,HostConfig:hostConfig,NetworkingConfig:{EndpointsConfig:{[network]:{Aliases:spec.NetworkSettings.Networks[network].Aliases}}}};
  await api('POST','/containers/'+name+'/rename?name='+original);
  replacements.push({name,original,target});
  await api('POST','/containers/create?name='+name,container);
  if(name===names[0]){
   // Supabase CLI stores the Vault root key outside PGDATA, in the writable layer.
   // Preserve it privately and inject it before first startup generates another key.
   const keyArchive=(await exec(docker,['cp','-a',original+':/etc/postgresql-custom/pgsodium_root.key','-'],{encoding:'buffer',timeout:10000})).stdout;
   await writeFile(path.join(output,'vault-key.private.tar'),keyArchive,{mode:0o600});
   await new Promise((resolve,reject)=>{
    const child=spawn(docker,['cp','-a','-',name+':/etc/postgresql-custom/'],{stdio:['pipe','ignore','ignore'],timeout:10000});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Vault root key copy failed')));child.stdin.end(keyArchive);
   });
  }
 }
 await api('POST','/containers/'+names[0]+'/start');
 let connected=false;
 for(let attempt=0;attempt<30;attempt++){try{await connect();connected=true;break;}catch{await delay(1000);}}
 assert.ok(connected,'Restored PostgreSQL must start');
 const after=await fingerprint();assert.deepEqual(after,before,'All restored rows and policies must match before starting writers');
 const secretsAfter=(await db.query("select name,encode(extensions.digest(decrypted_secret,'sha256'),'hex') hash from vault.decrypted_secrets order by name")).rows;
 assert.deepEqual(secretsAfter,secretsBefore,'Vault must decrypt the same secrets after restoration');
 proof.vaultSecretsRestored=true;
 console.log('Restored database rows and access policies match.');
 proof.tables=before.tables.length;proof.rows=before.tables.reduce((n,t)=>n+t.count,0);proof.policies=before.policies;proof.exactDatabaseFingerprint=true;
 for(const name of names.slice(1))await api('POST','/containers/'+name+'/start');
 let healthy=false;
 for(let attempt=0;attempt<40;attempt++){
  try{healthy=(await fetch(config.API_URL+'/auth/v1/health',{headers:{apikey:config.ANON_KEY},signal:AbortSignal.timeout(1500)})).ok;}catch{}
  if(healthy)break;await delay(1000);
 }assert.ok(healthy,'Restored Auth must answer');
 for(const name of names){
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
   const {State}=await api('GET','/containers/'+name+'/json');
   ready=State.Running&&(!State.Health||State.Health.Status==='healthy');
   if(ready)break;await delay(1000);
  }
  assert.ok(ready,'Restored service must be healthy: '+name);
 }
 console.log('All restored services are healthy; verifying sign-in, files and worker.');
 async function request(endpoint,actor,options={}){
  return fetch(config.API_URL+endpoint,{...options,headers:{apikey:config.ANON_KEY,...(actor?{Authorization:'Bearer '+actor.access_token}:{}),origin:'http://127.0.0.1:3000','Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
 }
 for(const key of ['A','B']){
  const actor=accounts[key];
  const response=await request('/auth/v1/token?grant_type=password',null,{method:'POST',body:JSON.stringify({email:actor.email,password:actor.password})});
  assert.equal(response.status,200,'Existing fictitious password must still work');
  accounts[key]={...actor,...await response.json()};assert.equal(accounts[key].user.id,actor.user.id);
 }
 proof.existingAccountsSignIn=2;
 const a=accounts.A,b=accounts.B;
 const rows=await (await request('/rest/v1/activities?user_id=eq.'+a.user.id,a)).json();assert.ok(rows.length>0);
 const denied=await (await request('/rest/v1/activities?user_id=eq.'+a.user.id,b)).json();assert.deepEqual(denied,[]);
 proof.privateRowsProtected=true;
 const memories=await (await request('/rest/v1/activity_flow_assessments?user_id=eq.'+a.user.id,a)).json();
 const memory=memories.find(row=>row.retained_memory==='Recette fictive : GPX de 80 minutes, sans effort déclaré.');
 const source=rows.find(row=>row.id===memory?.activity_id);assert.ok(source,'Browser-created memory must survive');
 const downloaded=await request('/storage/v1/object/authenticated/activities/'+source.source_file_url,a);
 assert.equal(downloaded.status,200);const bytes=new Uint8Array(await downloaded.arrayBuffer());
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'da9654b583e96f0e0e633605205b53e52833318d1908bea7a20301e57c97b00a');
 assert.ok((await request('/storage/v1/object/authenticated/activities/'+source.source_file_url,b)).status>=400);
 proof.browserSourceBytesPreserved=true;proof.foreignFileDenied=true;
 const workerSecret=localConfig.match(/MOMENTUM_CLEANUP_SECRET = "([a-f0-9]{64})"/)[1];
 const cleanup=await request('/functions/v1/storage-cleanup',null,{method:'POST',headers:{'x-cleanup-secret':workerSecret},body:'{}'});assert.equal(cleanup.status,200);
 const orphan=a.user.id+'/'+randomUUID()+'.gpx';
 const uploaded=await request('/storage/v1/object/activities/'+orphan,null,{method:'POST',headers:{Authorization:'Bearer '+config.SERVICE_ROLE_KEY,apikey:config.SERVICE_ROLE_KEY,'Content-Type':'application/gpx+xml'},body:bytes});
 assert.equal(uploaded.status,200,'Create a disposable worker probe');
 await db.query('select private.enqueue_storage_cleanup($1,$2,$3)',[a.user.id,'activities',orphan]);
 for(const job of jobs)await db.query('select cron.alter_job($1,active:=$2)',[job.jobid,job.active]);
 assert.deepEqual((await db.query('select jobid,active from cron.job order by jobid')).rows,jobs);
 console.log('Waiting for the restored scheduler to delete a new fictitious file.');
 const deadline=Date.now()+85000;
 while(Date.now()<deadline){
  if(!(await db.query('select 1 from storage.objects where bucket_id=$1 and name=$2',['activities',orphan])).rowCount)break;
  await delay(2000);
 }
 assert.equal((await db.query('select 1 from storage.objects where bucket_id=$1 and name=$2',['activities',orphan])).rowCount,0);
 assert.ok((await request('/storage/v1/object/authenticated/activities/'+orphan,a)).status>=400);
 proof.realWorkerResumed=true;
 proof.schedulerRestored=true;
 await writeFile(process.env.MOMENTUM_LOCAL_ACCOUNTS,JSON.stringify(accounts),{mode:0o600});
 proof.completedAt=new Date().toISOString();proof.status='passed';proof.originalsRetained=true;
 await writeFile(path.join(output,'result.json'),JSON.stringify(proof,null,2),{mode:0o600});
 console.log(JSON.stringify(proof,null,2));
}catch(error){
 // Revert the service mounts to the untouched original containers on any failure.
 if(db){await db.end().catch(()=>{});db=null;}
 for(const name of names)await api('POST','/containers/'+name+'/stop?t=20').catch(()=>{});
 for(const item of replacements.reverse()){
  await api('DELETE','/containers/'+item.name).catch(()=>{});
  await api('POST','/containers/'+item.original+'/rename?name='+item.name);
 }
 await api('POST','/containers/'+names[0]+'/start');
 await delay(3000);await connect();
 for(const job of jobs)await db.query('select cron.alter_job($1,active:=$2)',[job.jobid,job.active]);
 for(const name of names.slice(1))await api('POST','/containers/'+name+'/start');
 await writeFile(path.join(output,'result.json'),JSON.stringify({status:'failed',reason:error.message,originalsRestored:true}),{mode:0o600});
 throw error;
}finally{if(db)await db.end();}
