import {createAccountDeletionHandler} from './handler.mjs';
const productionOrigin='https://momentum-alpha-rho.vercel.app';
const allowedOrigins=[...(Deno.env.get('MOMENTUM_ALLOWED_ORIGINS')||'').split(','),productionOrigin,'capacitor://localhost'].map(value=>value.trim()).filter(Boolean);
Deno.serve(createAccountDeletionHandler({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),allowLocal:Deno.env.get('MOMENTUM_LOCAL_DEVELOPMENT')==='true',allowedOrigins}));
