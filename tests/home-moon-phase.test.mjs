import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [source, calendarSource, homeSource, homePage, styles] = await Promise.all([
  readFile(new URL("../js/home-weather.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-calendar.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../css/home.css", import.meta.url), "utf8")
]);

function loadMoonFunctions() {
  const context = { console, Date, Intl, Math, URLSearchParams };
  vm.createContext(context);
  vm.runInContext(
    `${source}\n;globalThis.__moonTest = { getMoonPhase, formatMoonDate, moonPhaseSvg, moonForCalendarDate, moonTriggerHtml };`,
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

test("the lunar calendar uses a monochrome SVG instead of emoji", () => {
  const { getMoonPhase, moonPhaseSvg, moonTriggerHtml } = loadMoonFunctions();
  const moon = getMoonPhase(new Date("2026-08-01T12:00:00Z"));
  const icon = moonPhaseSvg(moon);
  const trigger = moonTriggerHtml("2026-08-01");

  assert.match(icon, /<svg class="moon-phase-icon"/);
  assert.doesNotMatch(source, /[🌑🌒🌓🌔🌕🌖🌗🌘]/u);
  assert.match(trigger, /data-moon-date="2026-08-01"/);
});

test("HOME moves lunar details from the Today card into every living-day card", () => {
  assert.doesNotMatch(homePage, /id="moonCard"/);
  assert.doesNotMatch(homeSource, /renderMoonCard/);
  assert.match(calendarSource, /moonTriggerHtml\(dateIso\)/);
  assert.match(homePage, /id="moonDialog"/);
  assert.match(homeSource, /openMoonDialog\(moonTrigger\.dataset\.moonDate\)/);
  assert.match(styles, /\.living-moon-trigger/);
});

test("the phase exposes illumination and the next full moon", () => {
  const { getMoonPhase } = loadMoonFunctions();
  const date = new Date("2026-08-01T12:00:00Z");
  const moon = getMoonPhase(date);

  assert.ok(moon.illumination >= 0 && moon.illumination <= 100);
  assert.ok(moon.nextFullMoon > date);
  assert.ok(moon.nextFullMoon - date < 30 * 86400000);
});
