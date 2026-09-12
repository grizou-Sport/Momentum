/* Progressive enhancement: content and native controls remain visible if this module fails. */
(function () {
  'use strict';
  function init() {
    const page = location.pathname.split('/').pop() || 'index.html';
    const target = document.querySelector('[data-direct-content]') || document.querySelector('main');
    if (target) {
      target.id ||= 'main-content'; target.tabIndex = -1;
      const skip = document.querySelector('.skip-link') || document.createElement('a'); skip.className = 'skip-link'; skip.href = '#' + target.id; skip.textContent = 'Aller au contenu'; document.body.prepend(skip);
    }
    const journal = document.querySelector('#journal');
    if (journal) {
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'journal-toggle'; toggle.textContent = 'Calendrier du mois'; toggle.setAttribute('aria-controls', journal.id);
      const setOpen = open => { journal.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
      setOpen(location.hash === '#journal' || window.MomentumPreferences?.get('journal_open', false));
      toggle.addEventListener('click', async () => { setOpen(journal.hidden); try { await window.MomentumPreferences?.set('journal_open', !journal.hidden); } catch (_) { toggle.title = 'Préférence conservée pour cette page uniquement.'; } });
      journal.before(toggle); window.addEventListener('hashchange', () => { if (location.hash === '#journal') setOpen(true); });
    }
    if (!location.hash && !location.search && window.MomentumPreferences?.get(`arrival_${page}`, 'immersive') === 'direct') target?.scrollIntoView({behavior:'instant',block:'start'});
  }
  Promise.resolve(window.momentumPageReady).then(init).catch(() => { /* Access errors remain handled by the page guard. */ });
})();
