// Serve application sources against actual local Supabase. No API simulation.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {layoutFrame} from './layout-frame.mjs';
const root=path.resolve(process.env.MOMENTUM_LOCAL_SOURCE_ROOT||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
const config=JSON.parse(await readFile(process.env.MOMENTUM_LOCAL_STATUS,'utf8'));
assert.equal(config.API_URL,'http://127.0.0.1:54321');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:3000');
  if(url.pathname==='/__validation/layout.html'){
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(layoutFrame(url));return;
  }
  const name=decodeURIComponent(url.pathname==='/'?'/login.html':url.pathname);
  if(name==='/js/supabase.js'){
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
   // Preserve the actual client's options, including their absence in a legacy checkout.
   // Only the endpoint and anonymous public key are replaced; no privileged credential.
   let source=await readFile(path.join(root,'js/supabase.js'),'utf8');
   for(const [name,value] of [['SUPABASE_URL',config.API_URL],['SUPABASE_ANON_KEY',config.ANON_KEY]]){
    const declaration=new RegExp('const '+name+' = "[^"\\n]+";');
    assert.ok(declaration.test(source),'Known Supabase source configuration required');
    source=source.replace(declaration,'const '+name+' = '+JSON.stringify(value)+';');
   }
   res.end(source);return;
  }
  const filename=path.resolve(root,'.'+name),ext=path.extname(filename);
  if(!filename.startsWith(root+path.sep)||!types[ext]||!/^\/(?:[^/]+\.(?:html|js)|(?:js|css|Assets)\/[^?]+)$/.test(name))throw new Error('Not found');
  let content=await readFile(filename);
  if(ext==='.html')content=Buffer.from(content.toString().replace('connect-src https://njcqcpyiiibudlalnzoa.supabase.co','connect-src '+config.API_URL).replace('</body>','<p style="position:fixed;top:0;right:0;z-index:20000;background:#fffbd4;color:#222;padding:4px;font:13px system-ui;pointer-events:none">Recette Docker · Comptes fictifs</p></body>'));
  res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(3000,'127.0.0.1',()=>console.log('MOMENTUM local: http://127.0.0.1:3000/login.html'));
