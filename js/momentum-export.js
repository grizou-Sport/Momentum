(function expose(root,factory) {
  const api=factory(root); if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MomentumExport=api;
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  function storagePath(bucket,reference,storageOrigin) {
    if(typeof reference!=='string'||!reference.trim())return null;
    let value=reference.trim();
    if(/^https?:\/\//i.test(value)){
      let url,origin;try{url=new URL(value);origin=new URL(storageOrigin).origin;}catch{return null;}
      if(url.origin!==origin||url.username||url.password)return null;
      // Validate before URL normalisation, which otherwise removes traversal segments.
      const prefix=value.match(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\//);
      if(!prefix||prefix[1]!==bucket)return null;
      value=value.slice(prefix[0].length).split(/[?#]/,1)[0];
    }
    if(!value||value.length>1024||/(^\/|\/\/|(^|\/)\.{1,2}(\/|$)|[\\%?#\u0000-\u001f\u007f])/.test(value))return null;
    return value;
  }
  function redact(value) {
    if(Array.isArray(value))return value.map(redact);
    if(!value||typeof value!=='object')return value;
    return Object.fromEntries(Object.entries(value).filter(([key])=>!['token','token_hash','secret','access_token','refresh_token','api_key','service_role_key','password','p_session','p_secret'].includes(key.toLowerCase())).map(([key,item])=>{
      if(typeof item==='string'&&/(?:^|_)(?:url|uri)$/.test(key)&&/^https?:\/\//i.test(item)){
        try{const url=new URL(item);url.search='';url.hash='';url.username='';url.password='';item=url.href;}catch{item=null;}
      }
      return [key,redact(item)];
    }));
  }
  async function collect(db,{onProgress=()=>{},withFiles=false,signal,storageOrigin=root?.MomentumConfig?.url}={}) {
    const check=()=>{if(signal?.aborted)throw new Error('Export annulé.');};
    check();
    const first=await db.rpc('begin_personal_export'); if(first.error)throw first.error;
    const manifest=first.data;
    if(!manifest?.export_id||!Number.isSafeInteger(manifest.total)||manifest.total<0)throw new Error('Manifeste d’export invalide.');
    const data=Object.create(null),counts=Object.create(null),seen=new Set();let cursor=0;
    do {
      check();const result=await db.rpc('read_personal_export',{p_export_id:manifest.export_id,p_after:cursor,p_limit:200});
      if(result.error)throw result.error;
      const page=result.data;
      if(!Array.isArray(page?.items)||page.total!==manifest.total)throw new Error('Page d’export incomplète.');
      for(const item of page.items){
        if(item.sequence!==cursor+1||seen.has(item.sequence)||typeof item.kind!=='string')throw new Error('Ordre d’export incohérent.');
        seen.add(item.sequence);cursor=item.sequence;(data[item.kind]??=[]).push(item.payload);counts[item.kind]=(counts[item.kind]||0)+1;
      }
      onProgress({loaded:cursor,total:manifest.total});
      if(page.next_cursor!==cursor||!page.items.length&&!page.done)throw new Error('Pagination interrompue.');
      if(page.done){if(cursor!==manifest.total)throw new Error('Export tronqué.');break;}
    }while(cursor<=manifest.total);
    if(!manifest.counts||Object.keys(counts).length!==Object.keys(manifest.counts).length)throw new Error('Compteurs d’export incohérents.');
    for(const [kind,count] of Object.entries(manifest.counts))if(counts[kind]!==count)throw new Error('Compteurs d’export incohérents.');
    const files=[];
    if(withFiles){
      const paths=new Map();
      const add=(bucket,reference)=>{
        if(reference==null||reference==='')return;
        const path=storagePath(bucket,reference,storageOrigin);
        if(!path)throw new Error('Une référence de fichier n’est pas reconnue. Exporte les données seules ou corrige ce fichier avant de réessayer.');
        paths.set(bucket+'/'+path,{bucket,path});
      };
      for(const a of data.activities||[]){add('activities',a.source_file_url);add('activities',a.gpx_url);}
      for(const m of data.activity_media||[])add('activity-media',m.file_path);
      for(const m of data.media_originals||[])add('activity-media',m.file_path);
      for(const m of data.moment_media||[])add('moment-media',m.file_path);
      for(const c of data.clubs||[])add('club-logos',c.logo_url);
      for(const p of data.passports||[])add('avatars',p.avatar_url);
      for(const item of [...(data.moments||[]),...(data.clubs||[])]){
        const reference=item.cover_image_url;if(!reference)continue;
        const candidates=/^https?:\/\//i.test(reference)
          ? ['activities','activity-media','moment-media','club-logos','avatars'].map(bucket=>({bucket,path:storagePath(bucket,reference,storageOrigin)})).filter(file=>file.path)
          : [...paths.values()].filter(file=>file.path===reference);
        if(candidates.length!==1)throw new Error('La couverture d’un Moment ou d’un club ne peut pas être récupérée. Exporte les données seules ou corrige sa référence.');
        add(candidates[0].bucket,candidates[0].path);
      }
      for(const file of paths.values()){
        check();const signed=await db.storage.from(file.bucket).createSignedUrl(file.path,3600);
        if(signed.error||!signed.data?.signedUrl)throw new Error('Un fichier n’est pas récupérable. Aucun export complet n’a été annoncé.');
        files.push({...file,url:signed.data.signedUrl,expires_at:new Date(Date.now()+3600000).toISOString()});
      }
    }
    check();
    return {schema:'momentum-personal-export',schema_version:1,generated_at:new Date().toISOString(),snapshot_at:manifest.created_at,timezone:manifest.timezone,
      units:{distance:'km',duration:'minutes; source durations in seconds',rpe:'1–10'},manifest:{status:'complete',counts,total:cursor,
        includes:withFiles?'Données structurées et liens temporaires des fichiers autorisés':'Données structurées et métadonnées des fichiers',
        exclusions:withFiles?['Contenus privés des autres participants','Secrets techniques']:['Contenu binaire des médias et fichiers source','Contenus privés des autres participants','Secrets techniques']},data:redact(data),files};
  }
  function download(result){
    if(result.manifest.status!=='complete')throw new Error('Export incomplet.');
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`momentum-donnees-${result.generated_at.slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return Object.freeze({collect,download,storagePath});
});
