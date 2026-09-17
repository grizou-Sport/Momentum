import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root, files, readJSON, localPath } from './lib.mjs';

export function inspectSource(base, contract) {
  const errors = [];
  const all = files(base);
  for (const path of [...contract.requiredFiles, ...contract.requiredTests]) {
    if (!existsSync(join(base, path)) || !readFileSync(join(base, path)).length) errors.push(`Missing or empty: ${path}`);
  }
  for (const path of all) {
    const rel = path.slice(base.length).replace(/^[/\\]/, '');
    if (/^maintenance\/cdc-(transfer|finalize)\//.test(rel) || /\.b64$|\.tar\.(xz|gz)$/.test(rel)) errors.push(`Transfer archive forbidden: ${rel}`);
  }
  for (const [path, sha256] of Object.entries(contract.migrations)) {
    if (!existsSync(join(base, path))) errors.push(`Historical migration removed: ${path}`);
    else if (createHash('sha256').update(readFileSync(join(base, path))).digest('hex') !== sha256) errors.push(`Historical migration modified: ${path}`);
  }
  const validateReference = (path, reference) => {
    if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference) || reference.includes('${')) return;
    const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
    if (!clean) return;
    const target = clean.startsWith('/') ? join(base, clean) : resolve(dirname(path), clean);
    if (!existsSync(target)) errors.push(`Broken local reference in ${relative(base, path)}: ${reference}`);
  };
  for (const path of all.filter(path => /\.(html|css)$/.test(path) && !path.includes('/recovery/'))) {
    const source = readFileSync(path, 'utf8');
    const pattern = path.endsWith('.html') ? /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi : /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    for (const match of source.matchAll(pattern)) validateReference(path, match[1].trim());
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(root, 'scripts/check.mjs')) {
  const errors = inspectSource(root, readJSON('quality/source-contract.json'));
  const scripts = files(root).filter(path => /\.(?:js|mjs|cjs)$/.test(path) && !localPath(path).startsWith('recovery/'));
  for (const path of scripts) {
    const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    if (checked.status !== 0) errors.push(`${localPath(path)}: ${checked.stderr || checked.error || 'syntax check failed'}`);
  }
  for (const path of files(root).filter(path => path.endsWith('.html') && !localPath(path).startsWith('recovery/'))) {
    let index = 0;
    for (const match of readFileSync(path, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1]) || /\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/.test(match[1])) continue;
      index++;
      const checked = spawnSync(process.execPath, ['--check', '--input-type=' + (/\btype\s*=\s*["']module["']/.test(match[1]) ? 'module' : 'commonjs')], { input: match[2], encoding: 'utf8' });
      if (checked.status !== 0) errors.push(`${localPath(path)} inline script ${index}: ${checked.stderr}`);
    }
  }
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log(`Source integrity verified; ${scripts.length} JavaScript files checked.`);
}
