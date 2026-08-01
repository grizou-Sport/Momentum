import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../js/home-weather.js", import.meta.url), "utf8");

function loadMoonFunctions() {
  const context = { console, Date, Intl, Math, URLSearchParams };
  vm.createContext(context);
  vm.runInContext(
    `${source}\n;globalThis.__moonTest = { getMoonPhase, formatMoonDate };`,
    context
  );
  return context.__moonTest;
}

test("the lunar reference date is a new moon", () => {
  const { getMoonPhase } = loadMoonFunctions();
  const moon = getMoonPhase(new Date("2000-01-06T18:14:00Z"));

  assert.equal(moon.name, "Nouvelle lune");
  assert.equal(moon.illumination, 0);
});

test("the phase exposes illumination and the next full moon", () => {
  const { getMoonPhase } = loadMoonFunctions();
  const date = new Date("2026-08-01T12:00:00Z");
  const moon = getMoonPhase(date);

  assert.ok(moon.illumination >= 0 && moon.illumination <= 100);
  assert.ok(moon.nextFullMoon > date);
  assert.ok(moon.nextFullMoon - date < 30 * 86400000);
});
