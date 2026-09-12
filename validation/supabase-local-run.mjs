// Full provider integration on a disposable local stack. No cloud project is linked.
import {mkdir,readFile,writeFile,cp,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const exec=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cli=process.env.SUPABASE_BIN||'supabase',docker=process.env.DOCKER_BIN||'docker';
const workdir=path.resolve(process.env.MOMENTUM_LOCAL_WORKDIR||path.join(root,'.supabase-local'));
const configPath=path.join(workdir,'supabase/config.toml'),statusPath=path.join(workdir,'status.json');
const env={...process.env,SUPABASE_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1'};
async function command(binary,args,options={}){return exec(binary,args,{cwd:root,env,maxBuffer:32*1024*1024,...options});}
const version=(await command(cli,['--version'])).stdout.trim();assert.equal(version,'2.117.0','Use the pinned Supabase CLI version');
const context=JSON.parse((await command(docker,['context','inspect'])).stdout)[0];
assert.ok(context.Endpoints.docker.Host.startsWith('unix://'),'Use a local Docker engine');
await mkdir(path.join(workdir,'supabase'),{recursive:true,mode:0o700});await chmod(workdir,0o700);
const existingConfig=existsSync(configPath)?await readFile(configPath,'utf8'):'';
if(existingConfig)assert.match(existingConfig,/^project_id = "momentum-cdc-validation"/m,'Refusing to replace another project');
const secret=existingConfig.match(/MOMENTUM_CLEANUP_SECRET = "([a-f0-9]{64})"/)?.[1]||randomBytes(32).toString('hex');
const config=`project_id = "momentum-cdc-validation"
[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = 54322
shadow_port = 54320
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = true
port = 54323
[local_smtp]
enabled = true
port = 54324
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["http://127.0.0.1:3000"]
[auth.email]
enable_confirmations = true
max_frequency = "1s"
[auth.rate_limit]
email_sent = 100
sign_in_sign_ups = 100
[storage]
enabled = true
file_size_limit = "50MiB"
[edge_runtime]
enabled = true
policy = "per_worker"
deno_version = 2
[analytics]
enabled = false
${await readFile(path.join(root,'supabase/config.toml'),'utf8')}
[edge_runtime.secrets]
MOMENTUM_LOCAL_DEVELOPMENT = "true"
MOMENTUM_ALLOWED_ORIGINS = "http://127.0.0.1:3000"
MOMENTUM_CLEANUP_SECRET = "${secret}"
`;
await writeFile(configPath,config,{mode:0o600});
await cp(path.join(root,'supabase/functions'),path.join(workdir,'supabase/functions'),{recursive:true,filter:source=>!path.basename(source).startsWith('.')});
try{await command(docker,['network','inspect','momentum-cdc-local']);}
catch{await command(docker,['network','create','-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','momentum-cdc-local']);}
const localEnv={...env,MOMENTUM_LOCAL_STATUS:statusPath,MOMENTUM_LOCAL_CONFIG:configPath};
let started=false;
try{
 console.log('Starting local Supabase '+version+' (initial image downloads can take several minutes).');
 // Never print the CLI status: it contains local service-role and signing credentials.
 try{
  const result=await command(cli,['start','--workdir',workdir,'--network-id','momentum-cdc-local']);
  await writeFile(path.join(workdir,'start.log'),result.stdout+'\n'+result.stderr,{mode:0o600});
 }catch(error){await writeFile(path.join(workdir,'start.log'),(error.stdout||'')+'\n'+(error.stderr||''),{mode:0o600});throw new Error('Local Supabase failed to start; inspect its private start.log.');}
 started=true;
 await command(process.env.PYTHON_BIN||'python3',[path.join(root,'validation/supabase-local-bind.py')],{env:{...env,DOCKER_BIN:docker}});
 console.log('Services started with loopback-only ports; waiting for provider health checks.');
 let status;
 for(let attempt=0;attempt<30;attempt++){
  try{status=JSON.parse((await command(cli,['status','--workdir',workdir,'-o','json'])).stdout);break;}
  catch{await new Promise(resolve=>setTimeout(resolve,1000));}
 }
 assert.ok(status,'Supabase containers must pass their health checks after port binding');
 assert.equal(status.API_URL,'http://127.0.0.1:54321');await writeFile(statusPath,JSON.stringify(status),{mode:0o600});
 // Retry transport readiness after the loopback-only container recreation.
 let ready=false;for(let i=0;i<30;i++){
  try{ready=(await fetch(status.API_URL+'/auth/v1/health',{headers:{apikey:status.ANON_KEY},signal:AbortSignal.timeout(2000)})).ok;}catch{}
  if(ready)break;await new Promise(resolve=>setTimeout(resolve,1000));
 }assert.ok(ready,'Local Auth must be healthy');
 console.log((await command(process.execPath,['validation/supabase-local-setup.mjs'],{env:localEnv})).stdout.trim());
 try{const result=await command(process.execPath,['--test','validation/supabase-local.test.mjs'],{env:localEnv});console.log(result.stdout.trim());}
 catch(error){console.error(error.stdout||'Local integration failed');throw new Error('Local integration tests failed');}
}finally{
 if(started&&process.argv.includes('--ci')){await command(cli,['stop','--workdir',workdir,'--no-backup']);console.log('Disposable CI stack removed.');}
}
