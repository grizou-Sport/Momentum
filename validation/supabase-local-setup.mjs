// Disposable LOCAL Supabase only. Provider schemas are never replaced by fixture adapters.
// The pre-CDC application schema is representative, not an exact production restore.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const config=JSON.parse(await readFile(process.env.MOMENTUM_LOCAL_STATUS,'utf8'));
const connection=new URL(config.DB_URL);
assert.equal(connection.hostname,'127.0.0.1');assert.equal(connection.port,'54322');
assert.equal(config.API_URL,'http://127.0.0.1:54321');
const db=new pg.Client({connectionString:connection.href});await db.connect();
try {
 const provider=(await db.query("select to_regclass('auth.identities') is not null and to_regclass('storage.buckets') is not null as real_services")).rows[0];
 assert.equal(provider.real_services,true,'A full local Supabase stack is required');
 const initialized=(await db.query("select to_regclass('momentum_validation.applied') as marker,to_regclass('public.activities') as activities")).rows[0];
 assert.ok(initialized.marker||!initialized.activities,'Refusing to modify an existing application database');
 await db.query('create schema if not exists momentum_validation; create table if not exists momentum_validation.applied(name text primary key,applied_at timestamptz default now())');
 async function step(name,sql){
  if((await db.query('select 1 from momentum_validation.applied where name=$1',[name])).rowCount)return;
  try {
   await db.query('begin');await db.query(sql);await db.query('insert into momentum_validation.applied(name) values($1)',[name]);await db.query('commit');console.log('Applied '+name);
  }catch(error){await db.query('rollback');throw new Error(name+': '+error.message,{cause:error});}
 }
 let baseline=await read('../tests/consolidation/baseline.sql');
 baseline='create schema private;\n'+baseline.slice(baseline.indexOf('create function public.set_updated_at()'),baseline.indexOf('-- Storage metadata only;'));
 // Historical migrations below supply the real sharing policies; generic fixture policies
 // must not be combined with those policies (permissive RLS policies are OR-ed).
 const historicalTables=['profiles','user_settings','user_goals','user_sport_preferences','user_locations','user_load_estimates','onboarding_progress','activity_flow_assessments','activity_media','circle_preferences','club_member_preferences','club_members','moment_availability','moment_media','moment_participants','moments','reactions'];
 for(const table of historicalTables)baseline=baseline.replace(new RegExp('^create policy own_rows on public\\.'+table+'[^\\n]+\\n','gm'),'');
 baseline+='\nalter table public.equipment_categories add primary key(id);\nalter table public.wellbeing_profile add unique(user_id);\nalter table public.activity_flow_assessments add column perceived_exertion smallint;';
 await step('representative-baseline',baseline);
 await step('legacy-global-collections',`create table public.collections(id uuid primary key default gen_random_uuid(),name text not null,description text,emoji text,category text,order_index integer default 0,created_at timestamptz default now());alter table public.collections enable row level security;grant select on public.collections to authenticated;create policy local_catalogue_read on public.collections for select to authenticated using(true);`);
 const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort();
 for(const name of files.filter(f=>f<'20260911')){
  if((await db.query('select 1 from momentum_validation.applied where name=$1',[name])).rowCount)continue;
  let sql=await read('../supabase/migrations/'+name);
  // CREATE TABLE IF NOT EXISTS does not add constraints to representative tables.
  // Ask PostgreSQL to parse each historical table declaration, then restore its
  // missing constraints on the empty baseline before running the migration.
  for(const declaration of sql.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/gi)){
   const table=declaration[1];
   if(!(await db.query('select to_regclass($1) as relation',['public.'+table])).rows[0].relation){
    // A later table in the same migration can reference this new catalogue.
    await db.query(declaration[0]);continue;
   }
   await db.query(`create table momentum_validation.${table} (${declaration[2]}\n)`);
   try {
    const constraints=(await db.query("select conname,contype,pg_get_constraintdef(oid) definition from pg_constraint where conrelid=$1::regclass and contype<>'p'",['momentum_validation.'+table])).rows;
    for(const constraint of constraints){
     if(!(await db.query('select 1 from pg_constraint where conrelid=$1::regclass and (conname=$2 or pg_get_constraintdef(oid)=$3)',['public.'+table,constraint.conname,constraint.definition])).rowCount){
      await db.query(`alter table public.${table} add constraint "${constraint.conname}" ${constraint.definition}`);
     }
    }
   }finally{await db.query(`drop table momentum_validation.${table}`);}
  }
  if(name==='20260713054558_auth_avatar_security_hardening.sql'&&!(await db.query("select to_regprocedure('public.rls_auto_enable()') as fn")).rows[0].fn){
   // Hosted auto-RLS event helper does not exist in the local provider. All application
   // RLS declarations still run; the absence is recorded as a baseline limitation.
   sql=sql.replace('revoke execute on function public.rls_auto_enable() from public, anon, authenticated;','');
  }
  await step(name,sql);
 }
 for(const name of ['shared-constraints-before.json','foreign-keys-before.json'])for(const constraint of JSON.parse(await read('../tests/consolidation/'+name))){
  assert.match(constraint.table_name,/^[a-z_]+$/);assert.match(constraint.conname,/^[a-z_]+$/);
  if(!(await db.query('select 1 from pg_constraint where conname=$1 and conrelid=$2::regclass',[constraint.conname,'public.'+constraint.table_name])).rowCount){
   await db.query(`alter table public."${constraint.table_name}" add constraint "${constraint.conname}" ${constraint.definition}`);
  }
 }
 // The initial legacy buckets predate the checked-in migration history. Fictitious
 // configuration and folder-owner policies are explicit; they do not claim parity.
 await step('legacy-local-storage',`
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
   ('activities','activities',false,52428800,null),('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']);
  create policy local_legacy_source_files on storage.objects for all to authenticated
   using(bucket_id='activities' and (storage.foldername(name))[1]=auth.uid()::text)
   with check(bucket_id='activities' and (storage.foldername(name))[1]=auth.uid()::text);
  create policy local_legacy_avatar_insert on storage.objects for insert to authenticated
   with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  create policy local_legacy_avatar_select on storage.objects for select to authenticated
   using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
  create policy local_legacy_avatar_delete on storage.objects for delete to authenticated
   using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
 `);
 for(const name of files.filter(f=>f>='20260911'))await step(name,await read('../supabase/migrations/'+name));
 // Synthetic approved texts exist ONLY in the explicitly isolated local stack.
 await step('local-legal-fixtures', `
  insert into private.legal_documents(kind,version,content,public_path,effective_at,approved_at)
  select kind,'fixture-1','FICTITIOUS LOCAL TEST '||kind,'legal/versions/'||kind||'-fixture-1.html',now()-interval '1 day',now()
  from unnest(array['terms','privacy','guest']) kind;
  insert into private.legal_release(singleton,terms_version,privacy_version,guest_version,enabled) values(true,'fixture-1','fixture-1','fixture-1',true);
 `);
 await step('local-storage-origin', "insert into private.storage_origins(origin) values('http://127.0.0.1:54321') on conflict do nothing");
 await step('local-guest-origin', "insert into private.guest_allowed_origins(origin) values('http://127.0.0.1:3000') on conflict do nothing");
 await db.query("notify pgrst, 'reload schema'");
 console.log('Local schema ready. Auth, Storage, Vault, pg_cron and pg_net are real provider services.');
}finally{await db.end();}
