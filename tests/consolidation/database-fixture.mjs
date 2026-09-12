import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
export async function fixture({ database } = {}) {
  const db = database || new PGlite();
  try {
  await db.exec(await read('./baseline.sql'));
  await db.exec(await read('../../supabase/migrations/20260905100319_activity_nutrition_v1.sql'));
  await db.exec('alter table public.equipment_categories add primary key(id); create table public.preset_messages(id uuid primary key)');
  for(const constraint of JSON.parse(await read('./shared-constraints-before.json'))) {
    await db.exec('alter table public."'+constraint.table_name+'" add constraint "'+constraint.conname+'" '+constraint.definition);
  }
  await db.exec('create unique index one_selected_option_per_moment_idx on public.moment_date_options(moment_id) where is_selected');
  for(const fk of JSON.parse(await read('./foreign-keys-before.json'))) {
    const present=(await db.query('select 1 from pg_constraint where conname=$1 and conrelid=$2::regclass',[fk.conname,'public.'+fk.table_name])).rows.length;
    if(!present)await db.exec('alter table public."'+fk.table_name+'" add constraint "'+fk.conname+'" '+fk.definition);
  }
  await db.exec(`insert into auth.users values ('${A}'),('${B}');`);
  await db.exec(await read('../../supabase/migrations/20260911184622_cdc_personal_moment_foundation.sql'));
  await db.exec(await read('../../supabase/migrations/20260911185216_cdc_nutrition_phases.sql'));
  await db.exec(await read('../../supabase/migrations/20260911185612_cdc_daily_observations.sql'));
  await db.exec(await read('../../supabase/migrations/20260911190711_cdc_minimal_onboarding.sql'));
  await db.exec(await read('../../supabase/migrations/20260911191134_cdc_account_export.sql'));
  await db.exec(await read('../../supabase/migrations/20260911192153_cdc_personal_story.sql'));
  await db.exec(await read('./sharing-policies.sql'));
  await db.exec(await read('../../supabase/migrations/20260911192914_cdc_shared_moment_privacy.sql'));
  await db.exec(await read('../../supabase/migrations/20260911194108_cdc_guest_invitations.sql'));
  await db.exec(await read('../../supabase/migrations/20260911194959_cdc_export_guest_responses.sql'));
  await db.exec(await read('../../supabase/migrations/20260911195144_cdc_shared_profile_privacy.sql'));
  await db.exec(await read('../../supabase/migrations/20260911201444_cdc_storage_cleanup.sql'));
  // Provider extensions are adapters here; the remaining migration SQL runs unchanged.
  await db.exec(await read('./scheduler-adapters.sql'));
  await db.exec((await read('../../supabase/migrations/20260911202220_cdc_cleanup_schedule.sql')).replace(/^create extension[^;]+;$/gm,''));
  await db.exec(await read('../../supabase/migrations/20260911202513_cdc_account_deletion.sql'));
  await db.exec(await read('../../supabase/migrations/20260911205620_cdc_shared_moment_commands.sql'));
  await db.exec(await read('../../supabase/migrations/20260912083358_cdc_legacy_storage_references.sql'));
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({origin:'https://momentum-alpha-rho.vercel.app','x-forwarded-for':'192.0.2.10'})]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [A]);
  await db.exec('set role authenticated');
  return db;
  } catch(error) { await db.close(); throw error; }
}
