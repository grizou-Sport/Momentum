/* Le récit lit le Journal existant : aucune copie d'activité ni de souvenir. */
function personalPractice(activity) {
  return window.MomentumSports?.resolve(activity.sport || activity.activity_type)?.label
    || window.MomentumWellbeing?.resolve(activity.sport || activity.activity_type)?.label || activity.activity_type || activity.sport || 'Moment';
}
function personalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Date non renseignée';
  return new Date(value + 'T12:00:00Z').toLocaleDateString('fr-CH', {day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Zurich'});
}
function personalMoments() {
  return YOU.activities.filter(activity => activity.user_id === YOU.currentUser?.id && !activity.parent_activity_id && !activity.duplicate_of)
    .sort((a,b) => String(b.activity_date || '').localeCompare(String(a.activity_date || '')) || String(a.id).localeCompare(String(b.id)));
}
function personalCard(activity) {
  const memory = YOU.memories.find(item => item.activity_id === activity.id)?.retained_memory;
  return `<article class="personal-moment" data-personal-moment="${escapeHTML(activity.id)}"><p>${escapeHTML(personalDate(activity.activity_date))} · ${activity.status === 'planned' ? 'Prévu' : activity.status === 'done' ? 'Réalisé' : 'Statut non renseigné'}</p><h3>${escapeHTML(personalPractice(activity))}</h3>
    ${activity.location_name ? `<p>${escapeHTML(activity.location_name)}</p>` : ''}${memory ? `<blockquote>${escapeHTML(memory)}</blockquote>` : '<p>Aucun souvenir écrit pour ce Moment.</p>'}
    <div data-personal-media></div><a class="secondary" href="index.html?activity=${encodeURIComponent(activity.id)}">Ouvrir ce Moment</a>
    <button type="button" class="secondary" data-mark-moment="${escapeHTML(activity.id)}" aria-pressed="${activity.is_memorable === true}">${activity.is_memorable ? 'Retirer des Moments marquants' : 'Garder parmi mes Moments marquants'}</button><p data-moment-message role="status"></p></article>`;
}
function bindPersonalCards() {
  const owner = YOU.currentUser?.id;
  YOU.detail.querySelectorAll('[data-mark-moment]').forEach(button => button.addEventListener('click', async () => {
    const activity = YOU.activities.find(item => item.id === button.dataset.markMoment);
    const message = button.closest('article').querySelector('[data-moment-message]');
    button.disabled = true;
    try {
      const result = await window.momentumDB.rpc('mark_personal_moment', {p_activity_id:activity.id,p_marked:!activity.is_memorable,p_expected_revision:activity.revision});
      if (result.error) throw result.error;
      if (YOU.currentUser?.id !== owner) return;
      Object.assign(activity,result.data); window.MomentumData.invalidate();
      button.setAttribute('aria-pressed',String(activity.is_memorable));
      button.textContent = activity.is_memorable ? 'Retirer des Moments marquants' : 'Garder parmi mes Moments marquants';
      message.textContent = 'Choix enregistré.';
    } catch (error) { message.textContent = error.code === '40001' ? 'Ce Moment a changé ailleurs. Recharge la page avant de modifier ton choix.' : 'Choix non enregistré. Tu peux réessayer.'; }
    finally { button.disabled = false; }
  }));
  YOU.detail.querySelectorAll('[data-personal-moment]').forEach(async card => {
    const media = YOU.media.find(item => item.activity_id === card.dataset.personalMoment);
    if (!media?.file_path) return;
    const target = card.querySelector('[data-personal-media]');
    try {
      const result = await window.momentumDB.storage.from('activity-media').createSignedUrl(media.file_path,600);
      if (result.error || !result.data?.signedUrl) throw new Error('media');
      if (!target.isConnected || YOU.currentUser?.id !== owner) return;
      const image = document.createElement('img'); image.src=result.data.signedUrl; image.alt='Photo conservée pour ce Moment'; image.loading='lazy'; image.width=720; image.height=480;
      image.addEventListener('error',()=>{target.textContent='Photo momentanément indisponible.';},{once:true}); target.append(image);
    } catch (_) { if(target.isConnected) target.textContent='Photo momentanément indisponible.'; }
  });
}
function renderPersonalOverview() {
  const personalization = YOU.passport?.personalization || {};
  const highlight = personalMoments().find(activity => activity.is_memorable);
  const practices = YOU.sportProfile.map(item => `${item.label}${item.questionnaire ? ' · déclaré' : ' · observé dans le Journal'}`);
  YOU.detail.innerHTML = `<p class="section-kicker">Ton aperçu</p><h2>${escapeHTML(YOU.passport?.display_name || 'Ton espace personnel')}</h2>
    <p>${practices.length ? escapeHTML(practices.join(' / ')) : 'Tes pratiques peuvent se préciser au fil de tes Moments.'}</p>
    <section class="personal-horizon"><h3>Mon Horizon</h3>${personalization.open_intention && personalization.open_intention_status !== 'archived' ? `<p>${escapeHTML(personalization.open_intention)}</p><p>${personalization.open_intention_status === 'paused' ? 'Intention en pause' : 'Une intention, sans échéance imposée'}</p>` : '<p>Une envie, un endroit à découvrir, du temps pour toi… Tu peux poser une intention quand tu le souhaites.</p>'}<a href="you.html?section=mission">Retrouver mon Horizon</a></section>
    <h3>Un Moment qui compte</h3>${highlight ? personalCard(highlight) : '<p>Tu peux choisir les Moments que tu souhaites garder en avant dans Mon Chemin.</p>'}<a class="personal-more" href="you.html?section=path">Parcourir Mon Chemin</a>`;
  bindPersonalCards();
}
function renderPersonalPath() {
  const preferences = window.MomentumSession?.read('personal-path',{}) || {};
  const moments = personalMoments();
  const practices = [...new Set(moments.map(personalPractice))].sort((a,b)=>a.localeCompare(b,'fr'));
  YOU.detail.innerHTML = `<p class="section-kicker">Mon Chemin</p><h2>Les Moments que tu gardes</h2><p>Ton Journal, tes mots et tes photos. Les Moments marquants sont ceux que tu choisis.</p>
    <form class="personal-filters"><label>Pratique<select name="practice"><option value="">Toutes les pratiques</option>${practices.map(label=>`<option value="${escapeHTML(label)}">${escapeHTML(label)}</option>`).join('')}</select></label><label>Du<input type="date" name="from"></label><label>Au<input type="date" name="to"></label><label><input type="checkbox" name="marked"> Moments marquants seulement</label><button type="submit" class="secondary">Afficher</button></form><p data-path-status role="status"></p><div class="personal-path"></div><nav class="personal-pagination" aria-label="Pages de Mon Chemin"><button type="button" data-prev>Précédents</button><span data-page></span><button type="button" data-next>Suivants</button></nav>`;
  const form=YOU.detail.querySelector('form'), list=YOU.detail.querySelector('.personal-path'), status=YOU.detail.querySelector('[data-path-status]');
  for(const field of ['practice','from','to'])form.elements[field].value=preferences[field] || '';
  form.elements.marked.checked=preferences.marked === true;
  let page=0;
  function show(){
    const filters={practice:form.elements.practice.value,from:form.elements.from.value,to:form.elements.to.value,marked:form.elements.marked.checked};
    if(filters.from&&filters.to&&filters.from>filters.to){status.textContent='La fin doit suivre le début de la période.';return;}
    window.MomentumSession?.write('personal-path',filters);
    const filtered=moments.filter(a=>(!filters.practice||personalPractice(a)===filters.practice)&&(!filters.marked||a.is_memorable)&&(!filters.from||a.activity_date>=filters.from)&&(!filters.to||a.activity_date<=filters.to));
    const pages=Math.max(1,Math.ceil(filtered.length/8));page=Math.min(page,pages-1);
    list.innerHTML=filtered.slice(page*8,page*8+8).map(personalCard).join('') || '<p>Aucun Moment dans cette sélection. Tu peux élargir les filtres ou <a href="index.html#today">ajouter un premier Moment</a>.</p>';
    status.textContent=`${filtered.length} Moment${filtered.length===1?'':'s'} dans cette sélection.`;
    YOU.detail.querySelector('[data-page]').textContent=`Page ${page+1} sur ${pages}`;
    YOU.detail.querySelector('[data-prev]').disabled=page===0;YOU.detail.querySelector('[data-next]').disabled=page===pages-1;bindPersonalCards();
  }
  form.addEventListener('submit',event=>{event.preventDefault();page=0;show();});
  YOU.detail.querySelector('[data-prev]').addEventListener('click',()=>{page--;show();});YOU.detail.querySelector('[data-next]').addEventListener('click',()=>{page++;show();});show();
}
function renderPersonalHorizon() {
  const p=YOU.passport?.personalization || {}, history=p.intention_history || [];
  YOU.detail.innerHTML=`<p class="section-kicker">Mon Horizon</p><h2>Ce que tu as envie de vivre</h2><p>Une intention libre peut rester sans distance, sans échéance et sans performance attendue.</p>
    <form class="you-form" id="intentionForm"><label class="full">Ton intention<textarea name="intention" maxlength="2000" rows="4">${escapeHTML(p.open_intention || '')}</textarea></label><label>Où en es-tu ?<select name="status"><option value="active">En cours</option><option value="paused">En pause</option><option value="archived">Archivée</option></select></label><button type="submit" class="primary">Enregistrer l’intention</button><p class="full" role="status" data-intention-status></p></form>
    <details><summary>Intentions précédentes</summary>${history.length?history.map(item=>`<p>${escapeHTML(item.text)}</p>`).join(''):'<p>Aucune intention précédente enregistrée.</p>'}</details>
    <section class="personal-horizon"><h3>Objectifs chiffrés et datés</h3><p>Tes Horizons existants et leur historique restent accessibles.</p><button type="button" class="secondary" data-quantified-horizon>Ouvrir mes objectifs</button></section>`;
  const form=YOU.detail.querySelector('form');form.elements.status.value=p.open_intention_status || 'active';let pending=null;
  form.addEventListener('submit',async event=>{
    event.preventDefault();const message=form.querySelector('[data-intention-status]');form.inert=true;message.textContent='Enregistrement…';
    pending ||= {p_text:form.elements.intention.value.trim(),p_status:form.elements.status.value,p_expected_updated_at:YOU.passport.updated_at,p_operation_id:crypto.randomUUID()};
    const owner=YOU.currentUser?.id;
    try {const result=await window.momentumDB.rpc('save_personal_intention',pending);if(result.error)throw result.error;if(YOU.currentUser?.id!==owner)return;YOU.passport=result.data;pending=null;message.textContent='Intention enregistrée.';}
    catch(error){message.textContent=error.code==='40001'?'Le profil a changé ailleurs. Recharge avant de modifier ton intention.':'Enregistrement interrompu. Réessaie pour reprendre la même demande.';if(error.code==='40001')pending=null;}
    finally{form.inert=false;form.elements.intention.readOnly=!!pending;form.elements.status.disabled=!!pending;}
  });
  YOU.detail.querySelector('[data-quantified-horizon]').addEventListener('click',loadMission);
}
