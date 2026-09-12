import {createCleanupHandler} from './worker.mjs';
Deno.serve(createCleanupHandler({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),workerSecret:Deno.env.get('MOMENTUM_CLEANUP_SECRET'),allowLocal:Deno.env.get('MOMENTUM_LOCAL_DEVELOPMENT')==='true'}));
