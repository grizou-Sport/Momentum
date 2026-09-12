/* Account-scoped, non-sensitive UI preferences only. Private drafts stay in memory. */
(function () {
  'use strict';
  let userId = null;
  const cache = new Map(), prefix = 'momentum:ui:';
  function clear() {
    cache.clear(); userId = null;
    try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key); } catch (_) { /* Storage can be unavailable. */ }
    document.querySelectorAll('.momentum-user-avatar').forEach(node => node.replaceChildren());
    window.dispatchEvent(new Event('momentum:session-cleared'));
  }
  function activate(id) { if (userId !== id) { clear(); userId = id; } }
  function read(key, fallback = null) {
    if (!userId) return fallback;
    const scoped = `${prefix}${userId}:${key}`;
    try { return cache.get(scoped) ?? JSON.parse(sessionStorage.getItem(scoped)) ?? fallback; } catch (_) { return fallback; }
  }
  function write(key, value) {
    if (!userId) return;
    const scoped = `${prefix}${userId}:${key}`; cache.set(scoped, value);
    try { sessionStorage.setItem(scoped, JSON.stringify(value)); } catch (_) { /* Memory fallback. */ }
  }
  window.MomentumSession = Object.freeze({ activate, clear, read, write, currentUser: () => userId });
  window.momentumDB?.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') clear();
    else if (session?.user?.id && userId && session.user.id !== userId) { clear(); location.reload(); }
  });
})();
