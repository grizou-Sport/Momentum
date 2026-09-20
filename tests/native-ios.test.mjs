import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { authRedirect, locationsFetch, webOrigin } from '../mobile/runtime.mjs';
import { createFileIngestHandler } from '../supabase/functions/file-ingest/handler.mjs';
import { createAccountDeletionHandler } from '../supabase/functions/account-deletion/handler.mjs';
const require = createRequire(import.meta.url);
const { safeReturn } = require('../js/momentum-access.js');

test('iOS emails keep only the existing HTTPS auth destinations', () => {
  assert.equal(authRedirect('welcome.html'), webOrigin + '/welcome.html');
  assert.equal(authRedirect('login.html?recovery=1'), webOrigin + '/login.html?recovery=1');
  for (const path of ['https://attacker.test/welcome.html', '//attacker.test', 'javascript:alert(1)', 'com.chrisgyger.momentum://auth/welcome.html', 'welcome.html?redirect=bad']) {
    assert.throws(() => authRedirect(path));
  }
});

test('native return paths preserve internal tabs but reject another opaque origin', () => {
  assert.equal(safeReturn('you.html?section=passport', 'capacitor://localhost/'), 'you.html?section=passport');
  assert.equal(safeReturn('other://localhost/you.html', 'capacitor://localhost/'), 'index.html');
  assert.equal(safeReturn('capacitor://attacker/you.html', 'capacitor://localhost/'), 'index.html');
});

test('native location requests preserve server failure, query encoding, and cancellation', async () => {
  let request;
  const http = { get: async options => { request = options; return { status:503, data:{error:'unavailable'} }; } };
  const response = await locationsFetch(http, new URLSearchParams({text:'Bienne & lac'}));
  assert.equal(response.ok, false);
  assert.deepEqual(await response.json(), {error:'unavailable'});
  assert.equal(new URL(request.url).origin, webOrigin);
  assert.equal(new URL(request.url).searchParams.get('text'), 'Bienne & lac');
  const controller = new AbortController();controller.abort();
  assert.throws(() => locationsFetch(http, '', {signal:controller.signal}), {name:'AbortError'});
  const during = new AbortController();
  await assert.rejects(locationsFetch({get:async()=>{during.abort();return {status:200,data:[]};}}, '', {signal:during.signal}), {name:'AbortError'});
  await assert.rejects(locationsFetch({get:async()=>{throw new Error('offline');}}, ''), /offline/);
});

test('native edge requests allow only the configured origin and retain session checks', async () => {
  const url = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
  const origin = 'capacitor://localhost';
  for (const factory of [createFileIngestHandler, createAccountDeletionHandler]) {
    const calls = [];
    const handler = factory({
      url, serviceKey: 'test-private', publishableKey: 'test-public', allowedOrigins: [webOrigin, origin],
      validateContent: async () => { throw new Error('Must not process unauthenticated content'); },
      fetchImpl: async target => {
        const path = new URL(target).pathname;
        calls.push(path);
        assert.equal(path, '/rest/v1/rpc/account_deletion_status');
        return Response.json(null);
      }
    });
    const request = (requestOrigin, method = 'OPTIONS') => new Request(url, {
      method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify({
        action: 'begin', id: '11111111-1111-4111-8111-111111111111',
        receipt: 'a'.repeat(64), confirmation: 'SUPPRIMER', password: 'test-only'
      }) } : {})
    });
    for (const allowed of [origin, webOrigin]) {
      const response = await handler(request(allowed));
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowed);
    }
    for (const foreign of ['capacitor://foreign', 'http://localhost', 'null', 'https://foreign.test']) {
      const response = await handler(request(foreign));
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    }
    assert.equal(calls.length, 0);
    assert.equal((await handler(request(origin, 'POST'))).status, 401);
    assert.ok(calls.every(path => path === '/rest/v1/rpc/account_deletion_status'));
  }
});
