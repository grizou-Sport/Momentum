/* Capability lives only in this closure. No telemetry, third-party scripts, or persistent storage. */
(function guestInvitation() {
  "use strict";
  let secret=null,session=null,view=null,busy=false,legal=null;
  try { secret=window.location.hash.slice(1);window.history.replaceState(null,"",window.location.pathname); } catch (_) { secret=null; }
  const status=document.getElementById("guestStatus"),host=document.getElementById("guestContent");
  const messages={legal_notice_required:"La notice a changé ou les réponses sont suspendues. Rouvre ton invitation et consulte les informations avant de répondre.",invitation_unavailable:"Ce lien n’est plus disponible. Demande un nouveau lien à l’organisateur.",rate_limited:"Trop de tentatives rapprochées. Réessaie dans quelques instants.",response_conflict:"Ta réponse a changé dans une autre fenêtre. Actualise l’invitation avant de répondre.",invalid_response:"Vérifie ton nom et les choix proposés."};
  function text(tag,value,cls){const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;}
  function date(value){if(!value)return "Date à choisir";const d=new Date(value);return Number.isNaN(d.getTime())?"Date à préciser":new Intl.DateTimeFormat("fr-CH",{dateStyle:"full",timeStyle:"short",timeZone:"Europe/Zurich"}).format(d);}
  function message(value,error=false){status.textContent=value;status.classList.toggle("error",error);}
  function failed(error,fallback){
    if(error.message==='invitation_unavailable'){secret=null;session=null;view=null;host.replaceChildren();host.hidden=true;}
    message(messages[error.message]||fallback,true);
  }
  async function rpc(name,payload){
    const c=window.MomentumConfig;if(!c)throw new Error("network");
    const r=await fetch(`${c.url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:c.publishableKey,"Content-Type":"application/json"},body:JSON.stringify(payload),credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error("network");const result=await r.json();if(result.error)throw new Error(result.error);return result;
  }
  function render(){
    host.replaceChildren();host.hidden=false;host.append(text("h2",view.title));
    const facts=document.createElement("dl");for(const[k,v]of[["Quand",date(view.start_at)],["Où",view.location||"Lieu à préciser"],["Lien valable jusqu’au",date(view.expires_at)]])facts.append(text("dt",k),text("dd",v));host.append(facts);
    if(view.message)host.append(text("p",view.message));
    const labels={unanswered:"En attente de ta réponse",pending_validation:"Réponse externe à valider",confirmed:"Participation confirmée par l’organisateur",declined:"Participation non confirmée"};
    if(view.response_needs_refresh)host.append(text("p","La date ou les créneaux ont changé. Confirme à nouveau ta disponibilité.","badge"));
    host.append(text("p",labels[view.response_state]||labels.unanswered,"badge"));
    host.append(text("p","Le lien donne accès à cette invitation ; il ne vérifie pas ton identité. Les réponses externes sont validées par l’organisateur.","muted"));
    if(view.answer!=="none") {
      const withdraw=text("button","Retirer ma réponse et mes disponibilités");withdraw.type="button";
      withdraw.addEventListener("click",async()=>{if(busy)return;busy=true;withdraw.disabled=true;try{const r=await rpc("withdraw_guest_response",{p_session:session});view=r.view;render();message("Ton nom saisi, ta réponse et tes disponibilités ont été retirés. Le libellé donné à l’invitation par l’organisateur reste dans son espace.");}catch(e){failed(e,"Retrait non confirmé. Réessaie.");}finally{busy=false;withdraw.disabled=false;}});host.append(withdraw);
    }
    if(["CANCELLED","COMPLETED"].includes(view.status)){host.append(text("p",view.status==="CANCELLED"?"Ce Moment est annulé. Il ne reçoit plus de réponses.":"Ce Moment est terminé."));return;}
    const form=document.createElement("form"),nameLabel=text("label","Ton nom d’usage"),name=document.createElement("input");name.name="name";name.autocomplete="name";name.maxLength=80;name.required=true;name.value=view.display_name||"";nameLabel.append(name);form.append(nameLabel);
    const answers=document.createElement("fieldset");answers.append(text("legend","Seras-tu de la partie ?"));const row=document.createElement("div");row.className="answers";
    for(const[value,label]of[["yes","Oui"],["maybe","Peut-être"],["no","Non"]]){const l=text("label",""),input=document.createElement("input");input.type="radio";input.name="answer";input.value=value;input.required=true;input.checked=view.answer===value;l.append(input,document.createTextNode(label));row.append(l);}answers.append(row);form.append(answers);
    if(view.options?.length>1){const options=document.createElement("fieldset");options.append(text("legend","Tes disponibilités (facultatif)"));for(const o of view.options){const l=text("label",date(o.start_at)),select=document.createElement("select");select.dataset.option=o.id;for(const[value,label]of[["","Non renseigné"],["yes","Disponible"],["maybe","Peut-être"],["no","Indisponible"]]){const op=text("option",label);op.value=value;op.selected=view.availability?.[o.id]===value;select.append(op);}l.append(select);options.append(l);}form.append(options);}
    const submit=text("button","Enregistrer ma réponse");submit.type="submit";submit.disabled=!legal?.enabled;form.append(submit);if(!legal?.enabled)form.append(text("p","Les nouvelles réponses sont temporairement suspendues. Tu peux retirer une réponse existante."));
    form.addEventListener("submit",async event=>{event.preventDefault();if(busy||!form.reportValidity())return;busy=true;const f=new FormData(form),availability={};form.querySelectorAll("[data-option]").forEach(s=>{if(s.value)availability[s.dataset.option]=s.value;});submit.disabled=true;
      try{const r=await rpc("respond_guest_with_notice",{p_notice_version:legal?.guest?.version,p_notice_sha256:legal?.guest?.sha256,p_session:session,p_name:f.get("name"),p_answer:f.get("answer"),p_availability:availability,p_revision:view.response_revision});view=r.view;render();message(view.response_state==="confirmed"?"Ta participation reste confirmée.":"Ta réponse est enregistrée. L’organisateur peut la consulter.");status.focus();}
      catch(e){failed(e,"Enregistrement non confirmé. Tes choix restent ici ; réessaie sans fermer la page.");}finally{busy=false;submit.disabled=false;}
    });host.append(form);
    const refresh=text("button","Actualiser l’invitation");refresh.type="button";refresh.addEventListener("click",async()=>{if(busy)return;refresh.disabled=true;try{const r=await rpc("read_guest_invitation",{p_session:session});view=r.view;render();message("Invitation actualisée.");}catch(e){failed(e,"Connexion indisponible. Réessaie.");}finally{refresh.disabled=false;}});host.append(refresh);
    if(view.answer!=="none"){const p=text("p","Envie de garder tes propres Moments ? "),a=text("a","Découvrir MOMENTUM");a.href="discover.html";p.append(a);host.append(p);}
  }
  async function initialize(){
    if(!secret||!/^[a-f0-9]{64}$/.test(secret)){message("Ouvre le lien individuel reçu de l’organisateur. Aucun compte n’est nécessaire.");return;}
    try{try{legal=await rpc("legal_public_status",{});}catch{legal={enabled:false};}
      if(legal.enabled)try{await window.MomentumLegal.verifyDocument(legal.guest);const link=document.getElementById('guestNoticeLink');link.href=window.MomentumLegal.documentPath(legal.guest);link.textContent='notice pour les invités (version '+legal.guest.version+')';}catch{legal={enabled:false};}
      const r=await rpc("exchange_guest_invitation",{p_secret:secret});session=r.session;view=r.view;secret=null;render();message("Tu peux répondre sans créer de compte.");}
    catch(e){message(messages[e.message]||"Impossible de charger l’invitation. Rouvre ton lien pour réessayer.",true);secret=null;}
  }
  // Config script and this script are deferred; wait for both without a persistent secret.
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});else initialize();
  window.addEventListener("pagehide",()=>{secret=null;session=null;view=null;host.replaceChildren();host.hidden=true;message("Rouvre le lien reçu pour consulter à nouveau cette invitation.");});
})();
