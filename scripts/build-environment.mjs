export const productionOrigin = 'https://njcqcpyiiibudlalnzoa.supabase.co';
export function buildEnvironment(env = process.env) {
  const target = env.VERCEL_ENV || env.MOMENTUM_BUILD_TARGET || 'local';
  if (!['production', 'preview', 'development', 'local'].includes(target)) throw new Error('Unknown build environment');
  if (env.VERCEL === '1' && !env.VERCEL_ENV) throw new Error('Vercel build environment must be explicit');
  if (target === 'production') return { target, configured: true };
  const url = env.MOMENTUM_TEST_SUPABASE_URL || '', key = env.MOMENTUM_TEST_SUPABASE_KEY || '';
  if (!url && !key) return { target, configured: false, url: '', key: '' };
  const endpoint = new URL(url);
  const local = target !== 'preview' && ['http://127.0.0.1:54321', 'http://localhost:54321'].includes(endpoint.origin);
  if ((!local && (endpoint.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(endpoint.hostname))) || endpoint.origin === productionOrigin || endpoint.href !== endpoint.origin + '/') throw new Error('A separate Supabase test project is required');
  let anonymous = /^sb_publishable_[\w-]+$/.test(key);
  if (!anonymous) { try { anonymous = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon'; } catch {} }
  if (!anonymous) throw new Error('Only a public Supabase key may enter a browser build');
  return { target, configured: true, url: endpoint.origin, key };
}
export function browserConfiguration(config) {
  return `window.MomentumConfig=Object.freeze(${JSON.stringify({url:config.url,publishableKey:config.key,environment:config.target})});\nif(window.supabase&&window.MomentumConfig.url)window.momentumDB=window.supabase.createClient(window.MomentumConfig.url,window.MomentumConfig.publishableKey,{global:{headers:{"x-momentum-client":"cdc-2026-09-08"}}});\n`;
}
export const disconnectedPreview = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Prévisualisation — MOMENTUM</title><link rel="icon" href="Assets/icons/favicon.svg"><link rel="stylesheet" href="css/style.css"></head><body><main style="max-width:42rem;margin:12vh auto;padding:1.5rem;font:1.1rem/1.6 system-ui"><p>MOMENTUM · Prévisualisation</p><h1>Un aperçu, sans connexion aux comptes.</h1><p>Les espaces personnels sont désactivés sur cette version de test. Aucune donnée de compte n’est consultée ou enregistrée.</p><p><a href="discover.html">Découvrir MOMENTUM et son exemple fictif</a></p></main></body></html>';
