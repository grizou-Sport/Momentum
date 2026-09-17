import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

// Technical builds, production readiness and post-deployment proof are distinct gates.
export function inspectCDC(base, phase = 'complete') {
  const errors = [];
  const local = value => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Missing evidence path');
    const target = resolve(base, value);
    if (!target.startsWith(resolve(base) + sep)) throw new Error('Evidence must stay in the repository');
    return target;
  };
  const json = value => JSON.parse(readFileSync(local(value), 'utf8'));
  function evidence(item, label) {
    if (item?.status !== 'verified') errors.push(`${label}: ${item?.status || 'unverified'}`);
    if (!item?.evidence?.length) errors.push(`${label}: no evidence`);
    for (const file of item?.evidence || []) {
      try { if (!statSync(local(file)).isFile() || !readFileSync(local(file)).length) throw new Error(); }
      catch { errors.push(`${label}: missing or invalid evidence ${file}`); }
    }
  }
  try {
    if (!['release', 'complete'].includes(phase)) throw new Error('Unknown CDC validation phase');
    const manifest = json('specs/cdc/2026-09-08.delivery.json');
    const humanDeferral=manifest.humanValidationDeferral;
    let humanDeferred=false;
    if(humanDeferral){
      const valid=humanDeferral.scenario==='LIV-05'&&humanDeferral.status==='deferred-by-owner'&&humanDeferral.decision==='2026-09-12-human-tests-deferred'&&typeof humanDeferral.reason==='string'&&humanDeferral.reason.trim();
      if(!valid)errors.push('Invalid human-validation deferral.');
      else {evidence({...humanDeferral,status:'verified'},'Human-validation decision');humanDeferred=true;}
    }
    const expectedStatus = phase === 'release' ? ['ready-for-release', 'verified'] : ['verified'];
    if (!expectedStatus.includes(manifest.status)) errors.push(`CDC is ${manifest.status}, not ${expectedStatus.join(' or ')}.`);
    if (!manifest.requiredFiles?.length) errors.push('CDC file inventory is missing.');
    for (const file of manifest.requiredFiles || []) {
      if (!existsSync(local(file))) errors.push(`CDC file missing: ${file}`);
      else if (statSync(local(file)).isFile() && !readFileSync(local(file)).length) errors.push(`CDC file empty: ${file}`);
    }
    const requirements = manifest.requirements || [];
    if (requirements.length !== 33) errors.push('All 33 chapters are required.');
    for (let i = 1; i <= 33; i++) {
      const id = 'chapter-' + String(i).padStart(2, '0');
      const matches = requirements.filter(r => r.id === id);
      if (matches.length !== 1) errors.push(`${id}: must appear exactly once`);
      // Chapter 32 includes the publication report; preparation is checked separately before release.
      if(i===27 && phase==='release' && humanDeferred && matches[0]?.status!=='verified') {
        // Only 27.4/27.5 are deferred. Technical observability in 27.1–27.3 still needs proof.
        evidence(matches[0]?.technicalValidation,id+' technical requirements (27.1–27.3)');
      } else evidence(i === 32 && phase === 'release' ? manifest.preDeployment : matches[0], id);
    }
    const acceptance = json(manifest.acceptance);
    const specification = readFileSync(local(manifest.specification), 'utf8');
    if (createHash('sha256').update(specification).digest('hex') !== acceptance.sha256) errors.push('Acceptance references another specification revision.');
    const ids = [...specification.matchAll(/^\| ((?:ACC|UX|MOM|DAT|PER|SEC|LIV)-\d+) \|/gm)].map(m => m[1]);
    if (!ids.length || new Set(ids).size !== ids.length) errors.push('Specification scenario inventory is invalid.');
    for (const id of ids) {
      const matches = (acceptance.scenarios || []).filter(s => s.id === id);
      if (matches.length !== 1) { errors.push(`${id}: must appear exactly once`); continue; }
      const item = matches[0];
      if (id === 'LIV-06' && phase === 'release') continue;
      if(id==='LIV-05'&&phase==='release'&&humanDeferred&&item.result==='deferred'){
        evidence({...item,status:'verified'},id+' deferral');continue;
      }
      if (item.result === 'not-applicable' && item.reason?.trim() && item.evidence?.length) evidence({ ...item, status: 'verified' }, id);
      else {
        if (item.result !== 'passed') errors.push(`${id}: ${item.result}`);
        evidence({ ...item, status: item.result === 'passed' ? 'verified' : item.result }, id);
      }
    }
    if ((acceptance.scenarios || []).some(s => !ids.includes(s.id))) errors.push('Acceptance contains an unknown scenario.');
    if (phase === 'complete') {
      evidence(manifest.deployment, 'Published deployment');
      if (!/^[a-f0-9]{40}$/.test(manifest.deployment?.commit || '')) errors.push('Published commit is missing.');
      if (!/^https:\/\//.test(manifest.deployment?.url || '')) errors.push('Published URL is missing.');
    }
  } catch (error) { errors.push(error.message); }
  return [...new Set(errors)];
}
