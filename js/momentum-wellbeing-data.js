/* CDC §17: preserve provenance, explicit clears, and incompatible scales. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentumWellbeingData = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const fields = { sleep_hours: 'sleep_hours', motivation: 'energy', resting_hr: 'rest_hr', hrv_ms: 'hrv', sleep_quality_value: null };
  const numeric = v => (typeof v === 'string' || typeof v === 'number') && v != null && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  function resolve(daily = {}, day = {}, preferences = {}) {
    daily ||= {}; day ||= {};
    const values = {}, sources = {}, alternatives = {};
    const corrections = daily.raw_data?.manual_corrections || {};
    for (const [field, legacyField] of Object.entries(fields)) {
      const candidates = [];
      if (Object.hasOwn(corrections, field)) candidates.push({ value: numeric(corrections[field]), source: 'user_correction', priority: 4 });
      if (numeric(daily[field]) != null) candidates.push({ value: numeric(daily[field]), source: daily.source || 'daily_wellbeing', priority: preferences[field] === daily.source ? 3 : 2 });
      if (legacyField && numeric(day[legacyField]) != null) candidates.push({ value: numeric(day[legacyField]), source: 'days', priority: preferences[field] === 'days' ? 3 : 1 });
      candidates.sort((a, b) => b.priority - a.priority);
      values[field] = candidates[0]?.value ?? null;
      sources[field] = candidates[0]?.source ?? null;
      alternatives[field] = candidates.slice(1);
    }
    return { values, sources, alternatives, sleep_quality_unit: Object.hasOwn(corrections, 'sleep_quality_value') ? 'qualitative-v1' : daily.sleep_quality_unit || null,
      note: day.note ?? null, context: (day.context_annotations || []).filter(v => ['illness', 'vacation', 'competition'].includes(v)),
      updated_at: daily.updated_at ?? null, day_version: day.revision ?? 0 };
  }
  return Object.freeze({ resolve });
});
