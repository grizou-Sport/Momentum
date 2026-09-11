import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { root, files, localPath } from './lib.mjs';

const output = join(root, 'dist');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
const entries = files(root).filter(path => {
  const relative = localPath(path);
  return !relative.split('/').some(part => part.startsWith('.')) && (/^[^/]+\.(html|js)$/.test(relative) || /^(js|css|Assets)\//.test(relative));
});
const commit = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const checksums = {};
for (const source of entries) {
  const path = localPath(source);
  const target = join(output, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  checksums[path] = createHash('sha256').update(readFileSync(source)).digest('hex');
}
writeFileSync(join(output, 'version.json'), JSON.stringify({ commit, files: checksums }, null, 2) + '\n');
console.log(`Built ${entries.length} static files from ${commit}. API functions remain in api/.`);
