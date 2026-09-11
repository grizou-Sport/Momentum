import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database-fixture.mjs';

test('SEC-19/20: scheduler configuration is restricted, idempotent and reads the rotated credential at execution',async t=>{
 const db=await fixture();t.after(()=>db.close());
 const configure=secret=>db.query('select public.configure_storage_cleanup($1,$2)', ['https://abcdefghijklmnopqrst.supabase.co',secret]);
 await assert.rejects(configure('a'.repeat(64)),e=>e.code==='42501');
 await db.exec('reset role; set role service_role');
 await configure('a'.repeat(64));await configure('b'.repeat(64));
 await db.query('select public.record_storage_cleanup_run(true)');
 await db.exec('reset role');
 const jobs=(await db.query('select * from cron.job')).rows;assert.equal(jobs.length,1);
 assert.doesNotMatch(jobs[0].command,/aaaaaa|bbbbbb/);
 await db.exec(jobs[0].command);
 const sent=(await db.query('select * from net.test_requests')).rows[0];
 assert.equal(sent.url,'https://abcdefghijklmnopqrst.supabase.co/functions/v1/storage-cleanup');
 assert.equal(sent.headers['x-cleanup-secret'],'b'.repeat(64));assert.equal(sent.timeout_milliseconds,60000);
 assert.ok((await db.query('select last_success_at from private.cleanup_runtime')).rows[0].last_success_at);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select * from vault.decrypted_secrets'),e=>e.code==='42501');
});
