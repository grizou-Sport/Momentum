import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseEndpoint} from '../../supabase/functions/_shared/endpoint.mjs';
test('Local provider HTTP requires explicit server configuration and an exact allowed origin',()=>{
 assert.equal(supabaseEndpoint('https://project.supabase.co').protocol,'https:');
 for(const endpoint of ['http://kong:8000','http://127.0.0.1:54321','http://localhost:54321']){
  assert.throws(()=>supabaseEndpoint(endpoint));
  assert.throws(()=>supabaseEndpoint(endpoint,{allowLocal:'true'}));
  assert.equal(supabaseEndpoint(endpoint,{allowLocal:true}).origin,endpoint);
 }
 for(const endpoint of ['http://example.com','http://kong:8001','http://kong:8000.evil.example','https://name:secret@project.supabase.co','https://project.supabase.co/rest','https://project.supabase.co?key=x','https://project.supabase.co#key','file:///etc/passwd']){
  assert.throws(()=>supabaseEndpoint(endpoint,{allowLocal:true}),endpoint);
 }
});
