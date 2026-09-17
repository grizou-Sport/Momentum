(function(){
 'use strict';
 let dialog=null,receipt=null,started=false,submitted=false,timer=null;
 const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 async function call(action,password='') {
  const headers={'Content-Type':'application/json',apikey:window.MomentumConfig.publishableKey};
  if(action==='begin'){const session=await window.momentumDB.auth.getSession();if(session.error)throw new Error('Session indisponible.');if(session.data.session)headers.Authorization=`Bearer ${session.data.session.access_token}`;}
  const response=await fetch(`${window.MomentumConfig.url}/functions/v1/account-deletion`,{method:'POST',headers,body:JSON.stringify({...receipt,action,...(action==='begin'?{password,confirmation:'SUPPRIMER'}:{})}),signal:AbortSignal.timeout(15000),referrerPolicy:'no-referrer'});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error==='reauthentication_required'?'Le mot de passe ou la session doit être vérifié à nouveau.':result.error==='receipt_unavailable'?'Aucune suppression confirmée avec ce reçu.':'Le résultat n’est pas encore confirmé. Vérifie son état avant de relancer.');error.code=result.error;throw error;}
  return result;
 }
 function downloadReceipt() {
  const link=new URL('account-deletion-status.html',location.href);link.hash=`${receipt.id}.${receipt.receipt}`;
  const blob=new Blob([JSON.stringify({service:'MOMENTUM',usage:'Lien privé de suivi. Ne le partage pas.',status_url:link.href},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MOMENTUM-recu-suppression.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 async function showStatus(container) {
  const status=container.querySelector('[data-delete-status]'),refresh=container.querySelector('[data-delete-refresh]');
  clearTimeout(timer);if(refresh)refresh.disabled=true;
  try{
   const result=await call('status');started=true;
   status.textContent=result.stage==='complete'?'Ton compte et ses données personnelles ont été supprimés des services actifs. Les éléments collectifs conservés restent accessibles aux autres participants.':result.stage==='identity'?'Les fichiers sont nettoyés. La suppression de l’identité est en cours.':result.stage==='files'?`Tes données personnelles sont retirées. Nettoyage des fichiers en cours${result.pending_files?` (${result.pending_files} restant${result.pending_files>1?'s':''})`:''}.`:'Demande enregistrée. La suppression va commencer et tes nouvelles modifications sont suspendues.';
   if(result.retry_pending&&result.stage!=='complete')status.textContent+=' Une reprise est en attente ; la suppression complète n’est pas encore confirmée.';
   if(result.stage==='complete'){
    window.MomentumSession?.clear();await window.momentumDB?.auth.signOut({scope:'local'});if(refresh)refresh.hidden=true;
   }else timer=setTimeout(()=>{if(container.isConnected)showStatus(container);},10000);
  }catch(error){status.textContent=error.message;if(error.code==='receipt_unavailable'&&dialog&&!container.querySelector('[data-delete-restart]')){started=false;const retry=document.createElement('button');retry.type='button';retry.dataset.deleteRestart='';retry.textContent='Revenir à la confirmation';retry.onclick=()=>{dialog.remove();dialog=null;open();};container.append(retry);}}
  finally{if(refresh)refresh.disabled=false;}
 }
 function trackingContent(container) {
  container.innerHTML='<h2>Suivi de la suppression</h2><p role="status" aria-live="polite" data-delete-status>Vérification du résultat…</p><p>Le traitement continue si tu fermes cette page. Conserve ton reçu privé pour retrouver son état pendant les sept jours qui suivent la suppression.</p><button type="button" class="secondary" data-delete-refresh>Vérifier le résultat</button> <button type="button" class="secondary" data-delete-receipt>Conserver mon reçu</button><p><a href="discover.html">Retour à la découverte</a></p>';
  container.querySelector('[data-delete-refresh]').onclick=()=>showStatus(container);
  container.querySelector('[data-delete-receipt]').onclick=downloadReceipt;
  showStatus(container);
 }
 async function open() {
  if(dialog){dialog.showModal();if(started)showStatus(dialog.querySelector('[data-delete-content]'));return;}
  dialog=document.createElement('dialog');dialog.className='account-deletion-dialog';dialog.setAttribute('aria-label','Suppression du compte');
  dialog.innerHTML='<button type="button" class="secondary" data-close>Fermer</button><section data-delete-content><h2>Supprimer mon compte</h2><p role="status" data-delete-status>Préparation du récapitulatif…</p></section>';
  document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{clearTimeout(timer);if(!receipt){dialog.remove();dialog=null;}});dialog.showModal();
  const content=dialog.querySelector('[data-delete-content]');
  if(receipt&&started){trackingContent(content);return;}
  try{
   const result=await Promise.race([window.momentumDB.rpc('prepare_account_deletion'),new Promise((_,reject)=>setTimeout(()=>reject(new Error()),12000))]);
   if(result.error)throw result.error;
   if(!result.data.ready){content.querySelector('[data-delete-status]').textContent='Le service de suppression n’est pas prêt pour le moment. Aucune suppression engagée. Tu peux exporter tes données depuis Mon compte.';return;}
   content.innerHTML=`<h2>Supprimer mon compte</h2><p>${Number(result.data.activities)} activités personnelles et ${Number(result.data.files)} fichiers seront supprimés.</p><p>Les participations, activités et photos des autres membres sont conservées. Les titres et dates déjà partagés restent accessibles ; tes récits privés et tes photos sont retirés. Tes Moments collectifs sont annulés, et tes Clubs archivés, sans transfert automatique de tes droits.</p><p>Exporte tes données avant de continuer. La durée de conservation des sauvegardes dépend de la configuration du service ; elle n’est pas incluse dans la confirmation de suppression des services actifs.</p><form><label>Pour confirmer, écris SUPPRIMER<input name="confirmation" autocomplete="off" required pattern="SUPPRIMER"></label><label>Ton mot de passe actuel<input name="password" type="password" autocomplete="current-password" required maxlength="4096"></label><button type="submit" class="secondary">Supprimer définitivement mon compte</button></form><p role="status" data-delete-status></p>`;
   content.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
    receipt??={id:crypto.randomUUID(),receipt:secret()};form.inert=true;submitted=true;
    try{await call('begin',form.elements.password.value);started=true;form.elements.password.value='';trackingContent(content);}
    catch(error){form.elements.password.value='';
     if(error.code==='reauthentication_required'){submitted=false;receipt=null;content.querySelector('[data-delete-status]').textContent=error.message;}
     else trackingContent(content);
    }finally{form.inert=false;}
   };
  }catch(_){content.querySelector('[data-delete-status]').textContent='Le récapitulatif n’a pas pu être chargé. Aucune suppression engagée.';}
 }
 window.addEventListener('momentum:session-cleared',()=>{if(!started&&!submitted){dialog?.remove();dialog=null;receipt=null;}document.querySelectorAll('.account-deletion-dialog input[type="password"]').forEach(input=>{input.value='';});});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);receipt=null;dialog?.remove();dialog=null;if(standalone)standalone.textContent='Rouvre le lien privé de ton reçu pour consulter son état.';});
 window.MomentumAccountDeletion=Object.freeze({open});
 const standalone=document.querySelector('[data-deletion-receipt]');
 if(standalone){
  const value=location.hash.slice(1).split('.');history.replaceState(null,'',location.pathname);
  if(value.length===2&&uid.test(value[0])&&/^[a-f0-9]{64}$/.test(value[1])){receipt={id:value[0],receipt:value[1]};started=true;trackingContent(standalone);}
  else standalone.textContent='Ouvre le lien privé contenu dans ton reçu de suppression.';
 }
})();
