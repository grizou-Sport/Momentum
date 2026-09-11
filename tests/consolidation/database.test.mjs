import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', OP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const moment = (changes = {}) => ({ id: ID, user_id: A, activity_date: '2026-07-01', status: 'done', activity_category: 'sport', activity_type: 'running', sport: 'running', duration_min: 60, rpe: null, ...changes });
const command = (db, payload, assessment = null, nutrition = null, operation = OP, revision = null) => db.query('select public.save_personal_moment($1,$2,$3,$4,$5) result', [operation, JSON.stringify(payload), assessment == null ? null : JSON.stringify(assessment), nutrition == null ? null : JSON.stringify(nutrition), revision]);
async function fixture() {
  const db = new PGlite();
  await db.exec(await read('./baseline.sql'));
  await db.exec(await read('../../supabase/migrations/20260905100319_activity_nutrition_v1.sql'));
  await db.exec(`insert into auth.users values ('${A}'),('${B}');`);
  await db.exec(await read('../../supabase/migrations/20260911184622_cdc_personal_moment_foundation.sql'));
  await db.exec(await read('../../supabase/migrations/20260911185216_cdc_nutrition_phases.sql'));
  await db.exec(await read('../../supabase/migrations/20260911185612_cdc_daily_observations.sql'));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [A]);
  await db.exec('set role authenticated');
  return db;
}

test('MOM-02/16/18, SEC-12: atomic save, replay and ownership run in PostgreSQL', async t => {
  const db = await fixture(); t.after(() => db.close());
  const payload = moment({ source_hash: 'a'.repeat(64) });
  const memory = { perceived_challenge: null, perceived_mastery: null, retained_memory: 'Le lac au lever du jour.' };
  const first = await command(db, payload, memory);
  assert.equal(first.rows[0].result.revision, 1);
  assert.deepEqual(await command(db, payload, memory), first);
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count, 1);
  const saved = (await db.query('select * from public.activity_flow_assessments')).rows[0];
  assert.equal(saved.perceived_challenge, null); assert.equal(saved.perceived_mastery, null); assert.equal(saved.retained_memory, memory.retained_memory);
  assert.equal((await db.query('select rpe from public.activities')).rows[0].rpe, null);
  await assert.rejects(command(db, { ...payload, duration_min: 70 }, memory), e => e.code === '40001');
  await assert.rejects(command(db, { ...payload, id: B }, null, null, B), e => e.code === '23505');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [B]);
  assert.equal((await db.query('select * from public.activities')).rows.length, 0);
  await assert.rejects(command(db, moment({ user_id: B }), null, null, B), e => e.code === '42501');
  await db.exec('reset role; set role anon');
  await assert.rejects(command(db, payload), e => e.code === '42501');
});

test('MOM-16: a failed experience rolls back the activity and receipt; retry can succeed', async t => {
  const db = await fixture(); t.after(() => db.close());
  await assert.rejects(command(db, moment(), { perceived_challenge: 11 }), e => e.code === '23514');
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count, 0);
  await command(db, moment(), { retained_memory: 'Souvenir seul' });
  assert.equal((await db.query('select count(*) from public.activities')).rows[0].count, 1);
});

test('PER-07/08/11/12: planned and consumed snapshots stay separate and stable', async t => {
  const db = await fixture(); t.after(() => db.close());
  const product = (await db.query("insert into public.nutrition_products(name,category,unit_label,created_by,carbohydrates_g,sodium_mg) values ('Produit fictif','gel','sachet',$1,25,null) returning id", [A])).rows[0].id;
  const first = await command(db, moment(), null, { planned: [{ product_id: product, quantity: 2 }] });
  assert.equal((await db.query("select count(*) from public.activity_nutrition_items where phase='consumed'")).rows[0].count, 0);
  await db.query('update public.nutrition_products set carbohydrates_g=50 where id=$1', [product]);
  const second = await command(db, moment(), null, { planned: [{ product_id: product, quantity: 3 }], consumed: [{ product_id: product, quantity: 1, copy_from_planned: true }] }, B, first.rows[0].result.revision);
  const items = (await db.query('select * from public.activity_nutrition_items order by phase')).rows;
  assert.equal(items.length, 2); assert.equal(items[0].quantity, '1'); assert.equal(items[1].quantity, '3');
  assert.equal(items[0].carbohydrates_g_snapshot, '25'); assert.equal(items[1].carbohydrates_g_snapshot, '25');
  assert.equal(items[0].sodium_mg_snapshot, null);
  await assert.rejects(command(db, moment(), null, null, A, first.rows[0].result.revision), e => e.code === '40001');
  assert.equal(second.rows[0].result.revision, 2);
});

test('DAT-22/23: explicit observation corrections retain source data and protect concurrent edits', async t => {
  const db = await fixture(); t.after(() => db.close());
  const input = ['2026-07-01', JSON.stringify({ sleep_hours: 7, motivation: 6, sleep_quality_value: 3 }), [], 'Je ne suis pas malade', null, 0];
  const call = values => db.query('select public.save_daily_observations($1,$2,$3,$4,$5,$6) result', values);
  const result = (await call(input)).rows[0].result;
  assert.equal(result.daily.raw_data.manual_corrections.sleep_hours, 7);
  assert.deepEqual(result.day.context_annotations, []);
  await assert.rejects(call(input), e => e.code === '40001');
  const cleared = (await call([input[0], '{"sleep_hours":null}', ['vacation'], input[3], result.daily.updated_at, result.day.revision])).rows[0].result;
  assert.equal(cleared.daily.raw_data.manual_corrections.sleep_hours, null);
  assert.equal(cleared.daily.raw_data.previous_corrections.length, 1);
  assert.equal(cleared.day.note, input[3]);
});
