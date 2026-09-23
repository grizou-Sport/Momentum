import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { root, files, localPath } from './lib.mjs';
import { inspectCDC } from './cdc-validation.mjs';
import { inspectLegal } from './legal-publication.mjs';
import { buildEnvironment, browserConfiguration, disconnectedPreview, productionOrigin } from './build-environment.mjs';

const environment = buildEnvironment();
if (environment.target === 'production') {
  const failures = [...inspectCDC(root, 'release'), ...inspectLegal(root)];
  if (failures.length) throw new Error('Production release is not ready:\n' + failures.join('\n'));
}

const output = join(root, 'dist');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
const entries = files(root).filter(path => {
  const relative = localPath(path);
  return !relative.split('/').some(part => part.startsWith('.')) && (/^[^/]+\.(html|js)$/.test(relative) || /^(js|css|Assets)\//.test(relative) || /^legal\/versions\/[a-zA-Z0-9._-]+\.html$/.test(relative));
});
const commit = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const checksums = {};
for (const source of entries) {
  const path = localPath(source);
  const target = join(output, path);
  mkdirSync(dirname(target), { recursive: true });
  if (environment.target !== 'production' && path === 'js/supabase.js') writeFileSync(target, browserConfiguration(environment));
  else if (environment.target !== 'production' && path.endsWith('.html')) {
    let html = readFileSync(source, 'utf8');
    if (!environment.configured && /js\/supabase\.js/.test(html)) html = disconnectedPreview;
    else html = html.replaceAll(productionOrigin, environment.url || "'none'");
    writeFileSync(target, html);
  } else copyFileSync(source, target);
  checksums[path] = createHash('sha256').update(readFileSync(target)).digest('hex');
}
writeFileSync(join(output, 'version.json'), JSON.stringify({ commit, environment: environment.target, accountAccess: environment.configured, files: checksums }, null, 2) + '\n');
console.log(`Built ${entries.length} static files from ${commit}. API functions remain in api/.`);
