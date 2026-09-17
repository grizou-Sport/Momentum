/* Pure, deterministic rules for CDC §15. No DOM, network, or physiological inference. */
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentumTrainingLoad = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const VERSION = 'recorded-load-v1', UNIT = 'unités MOMENTUM';
  // Explicit catalogue. Unknown practices never inherit eligibility from a category.
  const eligible = new Set('running trail_running walking hiking trekking cycling gravel_cycling mountain_biking electric_cycling bikepacking indoor_cycling swimming open_water_swimming triathlon duathlon swimrun mountaineering climbing via_ferrata alpine_skiing ski_touring cross_country_skiing snowboarding snowshoeing ice_climbing surfing kitesurfing wing_foil windsurfing stand_up_paddle canoeing kayaking rowing sailing diving strength_training fitness crossfit hyrox weightlifting street_workout pilates tennis padel badminton squash table_tennis football futsal basketball volleyball handball rugby ice_hockey field_hockey baseball softball boxing kickboxing mma judo karate taekwondo jiu_jitsu wrestling fencing golf archery sport_shooting petanque disc_golf bowling horse_riding dance ice_skating roller_skating skateboarding yoga_active mobility_active stretching_active'.split(' '));
  const passive = new Set('massage nap physiotherapy osteopathy sauna cold_bath cryotherapy meditation breathing recovery sleep yoga_passive mobility_passive stretching_passive'.split(' '));
  const ambiguous = new Set(['yoga', 'mobility', 'stretching']);
  function absent(value) { return value == null || typeof value === 'string' && value.trim() === ''; }
  function number(value) {
    if (absent(value) || !['number', 'string'].includes(typeof value)) return null;
    const n = Number(value); return Number.isFinite(n) ? n : null;
  }
  function dateKey(value) {
    if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  function daysBetween(a, b) {
    if (!dateKey(a) || !dateKey(b)) throw new RangeError('Dates invalides.');
    return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  }
  function add(date, days) { return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
  function eligibility(activity) {
    const practice = String(activity?.practice_id || activity?.sport || activity?.activity_type || '').trim().toLowerCase();
    let state = passive.has(practice) ? 'excluded' : eligible.has(practice) ? 'eligible' : 'undetermined';
    if (ambiguous.has(practice)) {
      state = activity.practice_variant === 'active' ? 'eligible' : activity.practice_variant === 'passive' ? 'excluded' : 'undetermined';
    }
    return { practice, state, reason: state === 'eligible' ? null : state === 'excluded' ? 'excluded' : 'undetermined_type' };
  }
  function effortDuration(activity) {
    const manual = activity?.duration_source === 'manual';
    const useTimer = !manual && !absent(activity?.timer_duration_seconds);
    const value = useTimer ? activity.timer_duration_seconds : activity?.duration_min;
    const n = number(value);
    return { minutes: n != null && n > 0 ? n / (useTimer ? 60 : 1) : null,
      source: useTimer ? 'timer' : activity?.duration_source || 'duration_min',
      reason: absent(value) ? 'missing_duration' : n == null || n <= 0 ? 'invalid_input' : null };
  }
  function inScope(activity, userId) {
    return activity?.status === 'done' && !activity.duplicate_of && !activity.parent_activity_id &&
      !activity.is_duplicate && activity.is_personal !== false && activity.source !== 'collective' &&
      (!userId || activity.user_id === userId);
  }
  function activityLoad(activity) {
    const e = eligibility(activity), d = effortDuration(activity), rpe = number(activity?.rpe);
    const entry = { id: activity?.id ?? null, date: dateKey(activity?.activity_date), practice: e.practice,
      eligibility: e.state, reason: e.reason, load: null, duration_min: d.minutes, duration_source: d.source,
      rpe, rpe_source: activity?.rpe_source || 'undocumented' };
    if (!inScope(activity)) return { ...entry, eligibility: 'excluded', reason: 'not_completed_personal' };
    if (e.state !== 'eligible') return entry;
    if (d.reason) return { ...entry, reason: d.reason };
    if (absent(activity.rpe)) return { ...entry, reason: 'missing_rpe' };
    if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ...entry, reason: 'invalid_input' };
    return { ...entry, reason: null, load: d.minutes * rpe / 6 };
  }
  function coverage(entries) {
    const result = { eligible: 0, calculable: 0, excluded: 0, undetermined: 0, undocumented: 0, missing: [] };
    for (const entry of entries || []) {
      if (entry.eligibility === 'excluded') { result.excluded++; continue; }
      if (entry.eligibility === 'undetermined') { result.undetermined++; result.missing.push(entry); continue; }
      result.eligible++;
      if (entry.load == null) result.missing.push(entry); else result.calculable++;
      if (entry.rpe != null && entry.rpe_source === 'undocumented') result.undocumented++;
    }
    return result;
  }
  function build(activities, { asOf, complete = false, userId } = {}) {
    if (!dateKey(asOf)) throw new RangeError('Une date de calcul valide est requise.');
    const base = { version: VERSION, unit: UNIT, as_of: asOf, source_start: null, history_days: 0,
      days: [], coverage: coverage([]), has_calculable: false, status: 'incomplete_history' };
    if (complete !== true || !Array.isArray(activities)) return base;
    const ids = new Set(), hashes = new Set();
    const rows = activities.filter(a => inScope(a, userId) && dateKey(a.activity_date) && a.activity_date <= asOf)
      .slice().sort((a, b) => a.activity_date.localeCompare(b.activity_date) || String(a.id).localeCompare(String(b.id)))
      .filter(a => {
        const key = `${a.user_id || userId || ''}:${a.id}`, hash = a.source_hash ? `${a.user_id || userId || ''}:${a.source_hash}` : null;
        if (a.id != null && ids.has(key) || hash && hashes.has(hash)) return false;
        if (a.id != null) ids.add(key); if (hash) hashes.add(hash); return true;
      });
    const entries = rows.map(activityLoad), allCoverage = coverage(entries);
    const start = entries.find(e => e.eligibility !== 'excluded')?.date;
    if (!start) return { ...base, status: 'complete', coverage: allCoverage };
    const byDate = new Map();
    for (const entry of entries) { if (!byDate.has(entry.date)) byDate.set(entry.date, []); byDate.get(entry.date).push(entry); }
    let chronic = 0, recent = 0, partial = false, hasCalculable = false;
    const days = [];
    for (let date = start; date <= asOf; date = add(date, 1)) {
      const items = byDate.get(date) || [], quality = coverage(items);
      if (quality.missing.length) partial = true;
      if (quality.calculable) hasCalculable = true;
      const known = items.reduce((sum, e) => sum + (e.load ?? 0), 0);
      chronic += (known - chronic) / 42; recent += (known - recent) / 7;
      days.push({ date, known_load: known, complete_recorded_load: quality.missing.length ? null : known,
        chronic: hasCalculable ? chronic : null, recent: hasCalculable ? recent : null,
        balance: hasCalculable ? chronic - recent : null, partial, entries: items, coverage: quality,
        data_state: !items.length ? 'no_activity_recorded' : quality.missing.length ? 'partial' : 'complete',
        loading_state: 'complete' });
    }
    return { ...base, source_start: start, history_days: days.length, days, coverage: allCoverage,
      has_calculable: hasCalculable, status: partial ? 'partial' : 'complete' };
  }
  const requiresVariant = practice => ambiguous.has(String(practice || '').trim().toLowerCase());
  return Object.freeze({ VERSION, UNIT, number, dateKey, daysBetween, requiresVariant, eligibility, effortDuration, activityLoad, coverage, build });
});
