import {createAccountDeletionHandler} from './handler.mjs';
Deno.serve(createAccountDeletionHandler({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),publishableKey:Deno.env.get('SUPABASE_ANON_KEY'),allowedOrigins:(Deno.env.get('MOMENTUM_ALLOWED_ORIGINS')||'https://momentum-alpha-rho.vercel.app').split(',').map(value=>value.trim()).filter(Boolean)}));
