import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the triangle is the shared brand and the contextual rail has protected themes", () => {
  const navigation = read("js/navigation.js");
  const css = read("css/navigation.css");
  const home = read("index.html");
  assert.match(navigation, /momentum-nav-brand[^>]+>△<\/a>/);
  assert.doesNotMatch(navigation, /momentum-nav-brand[^>]+>M<\/a>/);
  assert.match(navigation, /analysePhotographicSection/);
  assert.match(home, /data-nav-theme="light" data-nav-luminance/);
  assert.match(css, /data-theme="light"/);
  assert.match(css, /backdrop-filter:blur\(20px\)/);
});

test("legacy topbar styles are gone and settings live inside YOU", () => {
  const styles = ["css/style.css","css/home.css","css/you.css","css/together.css"].map(read).join("\n");
  const navigation = read("js/navigation.js");
  const you = read("js/you.js");
  assert.doesNotMatch(styles, /\.topbar\b/);
  assert.doesNotMatch(navigation, /Paramètres bientôt disponibles/);
  assert.match(you, /<span class="you-kicker">Paramètres<\/span>/);
});

test("Progression exposes accessible tables, definitions and persisted preferences", () => {
  const html = read("progression.html");
  const script = read("js/home-progression.js");
  for (const id of ["sportChartTable","fitnessChartTable","wellnessChartTable"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.equal((html.match(/<canvas[^>]+role="img"/g) || []).length, 3);
  assert.match(html, /Comprendre les indicateurs/);
  assert.match(html, /Charge aiguë/);
  assert.match(script, /momentum_progression_preferences_v1/);
  assert.match(script, /data-progression-detail/);
});

test("auth and TOGETHER tabs implement the keyboard tab pattern", () => {
  const authHtml = read("login.html");
  const auth = read("js/auth.js");
  const togetherHtml = read("together.html");
  const together = read("js/together.js");
  assert.match(authHtml, /role="tabpanel" aria-labelledby="loginTab"/);
  assert.match(auth, /ArrowLeft.*ArrowRight.*Home.*End/);
  assert.match(togetherHtml, /role="tabpanel" aria-labelledby="circleTab"/);
  assert.match(together, /item\.tabIndex = active \? 0 : -1/);
});

test("YOU uses full birth dates, partial errors and declared sources", () => {
  const you = read("js/you.js");
  const passport = read("js/you-passport.js");
  assert.match(you, /birthdayPassed/);
  assert.match(you, /loadErrors/);
  assert.doesNotMatch(you, /console\.log/);
  assert.match(passport, /Sources déclarées/);
});

test("YOU resolves Massage from the wellbeing icon collection", () => {
  const profile = read("js/you-sport-profile.js");
  const sports = read("js/you-sports.js");
  assert.match(profile, /MomentumWellbeing\?\.resolve\(value\)/);
  assert.match(profile, /iconCollection: wellbeing \? "wellbeing" : "sports"/);
  assert.match(sports, /collection: sport\.iconCollection \|\| "sports"/);
  assert.doesNotMatch(sports, /renderSport\(sport\.id/);
});

test("technical errors, native dialogs and dead legal links are removed from active scripts", () => {
  const scripts = ["js/together.js","js/home-activities.js","js/home-wellbeing.js","js/you-equipment.js","js/you-mission.js","js/you-passport.js","js/you-wellbeing.js"].map(read).join("\n");
  const login = read("login.html");
  assert.doesNotMatch(scripts, /error\.message/);
  assert.doesNotMatch(scripts, /window\.(alert|confirm|prompt)\(/);
  assert.doesNotMatch(login, /data-legal|href="#"/);
  assert.match(read("conditions.html"), /Version :<\/strong> 0\.1/);
  assert.match(read("confidentialite.html"), /Entrée en vigueur prévue/);
});

test("all user-facing pages point to the real favicon", () => {
  for (const page of ["index.html","progression.html","together.html","you.html","login.html","welcome.html","conditions.html","confidentialite.html"]) {
    assert.match(read(page), /Assets\/icons\/favicon\.svg/, page);
  }
  assert.match(read("Assets/icons/favicon.svg"), /<path[^>]+stroke="#fff"/);
});
