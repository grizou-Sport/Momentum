import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { root } from './lib.mjs';

const source = join(root, 'dist');
const target = join(root, 'dist-native');
const version = JSON.parse(readFileSync(join(source, 'version.json'), 'utf8'));
if (!['production', 'local', 'preview', 'development'].includes(version.environment)) throw new Error('Build the web app before packaging iOS');
rmSync(target, { force: true, recursive: true });
cpSync(source, target, { recursive: true });
mkdirSync(join(target, 'js/vendor'), { recursive: true });
await build({ entryPoints: [join(root, 'mobile/entry.mjs')], bundle: true, format: 'iife', target: 'safari15', outfile: join(target, 'js/native.js') });
await build({ entryPoints: [join(root, 'mobile/supabase.mjs')], bundle: true, format: 'iife', target: 'safari15', outfile: join(target, 'js/vendor/supabase.js') });
cpSync(join(root, 'node_modules/leaflet/dist'), join(target, 'js/vendor/leaflet'), { recursive: true });
cpSync(join(root, 'node_modules/chart.js/dist/chart.umd.js'), join(target, 'js/vendor/chart.js'));
cpSync(join(root, 'mobile/native.css'), join(target, 'css/native.css'));
for (const name of readdirSync(target).filter(name => name.endsWith('.html'))) {
  const path = join(target, name);
  let html = readFileSync(path, 'utf8')
    .replace(/width=device-width,\s*initial-scale=1/g, 'width=device-width, initial-scale=1, viewport-fit=cover')
    .replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'js/vendor/supabase.js')
    .replace('https://cdn.jsdelivr.net/npm/chart.js', 'js/vendor/chart.js')
    .replaceAll('https://unpkg.com/leaflet@1.9.4/dist/', 'js/vendor/leaflet/');
  html = html.replace('</head>', '<link rel="stylesheet" href="css/native.css"><script src="js/native.js"></script></head>');
  writeFileSync(path, html);
}
const hashes = {};
function hashFiles(dir, prefix = '') {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name), name = prefix + item.name;
    if (item.isDirectory()) hashFiles(path, name + '/');
    else if (name !== 'version.json') hashes[name] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
}
hashFiles(target);
writeFileSync(join(target, 'version.json'), JSON.stringify({ ...version, platform: 'ios', files: hashes }, null, 2) + '\n');
console.log(`Packaged iOS assets (${version.environment}; accounts ${version.accountAccess ? 'enabled' : 'disabled'}).`);
