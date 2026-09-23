import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const readJSON = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
export function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules', 'dist', 'dist-native', 'ios', 'build', '.supabase-local', '.browser-evidence', 'test-results', 'playwright-report'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic link is not a source file: ${path}`);
    return entry.isDirectory() ? files(path) : [path];
  }).sort();
}
export const localPath = path => relative(root, path).split(sep).join('/');
