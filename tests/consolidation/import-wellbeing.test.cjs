const { test } = require('node:test'); const assert = require('node:assert/strict');
const imports = require('../../js/momentum-import-rules.js'); const wellbeing = require('../../js/momentum-wellbeing-data.js');
test('MOM-14: missing measures and missing hours do not establish a probable duplicate', () => {
  const old = { id: 'a', sport: 'running', activity_date: '2026-09-01', duration_min: null, distance_km: null };
  assert.deepEqual(imports.candidates({ ...old, id: 'b' }, [old]), []);
  const measured = { ...old, duration_min: 60, activity_time: '10:00', distance_km: 10 };
  assert.equal(imports.candidates({ ...measured, id: 'b', activity_time: '10:05' }, [measured]).length, 1);
  assert.equal(imports.candidates({ ...measured, id: 'b', sport: 'cycling' }, [measured]).length, 0);
});
test('MOM-17: reject renamed binaries, truncated FIT and XML entities', () => {
  assert.throws(() => imports.validateHeader('activity.fit', new Uint8Array(20)));
  assert.throws(() => imports.validateHeader('activity.gpx', new TextEncoder().encode('<!DOCTYPE gpx><gpx/>')));
  assert.throws(() => imports.validateHeader('activity.exe', new Uint8Array(20)));
  assert.equal(imports.validateHeader('activity.gpx', new TextEncoder().encode('<?xml version="1.0"?><gpx version="1.1"></gpx>')), true);
});
test('DAT-21/22: daily source wins, user choice wins, explicit clear stays null', () => {
  const daily = { sleep_hours: 7, source: 'watch', sleep_quality_value: 82, sleep_quality_unit: '%' };
  const day = { sleep_hours: 6, energy: 8 };
  const resolved = wellbeing.resolve(daily, day); assert.equal(resolved.values.sleep_hours, 7); assert.equal(resolved.sources.sleep_hours, 'watch');
  assert.equal(resolved.values.motivation, 8); assert.equal(resolved.alternatives.sleep_hours[0].value, 6);
  assert.equal(wellbeing.resolve(daily, day, { sleep_hours: 'days' }).values.sleep_hours, 6);
  assert.equal(wellbeing.resolve({ ...daily, raw_data: { manual_corrections: { sleep_hours: null } } }, day).values.sleep_hours, null);
  assert.equal(resolved.sleep_quality_unit, '%'); assert.equal(wellbeing.resolve().values.hrv_ms, null);
});
test('DAT-23: free text never generates a health annotation', () => {
  assert.deepEqual(wellbeing.resolve(null, { note: 'Je ne suis pas malade' }).context, []);
  assert.deepEqual(wellbeing.resolve(null, { context_annotations: ['illness', 'invented'] }).context, ['illness']);
});
