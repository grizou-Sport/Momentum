/* Aucun réglage de connexion ne prétend réaliser une synchronisation inexistante. */
let accountExportController=null;
window.addEventListener('momentum:session-cleared',()=>{accountExportController?.abort();accountExportController=null;});
function renderAccount() {
  YOU.detail.innerHTML=`<p class="section-kicker">Mon compte</p><h2>À ta façon</h2><p>Tes préférences, tes accès et tes données.</p>
    <section class="you-account-section"><h3>À l’ouverture</h3><div class="preference-grid">${[['index.html','HOME'],['you.html','YOU'],['progression.html','PROGRESSION'],['together.html','TOGETHER']].map(([page,label])=>`<label>${label}<select data-arrival="${page}"><option value="immersive">Accueil de la page</option><option value="direct">Accès direct au contenu</option></select></label>`).join('')}</div><label class="you-account-toggle"><span>Garder le calendrier du Journal ouvert</span><input type="checkbox" data-journal-open></label><p role="status" data-preference-status></p></section>
    <section class="you-account-section"><h3>Langue et unités</h3><p>Cette version fonctionne en français, en kilomètres et en minutes. Les autres langues et unités ne sont pas encore disponibles.</p></section>
    <section class="you-account-section"><h3>Sources d’activité</h3><p>COROS, Garmin et Strava : synchronisation automatique indisponible dans cette version. Une ancienne source déclarée dans ton profil ne constitue pas une connexion active.</p><a href="index.html?import=1#today">Importer un fichier FIT ou GPX</a></section>
    <section class="you-account-section"><h3>Notifications</h3><p>Les envois automatiques par e-mail et les notifications push ne sont pas activés dans cette version.</p><a href="together.html?view=invitations">Consulter mes invitations dans MOMENTUM</a></section>
    <section class="you-account-section"><h3>Tes données</h3><p>L’export comprend toutes les périodes de ton compte et un récapitulatif des éléments exportés. Les données privées des autres personnes en sont exclues.</p><label class="you-account-toggle"><span>Inclure les liens de récupération des fichiers et photos autorisés (liens temporaires, une heure)</span><input type="checkbox" data-export-files></label><button type="button" class="secondary" data-account-export>Exporter les données structurées</button><button type="button" class="secondary" data-export-cancel hidden>Annuler l’export</button><p role="status" aria-live="polite" data-export-status></p><a href="confidentialite.html">Lire la politique de confidentialité</a></section>
    <section class="you-account-section"><h3>Supprimer mon compte</h3><p>Consulter le récapitulatif et les conséquences avant toute suppression.</p><button type="button" class="secondary" data-account-delete>Préparer la suppression</button></section>
    <section class="you-account-section"><h3>Session</h3><button type="button" class="secondary" data-account-logout>Se déconnecter</button><p role="status" data-logout-status></p></section>`;
  const preferences=YOU.detail.querySelector('[data-preference-status]');
  YOU.detail.querySelectorAll('[data-arrival]').forEach(select=>{
    const key=`arrival_${select.dataset.arrival}`;select.value=window.MomentumPreferences.get(key,'immersive');
    select.addEventListener('change',async()=>{const previous=window.MomentumPreferences.get(key,'immersive');select.disabled=true;try{await window.MomentumPreferences.set(key,select.value);preferences.textContent='Préférence enregistrée.';}catch(_){select.value=previous;preferences.textContent='Préférence non enregistrée. Réessaie.';}finally{select.disabled=false;}});
  });
  const journal=YOU.detail.querySelector('[data-journal-open]');journal.checked=window.MomentumPreferences.get('journal_open',false);
  journal.addEventListener('change',async()=>{const previous=!journal.checked;journal.disabled=true;try{await window.MomentumPreferences.set('journal_open',journal.checked);preferences.textContent='Préférence enregistrée.';}catch(_){journal.checked=previous;preferences.textContent='Préférence non enregistrée. Réessaie.';}finally{journal.disabled=false;}});
  YOU.detail.querySelector('[data-export-files]').addEventListener('change',event=>{YOU.detail.querySelector('[data-account-export]').textContent=event.target.checked?'Exporter les données et les liens des fichiers':'Exporter les données structurées';});
  YOU.detail.querySelector('[data-account-delete]').addEventListener('click',()=>window.MomentumAccountDeletion.open());
  YOU.detail.querySelector('[data-account-export]').addEventListener('click',exportAccountData);
  YOU.detail.querySelector('[data-export-cancel]').addEventListener('click',()=>accountExportController?.abort());
  YOU.detail.querySelector('[data-account-logout]').addEventListener('click',async event=>{
    const button=event.currentTarget,message=YOU.detail.querySelector('[data-logout-status]');button.disabled=true;
    try{const result=await window.momentumDB.auth.signOut({scope:'local'});if(result.error)throw result.error;window.location.replace('login.html');}catch(_){button.disabled=false;message.textContent='Déconnexion interrompue. Tu peux réessayer.';}
  });
}
async function exportAccountData() {
  if(accountExportController)return;
  const owner=YOU.currentUser?.id,button=YOU.detail.querySelector('[data-account-export]'),cancel=YOU.detail.querySelector('[data-export-cancel]'),message=YOU.detail.querySelector('[data-export-status]');
  const withFiles=YOU.detail.querySelector('[data-export-files]').checked;
  const controller=new AbortController();accountExportController=controller;button.disabled=true;cancel.hidden=false;message.textContent='Préparation de ton export…';
  try{
    const result=await window.MomentumExport.collect(window.momentumDB,{withFiles,signal:controller.signal,onProgress:({loaded,total})=>{message.textContent=`${loaded} éléments reçus sur ${total}.`;}});
    if(YOU.currentUser?.id!==owner||controller.signal.aborted)return;
    window.MomentumExport.download(result);message.textContent=`${withFiles?'Données et liens des fichiers exportés':'Données structurées exportées'} : ${result.manifest.total} éléments. ${withFiles?'Les liens des fichiers privés expirent après une heure.':'Les fichiers binaires ne sont pas inclus.'}`;
  }catch(_){message.textContent=controller.signal.aborted?'Export annulé. Aucun fichier incomplet téléchargé.':'Export interrompu. Aucun export complet annoncé. Tu peux réessayer.';}
  finally{if(accountExportController===controller)accountExportController=null;button.disabled=false;cancel.hidden=true;}
}
