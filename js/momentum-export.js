(function expose(root,factory) {
  const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MomentumExport=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  async function collect(db,{onProgress=()=>{},withFiles=false,signal}={}) {
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
      const add=(bucket,path)=>{if(path)paths.set(bucket+'/'+path,{bucket,path});};
      for(const a of data.activities||[]){add('activities',a.source_file_url);if(!a.source_file_url)add('activities',a.gpx_url);}
      for(const m of data.activity_media||[])add('activity-media',m.file_path);
      for(const m of data.moment_media||[])add('moment-media',m.file_path);
      for(const c of data.clubs||[])if(c.logo_url&&!/^https?:/i.test(c.logo_url))add('club-logos',c.logo_url);
      for(const file of paths.values()){
        check();const signed=await db.storage.from(file.bucket).createSignedUrl(file.path,3600);
        if(signed.error||!signed.data?.signedUrl)throw new Error('Un fichier n’est pas récupérable. Aucun export complet n’a été annoncé.');
        files.push({...file,url:signed.data.signedUrl,expires_at:new Date(Date.now()+3600000).toISOString()});
      }
      for(const p of data.passports||[])if(p.avatar_url)files.push({kind:'avatar',url:p.avatar_url,access:'existing-avatar-reference'});
    }
    check();
    return {schema:'momentum-personal-export',schema_version:1,generated_at:new Date().toISOString(),snapshot_at:manifest.created_at,timezone:manifest.timezone,
      units:{distance:'km',duration:'minutes; source durations in seconds',rpe:'1–10'},manifest:{status:'complete',counts,total:cursor,
        includes:withFiles?'Données structurées et liens temporaires des fichiers autorisés':'Données structurées et métadonnées des fichiers',
        exclusions:withFiles?['Contenus privés des autres participants','Secrets techniques']:['Contenu binaire des médias et fichiers source','Contenus privés des autres participants','Secrets techniques']},data,files};
  }
  function download(result){
    if(result.manifest.status!=='complete')throw new Error('Export incomplet.');
    const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`momentum-donnees-${result.generated_at.slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return Object.freeze({collect,download});
});
