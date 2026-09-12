(function exposeUploads(root) {
  'use strict';
  const operations=new WeakMap();
  function failure(message){const error=new Error(message);error.name='MomentumUploadError';error.userMessage=message;return error;}
  const errors={authentication_required:'Reconnecte-toi avant d’ajouter ce fichier.',upload_forbidden:'Ce fichier ne peut pas être ajouté à cet espace. Vérifie ton accès.',file_size:'Le fichier est vide ou dépasse la taille autorisée.',file_type:'Choisis un type de fichier autorisé.',invalid_image:'Cette image est abîmée ou ne correspond pas à son format.',image_dimensions:'Cette image est trop grande. Choisis une version de 12 mégapixels maximum.',animated_image:'Choisis une photo fixe plutôt qu’une image animée.',invalid_xml:'Le fichier XML est abîmé ou contient une déclaration non autorisée.',invalid_gpx:'Ce fichier GPX n’est pas reconnu.',invalid_gpx_coordinate:'Ce GPX contient des coordonnées non valides.',empty_gpx:'Ce GPX ne contient aucun point.',invalid_fit:'Ce fichier FIT est incomplet ou non reconnu.',invalid_fit_crc:'Le contrôle d’intégrité du FIT échoue. Récupère à nouveau le fichier original.',invalid_fit_record:'Le contenu de ce FIT est abîmé.',invalid_fit_definition:'La structure de ce FIT n’est pas valide.',unsafe_svg:'Ce logo SVG contient des éléments actifs ou externes. Exporte-le en PNG ou WebP.',invalid_svg:'Ce logo SVG n’est pas valide.',upload_in_progress:'La vérification du fichier est encore en cours. Réessaie dans quelques instants.',upload_retired:'Ce fichier a déjà été retiré. Réessaie pour créer un nouvel envoi.',upload_conflict:'L’envoi a changé. Réessaie avec le fichier choisi.'};
  const mimeExtensions={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp','image/svg+xml':'svg'};
  async function upload(file,{bucket,resource=null}={}) {
    if(!file||!root.momentumDB||!root.MomentumConfig?.url)throw failure('Le service de fichiers est indisponible pour le moment.');
    const {data,error}=await root.momentumDB.auth.getSession(),session=data?.session;
    if(error||!session?.access_token)throw failure(errors.authentication_required);
    const name=file.name||'',extension=name?name.toLowerCase().split('.').pop():mimeExtensions[file.type];
    if(!['fit','gpx','jpg','jpeg','png','webp','svg'].includes(extension))throw failure(errors.file_type);
    let entries=operations.get(file);if(!entries){entries=new Map();operations.set(file,entries);}
    const key=session.user.id+'/'+bucket+'/'+(resource||'');let operation=entries.get(key);
    if(!operation){operation=crypto.randomUUID();entries.set(key,operation);}
    let response;
    try{response=await fetch(root.MomentumConfig.url+'/functions/v1/file-ingest',{method:'POST',headers:{apikey:root.MomentumConfig.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/octet-stream','x-file-bucket':bucket,'x-file-operation':operation,'x-file-extension':extension,...(resource?{'x-file-resource':resource}:{})},body:file,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(90000)});}catch{throw failure('L’envoi n’est pas confirmé. Garde ce fichier sélectionné et réessaie.');}
    let result;try{result=await response.json();}catch{throw failure('L’envoi n’est pas confirmé. Réessaie sans fermer le formulaire.');}
    if(!response.ok){if(response.status<500&&result.error!=='upload_in_progress')entries.delete(key);throw failure(errors[result.error]||'La vérification du fichier n’est pas confirmée. Réessaie sans fermer le formulaire.');}
    if(typeof result.path!=='string'||!result.path||result.operation!==operation)throw failure('La réponse du service de fichiers n’est pas complète.');
    return result;
  }
  root.MomentumUploads=Object.freeze({upload,forget:file=>operations.delete(file)});
})(window);
