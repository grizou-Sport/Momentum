/* Single progressive form; legacy category controls remain adapters for existing readers. */
(function () {
  'use strict';
  const preferences = new Map();
  let generation = 0;
  let forms = new WeakMap();
  function preferredPractices(items = []) {
    return [...items].filter(item => item.active !== false).sort((a,b) => Number(b.role === 'Principal') - Number(a.role === 'Principal'))
      .map(item => window.MomentumSports?.resolveId(item.sports?.name) || window.MomentumWellbeing?.resolveId(item.sports?.name)).filter(Boolean);
  }
  async function loadPreferences(form, userId) {
    const revision = generation;
    if (!preferences.has(userId)) preferences.set(userId, (async () => {
      const reply = await window.momentumDB.from('user_sports').select('id,role,active,sports(name)').eq('user_id',userId).eq('active',true).order('created_at').order('id');
      if (reply.error) throw reply.error;
      return preferredPractices(reply.data || []);
    })());
    try {
      const ids = await preferences.get(userId);
      if (revision !== generation) return;
      forms.set(form,ids); renderOptions(form,form.querySelector('[data-nature-filter]')?.value || '');
      const status = form.querySelector('[data-practice-priority-status]'); if (status) status.textContent = '';
    } catch {
      if (revision !== generation) return;
      preferences.delete(userId);
      const status = form.querySelector('[data-practice-priority-status]'); if (status) status.textContent = 'Tes pratiques préférées ne sont pas disponibles pour le moment. Le catalogue complet reste accessible.';
    }
  }
  function catalogue() {
    const sports = (window.MomentumSports?.getAll() || []).map(p => ({ ...p, category: 'sport' }));
    const seen = new Set(sports.map(p => p.id));
    const wellbeing = (window.MomentumWellbeing?.getAll() || []).filter(p => !seen.has(p.id)).map(p => ({ ...p, category: 'wellbeing' }));
    return [...sports, ...wellbeing, { id: 'adventure_unspecified', label: 'Aventure — nature à préciser', category: 'adventure' }];
  }
  function renderOptions(form, filter = '') {
    const select = form.querySelector('[data-moment-nature]'); if (!select) return;
    const value = select.value;
    select.replaceChildren(new Option('Choisir la nature du Moment', ''));
    const entries = catalogue().filter(p => p.id === value || p.label.toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr')));
    const ids = forms.get(form) || [];
    const preferred = [...new Set(ids)].map(id => entries.find(p => p.id === id)).filter(Boolean);
    for (const [label, choices] of [['Tes pratiques',preferred],['Catalogue complet',entries.filter(p => !ids.includes(p.id))]]) {
      if (!choices.length) continue;
      const group = document.createElement('optgroup'); group.label = label;
      for (const p of choices) group.append(new Option(p.label,p.id));
      select.append(group);
    }
    if (value && !entries.some(p => p.id === value)) select.add(new Option(value,value));
    select.value = value;
  }
  function syncNature(form, fromLegacy = false) {
    const select = form.querySelector('[data-moment-nature]'); if (!select) return;
    if (fromLegacy) {
      const category = form.querySelector('[name="activity_category"]:checked')?.value;
      const id = category === 'wellbeing' ? form.elements.wellbeing_activity_type.value : category === 'adventure' ? window.MomentumSports?.resolveId(form.elements.sport.value) || 'adventure_unspecified' : form.elements.sport.value;
      if (![...select.options].some(o => o.value === id) && id) select.add(new Option(id, id));
      select.value = id;
    } else {
      const item = catalogue().find(p => p.id === select.value); if (!item) return;
      const category = form.querySelector(`[name="activity_category"][value="${item.category}"]`);
      category.checked = true;
      const field = form.elements[item.category === 'sport' ? 'sport' : item.category === 'wellbeing' ? 'wellbeing_activity_type' : 'adventure_activity_type'];
      const value = item.category === 'adventure' ? 'Autre' : item.id;
      if (![...field.options].some(o => o.value === value)) field.add(new Option(item.label, value));
      field.value = value; category.dispatchEvent(new Event('change', { bubbles: true }));
      if (item.category === 'adventure') form.elements.sport.value = '';
    }
    const variant = form.elements.practice_variant;
    const needsVariant = window.MomentumTrainingLoad.requiresVariant(select.value);
    const variantField = form.querySelector('[data-practice-variant]'); if (variantField) variantField.hidden = !needsVariant;
    if (variant && !needsVariant) variant.value = '';
    const eligibility = window.MomentumTrainingLoad.eligibility({ practice_id: select.value,practice_variant:variant?.value || null });
    const help = form.querySelector('[data-load-requirement]');
    if (help) help.textContent = eligibility.state === 'eligible' ? 'Durée et effort facultatifs, nécessaires seulement au calcul de charge.' : eligibility.state === 'excluded' ? 'Cette pratique reste dans ton Journal et ton temps d’activité. Elle ne produit pas de charge sportive.' : 'La charge reste indéterminée tant que la nature physique n’est pas précisée.';
    const rpe = form.querySelector('momentum-slider[name="rpe"]');
    if (rpe) {
      rpe.hidden = eligibility.state === 'excluded';
      if (rpe.nextElementSibling?.classList.contains('clear-response')) rpe.nextElementSibling.hidden = rpe.hidden;
    }
  }
  function setup(form) {
    if (!form || form.dataset.natureReady) return;
    form.dataset.natureReady = 'true'; renderOptions(form);
    form.querySelector('[data-nature-filter]')?.addEventListener('input', e => renderOptions(form, e.target.value));
    form.querySelector('[data-moment-nature]')?.addEventListener('change', () => { if (form.elements.practice_variant) form.elements.practice_variant.value = ''; syncNature(form); });
    form.elements.practice_variant?.addEventListener('change', () => syncNature(form));
    form.querySelectorAll('momentum-slider').forEach(slider => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Effacer la réponse'; button.className = 'clear-response';
      button.addEventListener('click', () => { slider.value = null; slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true })); });
      slider.after(button);
    });
  }
  function focusExperience(form) {
    const details = form?.querySelector('[data-experience-details]'); if (details) { details.open = true; details.querySelector('summary')?.focus(); }
  }
  window.addEventListener('momentum:session-cleared', () => { generation += 1; preferences.clear(); forms = new WeakMap(); });
  window.MomentumMomentForm = Object.freeze({ setup, syncNature, focusExperience, loadPreferences, preferredPractices });
})();
