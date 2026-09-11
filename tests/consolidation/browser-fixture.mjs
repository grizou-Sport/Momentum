// Fixture locale pour la recette navigateur. Identités et données fictives, aucune requête vers la production.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const port=8877, origin=`http://127.0.0.1:${port}`,A='11111111-1111-4111-8111-111111111111';
const db=new PGlite();
const read=name=>readFile(path.join(root,name),'utf8');
await db.exec(await read('tests/consolidation/baseline.sql'));
const schema=JSON.parse(await read('specs/cdc/2026-09-08.schema-before.json')).tables;
const category=schema.find(table=>table.table_name==='equipment_categories');
await db.exec('create table if not exists public.equipment_categories ('+category.columns.map(c=>'"'+c.name+'" '+c.type+(c.default?' default '+c.default:'')).join(',')+'); grant select on public.equipment_categories to authenticated;');
const dates=new Map(schema.map(table=>[table.table_name,table.columns.filter(c=>c.type==='date').map(c=>c.name)]));
await db.exec(await read('supabase/migrations/20260905100319_activity_nutrition_v1.sql'));
await db.exec(`insert into auth.users values ('${A}');`);
for(const name of ['20260911184622_cdc_personal_moment_foundation','20260911185216_cdc_nutrition_phases','20260911185612_cdc_daily_observations','20260911190711_cdc_minimal_onboarding','20260911191134_cdc_account_export','20260911192153_cdc_personal_story','20260911192914_cdc_shared_moment_privacy','20260911194108_cdc_guest_invitations','20260911194959_cdc_export_guest_responses','20260911195144_cdc_shared_profile_privacy']){ if(name==='20260911192914_cdc_shared_moment_privacy')await db.exec(await read('tests/consolidation/sharing-policies.sql')); await db.exec(await read(`supabase/migrations/${name}.sql`)); }
await db.query('insert into private.guest_allowed_origins(origin) values ($1)',[origin]);
const demoMoment={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',title:'Randonnée fictive',start_at:new Date(Date.now()+7*86400000).toISOString(),location_name:'Adresse privée fictive',moment_date_options:[]};
await db.query("insert into public.moments(id,user_id,created_by,title,status,start_at,location_name,capacity) values ($1,$2,$2,$3,'CONFIRMED',$4,$5,2)",[demoMoment.id,A,demoMoment.title,demoMoment.start_at,demoMoment.location_name]);
await db.exec(`insert into public.profiles(id,display_name) values ('${A}','Camille');
insert into public.sports(id,name) values ('33333333-3333-4333-8333-333333333333','running'),('44444444-4444-4444-8444-444444444444','hiking');
insert into public.activities(user_id,activity_date,status,sport,activity_type,duration_min,is_memorable,notes) select '${A}', date '2026-09-01'-n,'done','hiking','hiking',60,n=0,'Note privée fictive' from generate_series(0,11) n;`);
if(process.argv.includes('--returning'))await db.query("insert into public.passports(user_id,display_name,personalization) values ($1,'Camille',$2)",[A,JSON.stringify({minimal_onboarding_version:1,open_intention:'Retrouver les sentiers, sans objectif de temps.'})]);
const user={id:A,aud:'authenticated',role:'authenticated',email:'camille@example.test',email_confirmed_at:'2026-09-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:'2026-09-01T00:00:00Z'};
const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:A,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})).toString('base64url')+'.local-fixture-signature';
function reply(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
const id=value=>{if(!/^[a-z_][a-z_0-9]*$/.test(value))throw new Error('Identifiant interdit');return '"'+value+'"';};
let queue=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,origin);let body='';for await(const chunk of req){body+=chunk;if(body.length>6000000){reply(res,413,{message:'Trop volumineux'});return;}}
 try{
  if(url.pathname==='/js/supabase.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`window.MomentumConfig=Object.freeze({url:${JSON.stringify(origin)},publishableKey:'fixture-public-key'});if(window.supabase)window.momentumDB=window.supabase.createClient(${JSON.stringify(origin)},'fixture-public-key');`);return;}
  if(url.pathname==='/fixture-shared.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recette fictive des invitations</title><link rel="stylesheet" href="css/style.css"><link rel="stylesheet" href="css/consolidation.css"><body><main style="padding:32px"><h1>Moment fictif · Recette locale</h1><p>Aucun invité réel. Le compte Camille doit être connecté dans cet onglet.</p><button id="openGuest">Organiser les invitations fictives</button></main><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script><script src="js/supabase.js"></script><script src="js/momentum-ui.js"></script><script src="js/momentum-guest-manager.js"></script><script src="/fixture-shared.js"></script></body></html>');return;}
  if(url.pathname==='/fixture-shared.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`document.getElementById('openGuest').addEventListener('click',()=>window.MomentumGuests.open(${JSON.stringify(demoMoment)}));`);return;}
  if(url.pathname==='/auth/v1/token'){reply(res,200,{access_token:jwt,refresh_token:'local-fixture-refresh',expires_in:86400,token_type:'bearer',user});return;}
  if(url.pathname==='/auth/v1/user'){reply(res,200,user);return;}
  if(url.pathname==='/auth/v1/logout'){reply(res,200,{});return;}
  if(url.pathname.startsWith('/rest/v1/')){
   const guestRPC=['exchange_guest_invitation','read_guest_invitation','respond_guest_invitation'].some(name=>url.pathname==='/rest/v1/rpc/'+name);
   if(!guestRPC&&!req.headers.authorization?.endsWith('.local-fixture-signature')){reply(res,401,{message:'Session de test requise'});return;}
   const job=async()=>db.transaction(async tx=>{
    await tx.exec(guestRPC?'set local role anon':'set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[guestRPC?'':A]);await tx.query("select set_config('request.headers',$1,true)",[JSON.stringify({origin:req.headers.origin||origin,'x-forwarded-for':'192.0.2.10'})]);
    if(url.pathname.startsWith('/rest/v1/rpc/')){
     const name=url.pathname.split('/').pop(),params=body?JSON.parse(body):{};
     const args=Object.entries(params),result=await tx.query(`select public.${id(name)}(${args.map(([key],i)=>id(key)+'=> $'+(i+1)).join(',')}) result`,args.map(([,value])=>value!==null&&typeof value==='object'?JSON.stringify(value):value));
     return {value:result.rows[0]?.result??null};
    }
    if(req.method!=='GET')throw new Error('La fixture de recette n’autorise ici que les RPC transactionnelles.');
    const name=url.pathname.split('/').pop(),params=[],where=[];let order=[];
    for(const [key,value] of url.searchParams){
     if(['select','order','limit','offset'].includes(key))continue;
     const dot=value.indexOf('.'),operator=value.slice(0,dot),operand=value.slice(dot+1);
     if(['eq','neq','gte','lte','gt','lt'].includes(operator)){params.push(operand);where.push(`${id(key)} ${{eq:'=',neq:'<>',gte:'>=',lte:'<=',gt:'>',lt:'<'}[operator]} $${params.length}`);}
     else if(operator==='is'&&operand==='null')where.push(`${id(key)} is null`);
     else throw new Error('Filtre de fixture non pris en charge : '+operator);
    }
    for(const segment of (url.searchParams.get('order')||'').split(',').filter(Boolean)){const [column,direction]=segment.split('.');order.push(id(column)+(direction==='desc'?' desc':' asc'));}
    const filtered=`from public.${id(name)}${where.length?' where '+where.join(' and '):''}`;
    const count=Number((await tx.query('select count(*) as total '+filtered,params)).rows[0].total);
    const offset=Number(url.searchParams.get('offset')||0),limit=Math.min(1000,Number(url.searchParams.get('limit')||1000));
    if(!Number.isInteger(offset)||!Number.isInteger(limit)||offset<0||limit<0)throw new Error('Page invalide');
    const rows=(await tx.query(`select * ${filtered}${order.length?' order by '+order.join(','):''} limit ${limit} offset ${offset}`,params)).rows;
    for(const row of rows)for(const field of dates.get(name)||[])if(row[field] instanceof Date)row[field]=row[field].toISOString().slice(0,10);
    if(name==='user_sports')for(const row of rows)row.sports=(await tx.query('select * from public.sports where id=$1',[row.sport_id])).rows[0]??null;
    if(name==='user_equipment')for(const row of rows)row.equipment_categories=(await tx.query('select * from public.equipment_categories where id=$1',[row.category_id])).rows[0]??null;
    const single=(req.headers.accept||'').includes('vnd.pgrst.object');
    if(single&&rows.length!==1)return {status:406,value:{code:'PGRST116',details:`The result contains ${rows.length} rows`,message:'JSON object requested, multiple (or no) rows returned'}};
    return {value:single?rows[0]:rows,headers:{'Content-Range':`${offset}-${offset+rows.length-1}/${count}`}};
   });
   const result=queue.then(job);queue=result.catch(()=>{});const out=await result;reply(res,out.status||200,out.value,out.headers);return;
  }
  const filename=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/login.html':url.pathname));
  if(!filename.startsWith(root+path.sep)||!['.html','.css','.js','.svg','.jpg','.png','.webp','.woff2'].includes(path.extname(filename))){reply(res,404,{});return;}
  let content=await readFile(filename);const ext=path.extname(filename);
  if(ext==='.html')content=Buffer.from(content.toString().replace('connect-src https://njcqcpyiiibudlalnzoa.supabase.co','connect-src '+origin).replace('</body>','<p style="position:fixed;top:0;right:0;z-index:20000;background:#fffbd4;color:#222;padding:4px;font:13px system-ui">Recette locale · Données fictives</p></body>'));
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'}[ext],'Cache-Control':'no-store'});res.end(content);
 }catch(error){reply(res,400,{code:error.code||'FIXTURE',message:error.message});}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Fixture fictive : ${origin}/login.html\n`));
