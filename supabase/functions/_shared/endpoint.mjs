// Local HTTP requires an explicit server-side opt-in and one of the CLI endpoints.
// A request header or body can never enable this development setting.
const localOrigins=new Set(['http://kong:8000','http://api.supabase.internal:8000','http://127.0.0.1:54321','http://localhost:54321']);
export function supabaseEndpoint(value,{allowLocal=false}={}){
 const url=new URL(value);
 if(url.pathname!=='/'||url.username||url.password||url.search||url.hash||
   (url.protocol!=='https:'&&!(allowLocal===true&&localOrigins.has(url.origin)))){
  throw new Error('Supabase endpoint configuration invalid');
 }
 return url;
}
