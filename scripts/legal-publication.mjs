import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Any change to the collection, providers, notices or server access rules needs a new review.
export function processingFingerprint(root) {
  const hash = createHash('sha256');
  const visit = (directory, prefix = '') => {
    for (const item of readdirSync(directory, { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name,'en'))) {
      const name = prefix + item.name;
      if (item.isDirectory() && /^(js|api|supabase|supabase\/functions|supabase\/migrations)(\/|$)/.test(name) && !item.name.startsWith('.')) visit(join(directory,item.name), name + '/');
      else if (item.isFile() && (/^[^/]+\.html$/.test(name) || /^(js|api|supabase\/functions|supabase\/migrations)\/.+\.(js|mjs|ts|sql)$/.test(name))) hash.update(name + '\0').update(readFileSync(join(directory,item.name))).update('\0');
    }
  };
  visit(root); return hash.digest('hex');
}

export function inspectLegal(root) {
  const failures = [];
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(root, 'legal/publication.json'), 'utf8')); }
  catch { return ['Legal publication manifest missing or invalid.']; }
  const proof = (items, label) => {
    if (!Array.isArray(items) || !items.length) { failures.push(`${label}: evidence required.`); return; }
    for (const item of items) if (typeof item !== 'string' || !/^docs\/legal\/[a-zA-Z0-9_./-]+$/.test(item) || item.includes('..') || item.includes('/private/') || item.endsWith('legal-facts.md') || !existsSync(join(root,item))) failures.push(`${label}: invalid evidence.`);
  };
  if (manifest.status !== 'approved') failures.push('Legal publication awaits operator decisions and legal review.');
  if (manifest.review?.source_sha256 !== processingFingerprint(root)) failures.push('Processing code changed or has not been reviewed; update the inventory, notices and evidence.');
  if (!manifest.review?.operator || !manifest.review?.legal || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.review?.reviewed_at || '')) failures.push('Operator and qualified legal review must be recorded.');
  for (let index = 1; index <= 10; index++) {
    const id = `L${String(index).padStart(2,'0')}`, fact = manifest.facts?.[id];
    if (fact?.status !== 'verified') failures.push(`${id}: decision unresolved.`);
    else proof(fact.evidence, id);
  }
  const required = { terms:'conditions.html', privacy:'confidentialite.html', identification:'mentions-legales.html', storage:'cookies.html', guest:'guest-notice.html' };
  for (const [kind, entrypoint] of Object.entries(required)) {
    const entries = (manifest.documents || []).filter(doc => doc.kind === kind);
    if (entries.length !== 1) { failures.push(`${kind}: one approved document required.`); continue; }
    const doc = entries[0];
    if (!/^[a-zA-Z0-9._-]{1,40}$/.test(doc.version || '') || !/^\d{4}-\d{2}-\d{2}$/.test(doc.effective_at || '') || !/^legal\/versions\/[a-zA-Z0-9._-]+\.html$/.test(doc.path || '') || !/^[a-f0-9]{64}$/.test(doc.sha256 || '')) { failures.push(`${kind}: invalid document metadata.`); continue; }
    try {
      const content = readFileSync(join(root,doc.path)), current = readFileSync(join(root,entrypoint));
      if (createHash('sha256').update(content).digest('hex') !== doc.sha256 || !content.equals(current)) failures.push(`${kind}: document, entrypoint and hash must agree.`);
      if (/à confirmer|\bTODO\b|\[À |version[^<\n]*projet|informations juridiques sont temporairement indisponibles/i.test(content.toString('utf8'))) failures.push(`${kind}: unresolved public text.`);
    } catch { failures.push(`${kind}: document missing.`); }
  }
  for (let index = 1; index <= 14; index++) {
    const id = `LEG-${String(index).padStart(2,'0')}`, rows = (manifest.scenarios || []).filter(row => row.id === id), scenario = rows[0];
    if (rows.length !== 1 || !['passed','not-applicable'].includes(scenario?.result)) failures.push(`${id}: acceptance incomplete.`);
    else { proof(scenario.evidence,id); if (scenario.result === 'not-applicable' && !scenario.reason) failures.push(`${id}: disabled feature and reason required.`); }
  }
  return failures;
}
