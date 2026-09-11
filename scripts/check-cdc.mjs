import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, readJSON, files } from './lib.mjs';

const manifest = readJSON('specs/cdc/2026-09-08.delivery.json');
const errors = [];
if (manifest.status !== 'verified') errors.push(`CDC is ${manifest.status}, not verified.`);
if (!manifest.requirements?.length) errors.push('CDC requirements are missing.');
for (const path of manifest.requiredFiles) {
  const target = join(root, path);
  if (!existsSync(target)) errors.push(`CDC file missing: ${path}`);
  else if (statSync(target).isFile() && !readFileSync(target).length) errors.push(`CDC file empty: ${path}`);
}
const testDir = join(root, 'tests/consolidation');
if (!existsSync(testDir) || !statSync(testDir).isDirectory() || !files(testDir).some(path => /\.test\.(cjs|mjs|js)$/.test(path))) errors.push('CDC test suites are missing or empty.');
for (const item of manifest.requirements || []) {
  if (item.status !== 'verified') errors.push(`${item.id}: ${item.status}`);
  if (!item.evidence?.length) errors.push(`${item.id}: no evidence`);
  for (const path of item.evidence || []) if (!existsSync(join(root, path))) errors.push(`${item.id}: missing evidence ${path}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('CDC delivery manifest verified. Run npm run verify on this same commit.');
