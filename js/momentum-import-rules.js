/* CDC §13. Probable duplicates are suggestions, never a merge instruction. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentumImportRules = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const MAX_BYTES = 20 * 1024 * 1024;
  function validateHeader(name, bytes) {
    const ext = String(name || '').toLowerCase().split('.').pop();
    if (!['fit', 'gpx'].includes(ext)) throw new Error('Choisis un fichier FIT ou GPX.');
    if (!bytes?.length || bytes.length > MAX_BYTES) throw new Error('Le fichier est vide ou dépasse 20 Mo.');
    if (ext === 'gpx') {
      const text = new TextDecoder().decode(bytes);
      if (!/<gpx(?:\s|>)/i.test(text) || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Ce fichier GPX n’est pas reconnu ou contient une déclaration non permise.');
    } else {
      if (bytes.length < 14 || ![12, 14].includes(bytes[0]) || String.fromCharCode(...bytes.slice(8, 12)) !== '.FIT') throw new Error('Ce fichier FIT est incomplet ou non reconnu.');
      const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true);
      if (length === 0 || bytes[0] + length + 2 > bytes.length) throw new Error('Le contenu du fichier FIT est tronqué.');
    }
    return true;
  }
  function positive(value) { return value != null && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null; }
  function minutes(value) {
    const match = typeof value === 'string' && value.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    return match && +match[1] < 24 && +match[2] < 60 ? +match[1] * 60 + +match[2] : null;
  }
  function candidates(next, history) {
    const practice = next.practice_id || next.sport;
    const start = minutes(next.activity_time), duration = positive(next.duration_min), distance = positive(next.distance_km);
    if (!practice || !next.activity_date || start == null || duration == null) return [];
    return (history || []).filter(a => a.id !== next.id && (!next.user_id || a.user_id === next.user_id) &&
      a.activity_date === next.activity_date && (a.practice_id || a.sport) === practice)
      .filter(a => {
        const time = minutes(a.activity_time), d = positive(a.duration_min), km = positive(a.distance_km);
        return time != null && d != null && Math.abs(time - start) <= 15 && Math.abs(d - duration) <= Math.max(5, duration * .08) &&
          (km == null || distance == null || Math.abs(km - distance) <= Math.max(.5, distance * .05));
      }).map(activity => ({ activity, score: 1, reason: 'same_practice_start_duration' }));
  }
  return Object.freeze({ MAX_BYTES, validateHeader, candidates });
});
