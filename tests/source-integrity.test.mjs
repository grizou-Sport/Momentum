import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inspectSource } from '../scripts/check.mjs';
import { root } from '../scripts/lib.mjs';

const empty = () => ({ requiredFiles: [], requiredTests: [], migrations: {} });
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'momentum-integrity-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function write(dir, path, body) {
  const pieces = path.split('/'); pieces.pop();
  mkdirSync(join(dir, ...pieces), { recursive: true });
  writeFileSync(join(dir, path), body);
}

test('missing scripts and styles block a delivery, including references with cache parameters', t => {
  const dir = fixture(t);
  write(dir, 'index.html', '<script src="js/missing.js?v=1"></script><link href="css/missing.css" rel="stylesheet">');
  const failures = inspectSource(dir, empty());
  assert.equal(failures.length, 2);
  assert.match(failures.join('\n'), /in index\.html:/);
  assert.match(failures.join('\n'), /missing\.js/);
  assert.match(failures.join('\n'), /missing\.css/);
});

test('existing local references and remote assets are accepted', t => {
  const dir = fixture(t);
  write(dir, 'index.html', '<a href="#today">Today</a><script src="js/app.js?v=1"></script><link href="https://example.com/style.css">');
  write(dir, 'js/app.js', 'void 0;');
  assert.deepEqual(inspectSource(dir, empty()), []);
});

test('a missing required suite cannot be treated as a successful empty test run', t => {
  const dir = fixture(t);
  for (const path of ['scripts/lib.mjs', 'scripts/test.mjs']) {
    write(dir, path, readFileSync(join(root, path)));
  }
  write(dir, 'quality/source-contract.json', JSON.stringify({ requiredTests: ['tests/cdc.test.cjs'] }));
  const result = spawnSync(process.execPath, ['scripts/test.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required test missing: tests\/cdc.test.cjs/);
});

test('transfer packets fail verification instead of being executed to reconstruct source', t => {
  const dir = fixture(t);
  write(dir, 'maintenance/cdc-transfer/part-00.b64', 'truncated');
  write(dir, 'maintenance/cdc-finalize/site.tar.xz', 'corrupt');
  assert.equal(inspectSource(dir, empty()).filter(error => error.startsWith('Transfer archive forbidden')).length, 2);
});

test('changing or removing a historical migration is rejected', t => {
  const dir = fixture(t);
  const path = 'supabase/migrations/20260901000000_example.sql';
  const before = 'select 1;\n';
  const contract = { ...empty(), migrations: { [path]: createHash('sha256').update(before).digest('hex') } };
  write(dir, path, before);
  assert.deepEqual(inspectSource(dir, contract), []);
  write(dir, path, 'drop table important_data;\n');
  assert.match(inspectSource(dir, contract)[0], /Historical migration modified/);
  rmSync(join(dir, path));
  assert.match(inspectSource(dir, contract)[0], /Historical migration removed/);
});

test('empty required source files are rejected', t => {
  const dir = fixture(t);
  write(dir, 'js/app.js', '');
  assert.match(inspectSource(dir, { ...empty(), requiredFiles: ['js/app.js'] })[0], /Missing or empty/);
});

test('build copies the public application and excludes internal files and transfers', t => {
  const dir = fixture(t);
  for (const path of ['scripts/lib.mjs', 'scripts/build.mjs', 'scripts/build-environment.mjs', 'scripts/cdc-validation.mjs']) write(dir, path, readFileSync(join(root, path)));
  write(dir, 'index.html', '<h1>MOMENTUM</h1>');
  write(dir, 'js/app.js', 'void 0;');
  write(dir, 'Assets/image.svg', '<svg/>');
  write(dir, 'Assets/.DS_Store', 'metadata');
  write(dir, '.env', 'TEST_ONLY_NOT_A_SECRET=fixture');
  write(dir, 'docs/internal.md', 'Documentation');
  write(dir, 'recovery/index.html', 'Incomplete recovered page');
  write(dir, 'api/example.js', 'export default function handler() {}');
  const commit = 'a'.repeat(40);
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: dir, encoding: 'utf8', env: { ...process.env, VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_SHA: commit, MOMENTUM_TEST_SUPABASE_URL:'', MOMENTUM_TEST_SUPABASE_KEY:'' } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(dir, 'dist/index.html')), true);
  assert.equal(existsSync(join(dir, 'dist/js/app.js')), true);
  for (const path of ['Assets/.DS_Store', '.env', 'docs', 'recovery', 'api', 'scripts']) assert.equal(existsSync(join(dir, 'dist', path)), false, path);
  const version = JSON.parse(readFileSync(join(dir, 'dist/version.json')));
  assert.equal(version.commit, commit);
  assert.equal(version.files['index.html'], createHash('sha256').update('<h1>MOMENTUM</h1>').digest('hex'));
});

test('a green base test run does not certify an incomplete CDC', t => {
  const dir = fixture(t);
  for (const path of ['scripts/lib.mjs', 'scripts/check-cdc.mjs', 'scripts/cdc-validation.mjs']) write(dir, path, readFileSync(join(root, path)));
  write(dir, 'specs/cdc/2026-09-08.delivery.json', JSON.stringify({ status: 'recovery-incomplete', requiredFiles: ['js/momentum-training-load.js'], requirements: [{ id: 'chapter-15', status: 'unverified', evidence: [] }] }));
  const result = spawnSync(process.execPath, ['scripts/check-cdc.mjs'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CDC file missing/);
  assert.match(result.stderr, /chapter-15: unverified/);
});
