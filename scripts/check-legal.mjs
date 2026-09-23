import { root } from './lib.mjs';
import { inspectLegal } from './legal-publication.mjs';
const failures = inspectLegal(root);
if (failures.length) { console.error('Legal publication blocked:\n' + failures.join('\n')); process.exitCode = 1; }
else console.log('Legal publication evidence complete. Verify deployed bytes before activating the server release.');
