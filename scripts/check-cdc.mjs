import { root } from './lib.mjs';
import { inspectCDC } from './cdc-validation.mjs';
const phase = process.argv.includes('--release') ? 'release' : 'complete';
const errors = inspectCDC(root, phase);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(phase === 'release' ? 'CDC ready for a controlled production release; post-deployment checks remain mandatory.' : 'CDC and published deployment verified.');
