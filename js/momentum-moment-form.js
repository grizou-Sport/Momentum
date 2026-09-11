/* Single progressive form; legacy category controls remain adapters for existing readers. */
(function () {
  'use strict';
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
    for (const p of catalogue().filter(p => p.id === value || p.label.toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr')))) select.add(new Option(p.label, p.id));
    select.value = value;
  }
  function syncNature(form, fromLegacy = false) {
    const select = form.querySelector('[data-moment-nature]'); if (!select) return;
    if (fromLegacy) {
      const category = form.querySelector('[name="activity_category"]:checked')?.value;
      const id = category === 'wellbeing' ? form.elements.wellbeing_activity_type.value : category === 'adventure' ? 'adventure_unspecified' : form.elements.sport.value;
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
    }
    const eligibility = window.MomentumTrainingLoad.eligibility({ practice_id: select.value });
    const help = form.querySelector('[data-load-requirement]');
    if (help) help.textContent = eligibility.state === 'eligible' ? 'Durée et effort facultatifs, nécessaires seulement au calcul de charge.' : eligibility.state === 'excluded' ? 'Cette pratique reste dans ton Journal et ton temps d’activité. Elle ne produit pas de charge sportive.' : 'La charge reste indéterminée tant que la nature physique n’est pas précisée.';
    const rpe = form.querySelector('momentum-slider[name="rpe"]');
    if (rpe) rpe.hidden = eligibility.state === 'excluded';
  }
  function setup(form) {
    if (!form || form.dataset.natureReady) return;
    form.dataset.natureReady = 'true'; renderOptions(form);
    form.querySelector('[data-nature-filter]')?.addEventListener('input', e => renderOptions(form, e.target.value));
    form.querySelector('[data-moment-nature]')?.addEventListener('change', () => syncNature(form));
    form.querySelectorAll('momentum-slider').forEach(slider => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Effacer la réponse'; button.className = 'clear-response';
      button.addEventListener('click', () => { slider.value = null; slider.dispatchEvent(new Event('input', { bubbles: true })); slider.dispatchEvent(new Event('change', { bubbles: true })); });
      slider.after(button);
    });
  }
  function focusExperience(form) {
    const details = form?.querySelector('[data-experience-details]'); if (details) { details.open = true; details.querySelector('summary')?.focus(); }
  }
  window.MomentumMomentForm = Object.freeze({ setup, syncNature, focusExperience });
})();
