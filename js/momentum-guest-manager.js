/* L'organisateur choisit l'aperçu avant la génération. Le secret ne quitte pas cette boîte. */
(function(){
 'use strict';
 const e=value=>window.MomentumUI.escapeText(value);
 const date=value=>value?new Date(value).toLocaleString('fr-CH',{timeZone:'Europe/Zurich',dateStyle:'long',timeStyle:'short'}):'Date à choisir';
 const errors={capacity_full:'Toutes les places sont confirmées. Cette réponse reste à valider.',response_conflict:'La réponse a changé. Actualise la liste avant de confirmer.',invalid_response:'Vérifie le titre, la date ou les créneaux du Moment et les champs de l’invitation.',invitation_unavailable:'Cette invitation ne peut pas être utilisée pour le moment.',rate_limited:'Trop de demandes rapprochées. Réessaie plus tard.'};
 async function request(name,args){const result=await window.momentumDB.rpc(name,args);if(result.error)throw result.error;if(result.data?.error)throw new Error(result.data.error);return result.data;}
 async function open(moment){
  if(document.querySelector('[data-guest-manager]'))return;
  const dialog=document.createElement('dialog');dialog.className='guest-manager';dialog.dataset.guestManager='';dialog.setAttribute('aria-labelledby','guestManagerTitle');
  dialog.innerHTML=`<section class="guest-manager-shell"><button type="button" data-close aria-label="Fermer les invitations">Fermer</button><h2 id="guestManagerTitle">Inviter sans compte</h2><p>Chaque lien est individuel. Il permet de répondre à ce Moment, sans accès aux activités personnelles ni au Cercle.</p>
   <form><label>Repère pour toi<input name="label" maxlength="80" required placeholder="Par exemple : Alex"></label><label>Message à partager<textarea name="message" maxlength="2000" rows="3"></textarea></label>
   <label><input type="checkbox" name="location"> Inclure le lieu : ${e(moment.location_name||'Lieu à préciser')}</label><p>Une adresse peut être précise. Coche uniquement si tu souhaites la communiquer au destinataire.</p>
   <div class="invitation-preview"><h3>Qui pourra voir ceci ?</h3><p>La personne qui possède le lien individuel.</p><h4>${e(moment.title)}</h4><p>${e(date(moment.start_at))}</p><div data-options></div><p data-preview-location>Lieu à préciser</p><p data-preview-message></p><p>Aucun participant, note privée, effort, mesure de santé ou photo personnelle dans cet aperçu.</p></div>
   <button type="submit" class="primary">Générer le lien individuel</button></form><p role="status" aria-live="polite" data-message></p><div data-link hidden><label>Lien individuel<input readonly data-link-value></label><p data-expiry></p><button type="button" data-copy>Copier le lien</button><p>La copie ne signifie pas que le lien a été envoyé ou lu.</p></div><h3>Réponses externes</h3><button type="button" class="secondary" data-refresh>Actualiser les réponses</button><div data-list></div></section>`;
  document.body.append(dialog);const form=dialog.querySelector('form'),message=dialog.querySelector('[data-message]'),list=dialog.querySelector('[data-list]');let creation=null;
  for(const option of moment.moment_date_options||[]){const p=document.createElement('p');p.textContent=date(option.start_at);dialog.querySelector('[data-options]').append(p);}
  const update=()=>{dialog.querySelector('[data-preview-location]').textContent=form.elements.location.checked?(moment.location_name||'Lieu à préciser'):'Lieu à préciser';dialog.querySelector('[data-preview-message]').textContent=form.elements.message.value;};form.addEventListener('input',update);
  function report(error){message.textContent=errors[error.message]||'Action non confirmée. Actualise ou réessaie.';}
  function showLink(result){
   if(!result.secret){message.textContent='L’invitation existe déjà. Utilise « Renouveler le lien » pour obtenir un nouveau lien.';return;}
   dialog.dataset.linkInvitation=result.id;dialog.querySelector('[data-link]').hidden=false;dialog.querySelector('[data-link-value]').value=new URL('invite.html',location.href).href+'#'+result.secret;
   dialog.querySelector('[data-expiry]').textContent='Lien valable jusqu’au '+date(result.view.expires_at)+'.';message.textContent='Lien créé. Tu peux le copier et choisir comment le partager.';
  }
  async function load(){
   list.textContent='Chargement des réponses…';
   try{const result=await request('list_guest_invitations',{p_moment_id:moment.id});if(!dialog.isConnected)return;
    list.innerHTML=result.invitations.map(item=>`<article class="guest-response"><h4>${e(item.label)}</h4><p>${e(item.view.display_name||'Aucune réponse nominative')} · ${e({none:'Pas de réponse',yes:'Oui',maybe:'Peut-être',no:'Non'}[item.view.answer])}</p><p>${e({unanswered:'En attente de réponse',pending_validation:'Réponse externe à valider',confirmed:'Participation confirmée',declined:'Participation non confirmée'}[item.view.response_state])}</p><p>${item.revoked?'Lien révoqué':'Accès jusqu’au '+e(date(item.expires_at))}</p>
    ${item.view.answer==='yes'&&item.view.response_state!=='confirmed'?`<button type="button" data-action="confirm" data-id="${e(item.id)}" data-revision="${item.view.response_revision}">Confirmer la participation</button>`:''}${['pending_validation','confirmed'].includes(item.view.response_state)?`<button type="button" data-action="decline" data-id="${e(item.id)}" data-revision="${item.view.response_revision}">Ne pas confirmer</button>`:''}<button type="button" data-action="renew" data-id="${e(item.id)}">Renouveler le lien</button>${!item.revoked?`<button type="button" data-action="revoke" data-id="${e(item.id)}">Révoquer le lien</button>`:''}</article>`).join('')||'<p>Aucun lien individuel créé pour ce Moment.</p>';
   }catch(error){list.textContent='Les réponses ne sont pas disponibles. Utilise Actualiser.';report(error);}
  }
  form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;form.inert=true;message.textContent='Génération…';
   creation||={p_moment_id:moment.id,p_id:crypto.randomUUID(),p_label:form.elements.label.value.trim(),p_message:form.elements.message.value,p_share_location:form.elements.location.checked};
   try{const result=await request('create_guest_invitation',creation);creation=null;showLink(result);await load();}catch(error){if(['invalid_response','invitation_unavailable'].includes(error.message))creation=null;report(error);}finally{form.inert=false;form.querySelectorAll('input,textarea').forEach(input=>input.disabled=!!creation);}
  });
  list.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;button.disabled=true;
   try{const result=await request('manage_guest_invitation',{p_action:button.dataset.action,p_id:button.dataset.id,p_revision:button.dataset.revision?Number(button.dataset.revision):null});if(button.dataset.action==='revoke'&&dialog.dataset.linkInvitation===button.dataset.id){dialog.querySelector('[data-link-value]').value='';dialog.querySelector('[data-link]').hidden=true;}if(button.dataset.action==='renew')showLink(result);else message.textContent=button.dataset.action==='confirm'?'Participation confirmée.':button.dataset.action==='revoke'?'Lien révoqué. Les réponses enregistrées sont conservées.':'Décision enregistrée.';await load();}catch(error){report(error);button.disabled=false;}
  });
  dialog.querySelector('[data-refresh]').addEventListener('click',load);
  dialog.querySelector('[data-copy]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(dialog.querySelector('[data-link-value]').value);message.textContent='Lien copié. Tu peux maintenant le partager.';}catch(_){message.textContent='Copie indisponible. Tu peux sélectionner et copier le lien affiché.';}});
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{creation=null;dialog.replaceChildren();dialog.remove();},{once:true});dialog.showModal();form.elements.label.focus();await load();
 }
 window.addEventListener('momentum:session-cleared',()=>document.querySelectorAll('[data-guest-manager]').forEach(dialog=>dialog.close()));
 window.MomentumGuests=Object.freeze({open});
})();
