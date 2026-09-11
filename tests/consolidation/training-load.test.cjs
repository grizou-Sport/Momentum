const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('../../js/momentum-training-load.js');
const run = (overrides = {}) => ({ id: 'a', user_id: 'A', activity_date: '2026-07-01', status: 'done', sport: 'running', duration_min: 60, rpe: 6, ...overrides });
const build = (rows, asOf = '2026-07-01', options = {}) => load.build(rows, { asOf, complete: true, userId: 'A', ...options });
test('DAT-01/02: an hour running plus an hour of massage yields 60 load, 120 volume', () => {
  const rows = [run(), run({ id: 'massage', sport: 'massage', rpe: null })];
  assert.equal(rows.reduce((sum, row) => sum + row.duration_min, 0), 120);
  const result = build(rows); assert.equal(result.days[0].known_load, 60);
  assert.equal(result.coverage.excluded, 1); assert.equal(result.coverage.missing.length, 0);
  assert.equal(result.days[0].chronic, 60 / 42); assert.equal(result.days[0].recent, 60 / 7);
});
test('DAT-03/05/09: absent and undetermined inputs never produce a flat personal curve', () => {
  for (const rpe of [null, '', ' ']) {
    const result = build([run({ rpe })]); assert.equal(result.days[0].chronic, null);
    assert.equal(result.days[0].complete_recorded_load, null); assert.equal(result.coverage.missing[0].reason, 'missing_rpe');
  }
  for (const sport of ['a new practice', 'other', 'yoga', 'mobility', 'stretching']) assert.equal(load.eligibility(run({ sport })).state, 'undetermined');
  assert.equal(load.eligibility(run({ sport: 'yoga', practice_variant: 'active', activity_category: 'wellbeing' })).state, 'eligible');
  assert.equal(build([]).has_calculable, false);
});
test('DAT-04/10/13: gaps persist beyond 42 days and disappear only after correction', () => {
  const rows = [run({ rpe: null }), run({ id: 'later', activity_date: '2026-07-02' })];
  const result = build(rows, '2026-09-10'); assert.equal(result.source_start, '2026-07-01');
  assert.equal(result.days.at(-1).partial, true); assert.equal(result.days[0].chronic, null);
  const corrected = build([run(), rows[1]], '2026-09-10'); assert.equal(corrected.days.at(-1).partial, false);
});
test('DAT-06: historical effort 5 is preserved with undocumented provenance', () => {
  const input = run({ rpe: 5 }); const before = JSON.stringify(input);
  const entry = load.activityLoad(input); assert.equal(entry.load, 50); assert.equal(entry.rpe_source, 'undocumented'); assert.equal(JSON.stringify(input), before);
});
test('DAT-07/08/11/12: deterministic history, decay in empty weeks, no future extrapolation', () => {
  const rows = [run(), run({ id: 'future', activity_date: '2026-07-20' })];
  const early = build(rows, '2026-07-08'), later = build(rows, '2026-07-15');
  assert.deepEqual(later.days.slice(0, early.days.length), early.days);
  assert.equal(early.days.at(-1).data_state, 'no_activity_recorded');
  assert.ok(early.days.at(-1).chronic > 0); assert.equal(later.days.at(-1).date, '2026-07-15');
});
test('DAT-14: an incomplete history never yields a new series', () => {
  const result = build([run()], '2026-07-01', { complete: false });
  assert.equal(result.status, 'incomplete_history'); assert.deepEqual(result.days, []);
});
test('MOM-20: planned, foreign, duplicated and child records do not contribute', () => {
  const rows = [run(), run(), run({ id: 'planned', status: 'planned' }), run({ id: 'B', user_id: 'B' }), run({ id: 'child', parent_activity_id: 'a' }), run({ id: 'duplicate', duplicate_of: 'a' })];
  assert.equal(build(rows).days[0].known_load, 60);
});
test('Duration provenance: timer first, deliberate manual correction overrides timer', () => {
  assert.equal(load.activityLoad(run({ timer_duration_seconds: 1800, elapsed_duration_seconds: 7200 })).load, 30);
  assert.equal(load.activityLoad(run({ timer_duration_seconds: 1800, duration_source: 'manual', duration_min: 90 })).load, 90);
});
test('Invalid values and impossible dates stay invalid', () => {
  for (const rpe of [0, 11, -1, 1.2, 'NaN', false, []]) assert.equal(load.activityLoad(run({ rpe })).reason, 'invalid_input');
  for (const duration_min of [0, -1, 'bad']) assert.equal(load.activityLoad(run({ duration_min })).reason, 'invalid_input');
  assert.equal(load.dateKey('2026-02-30'), null); assert.equal(load.dateKey('2024-02-29'), '2024-02-29');
  assert.throws(() => load.build([]));
});
