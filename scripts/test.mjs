import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, files, readJSON } from './lib.mjs';

const required = readJSON('quality/source-contract.json').requiredTests;
if (!required?.length) throw new Error('The required test inventory is empty.');
for (const path of required) {
  if (!existsSync(join(root, path))) throw new Error(`Required test missing: ${path}`);
}
const suites = files(join(root, 'tests')).filter(path => /\.test\.(?:mjs|cjs|js)$/.test(path));
if (!suites.length) throw new Error('No test suites found.');
const result = spawnSync(process.execPath, ['--test', ...suites], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
