import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const progressionSource = await readFile(new URL("../js/home-progression.js", import.meta.url), "utf8");
const homePage = await readFile(new URL("../index.html", import.meta.url), "utf8");

function loadWellbeingFunctions() {
  const context = {
    console,
    document: { addEventListener() {} },
    sleepQualityLevel(value) {
      if (value == null) return null;
      return Number(value) <= 5 ? Math.round(Number(value)) : Math.ceil(Number(value) / 20);
    },
    sleepQualityScore(value) {
      if (value == null) return null;
      return context.sleepQualityLevel(value) * 20;
    },
    sleepQualityLabel(value) {
      return ["", "Mauvais", "Moins bien", "Bien", "Très bien", "Excellent"][Math.round(Number(value))] || "—";
    },
    formatSleepDuration(hours) {
      const totalMinutes = Math.round(Number(hours) * 60);
      return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}min`;
    },
    dateFromIso(value) { return new Date(`${value}T12:00:00`); },
    addDays(date, amount) { const result = new Date(date); result.setDate(result.getDate() + amount); return result; },
    iso(date) { return date.toISOString().slice(0, 10); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(`${progressionSource}\n;globalThis.__wellbeingTest={mergeWellbeingDays,wellnessDefinition,wellnessChartValue,wellnessAxisValue};`, context);
  return context.__wellbeingTest;
}

test("wellbeing chart exposes resting heart rate and HRV with their real units", () => {
  const { wellnessDefinition, wellnessChartValue, wellnessAxisValue } = loadWellbeingFunctions();

  assert.equal(wellnessDefinition("restingHr").dataKey, "restingHr");
  assert.equal(wellnessDefinition("hrv").dataKey, "hrv");
  assert.equal(wellnessChartValue("restingHr", 48), "48 bpm");
  assert.equal(wellnessChartValue("hrv", 72), "72 ms");
  assert.equal(wellnessAxisValue("sleep", 8), "8 h");
  assert.equal(wellnessDefinition("motivation").scale.max, 10);
  assert.equal(wellnessDefinition("recovery").scale.max, 5);
  assert.match(homePage, /data-wellness-mode="restingHr"/);
  assert.match(homePage, /data-wellness-mode="hrv"/);
});

test("wellbeing series keeps raw display values and only normalizes the synthesis", () => {
  const { mergeWellbeingDays } = loadWellbeingFunctions();
  const [day] = mergeWellbeingDays([
    { recorded_date:"2026-07-15", sleep_hours:7.5, motivation:8, resting_hr:48, hrv_ms:72, sleep_quality_value:4, sleep_quality_unit:"qualitative-v1" }
  ], [], "2026-07-15", "2026-07-15");

  assert.equal(day.sleepHours, 7.5);
  assert.equal(day.motivation, 8);
  assert.equal(day.recovery, 4);
  assert.equal(day.restingHr, 48);
  assert.equal(day.hrv, 72);
  assert.equal(day.summary, (93.75 + 80 + 80) / 3);
});
