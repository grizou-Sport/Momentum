/* Minimal, resumable onboarding. All writes are one transactional RPC per step. */
(function () {
  'use strict';
  const form = document.getElementById('onboardingForm'), status = document.getElementById('onboardingStatus');
  const message = document.getElementById('stepMessage'), retry = document.getElementById('retryOnboarding');
  const next = document.getElementById('nextStep'), previous = document.getElementById('previousStep'), skip = document.getElementById('skipStep');
  const destination = window.MomentumAccess.safeReturn(new URLSearchParams(location.search).get('returnTo'), location.origin);
  let step = 1, user = null, updatedAt = null, pending = null, loading = false, attempt = 0;
  async function withTimeout(request) { let timer; try { return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Chargement interrompu. Réessaie.')),12000);})]); } finally {clearTimeout(timer);} }
  function showStep(value) {
    step = value;
    form.querySelectorAll('[data-step]').forEach(section => { const active = Number(section.dataset.step) === step; section.hidden = !active; section.classList.toggle('active', active); section.inert = !active; });
    previous.hidden = step === 1; skip.hidden = step === 1; next.textContent = step === 3 ? 'Ouvrir mon espace' : 'Continuer';
    document.getElementById('progressLabel').textContent = `Un premier Moment · ${step} sur 3`;
    form.querySelector(`[data-step="${step}"] h1`).setAttribute('tabindex', '-1');
    form.querySelector(`[data-step="${step}"] h1`).focus();
  }
  async function initialize() {
    const version = ++attempt; retry.hidden = true; form.hidden = true; status.textContent = 'Ouverture de ton espace…';
    try {
      const access = await Promise.race([window.MomentumAccess.check(window.momentumDB), new Promise(resolve => setTimeout(() => resolve({status:'temporary_error'}),12000))]);
      if (version !== attempt) return;
      if (['anonymous','expired'].includes(access.status)) { location.replace(`login.html?returnTo=${encodeURIComponent(destination)}`); return; }
      if (access.status === 'legal_required') { location.replace('privacy-center.html?returnTo='+encodeURIComponent(destination)); return; }
      if (access.status === 'ready') { location.replace(destination); return; }
      if (access.status !== 'onboarding') throw new Error('Espace temporairement indisponible. Réessaie sans recréer ton profil.');
      user = access.user;
      const result = await withTimeout(window.momentumDB.from('onboarding_progress').select('*').eq('user_id',user.id).maybeSingle());
      if (result.error) throw new Error('Les étapes déjà enregistrées sont indisponibles. Réessaie.');
      updatedAt = result.data?.updated_at ?? null;
      const minimal = result.data?.answers?.minimal || {};
      form.elements.display_name.value = minimal.display_name || access.passport?.display_name || '';
      const sports = await withTimeout(window.momentumDB.from('sports').select('id,name').order('name'));
      const grid = document.getElementById('sportsGrid'); grid.replaceChildren();
      if (sports.error) grid.textContent = 'Les pratiques sont temporairement indisponibles. Tu peux passer cette étape.';
      for (const sport of sports.data || []) {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.name = 'sport_ids'; input.value = sport.id; input.checked = (minimal.sport_ids || []).includes(sport.id);
        label.append(input, document.createTextNode(window.MomentumSports.getLabel(sport.name, sport.name))); grid.append(label);
      }
      if (version !== attempt) return;
      form.hidden = false; status.textContent = 'Chaque étape est enregistrée quand tu la valides.'; showStep(minimal.next_step || 1);
    } catch (error) { if (version === attempt) { status.textContent = error.message; retry.hidden = false; } }
  }
  async function advance(skipped = false) {
    if (loading) return;
    if (step === 1 && !form.elements.display_name.reportValidity()) return;
    loading = true; form.inert = true; message.textContent = ''; status.textContent = 'Enregistrement de cette étape…';
    if (!pending) pending = { p_step:step,p_operation_id:crypto.randomUUID(),p_expected_updated_at:updatedAt,
      p_values:step === 1 ? {display_name:form.elements.display_name.value.trim()} : step === 2 ? {skipped,sport_ids:skipped ? [] : new FormData(form).getAll('sport_ids')} : {intention:skipped ? null : form.elements.intention.value.trim() || null} };
    try {
      const { data,error } = await withTimeout(window.momentumDB.rpc('save_minimal_onboarding',pending));
      if (error) { if (error.code) pending = null; throw error; }
      pending = null; updatedAt = data.updated_at;
      if (data.complete) { location.replace(destination); return; }
      status.textContent = 'Étape enregistrée.'; showStep(data.next_step);
    } catch (error) {
      status.textContent = 'Enregistrement non confirmé.';
      message.textContent = error.code === '40001' ? 'Ces étapes ont changé ailleurs. Recharge la page pour reprendre.' : 'Réessaie : ta demande sera reprise sans créer de second profil.';
    } finally {
      loading = false; form.inert = false;
      form.querySelectorAll('input,textarea,select').forEach(input=>{input.disabled=!!pending;});
      previous.disabled=!!pending; skip.disabled=!!pending;
      if(pending)next.focus();else form.querySelector(`[data-step="${step}"] h1`).focus();
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); advance(); });
  skip.addEventListener('click', () => advance(true));
  previous.addEventListener('click', () => { if (!pending) showStep(Math.max(1,step-1)); });
  retry.addEventListener('click',initialize);
  document.getElementById('onboardingLogout').addEventListener('click',async () => { const {error}=await window.momentumDB.auth.signOut({scope:'local'}); if (!error) location.replace('discover.html'); else status.textContent='Déconnexion interrompue. Réessaie.'; });
  initialize();
})();
