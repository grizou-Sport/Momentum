(function () {
  'use strict';
  let owner = null, values = {}, generation = 0;
  async function load(userId) {
    const attempt = ++generation; owner = userId;
    const { data, error } = await window.momentumDB.from('user_settings').select('experience_preferences').eq('user_id', userId).maybeSingle();
    if (attempt !== generation || owner !== userId) return;
    if (error) { window.dispatchEvent(new Event('momentum:preferences-unavailable')); return; }
    values = data?.experience_preferences || {};
    window.dispatchEvent(new Event('momentum:preferences-loaded'));
  }
  function get(key, fallback = null) { return values[key] ?? fallback; }
  async function set(key, value) {
    const userId = owner, attempt = generation;
    if (!userId) throw new Error('Session indisponible.');
    const { data, error } = await window.momentumDB.rpc('save_experience_preference', { p_key: key, p_value: value });
    if (error) throw error;
    if (attempt === generation && userId === owner) values = data;
  }
  window.addEventListener('momentum:session-cleared', () => { generation++; owner = null; values = {}; });
  window.MomentumPreferences = Object.freeze({ load, get, set });
})();
