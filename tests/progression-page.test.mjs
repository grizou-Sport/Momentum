import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [home, progression, navigation] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../progression.html", import.meta.url), "utf8"),
  readFile(new URL("../js/navigation.js", import.meta.url), "utf8")
]);
const progressionScript = await readFile(new URL("../js/home-progression.js", import.meta.url), "utf8");

test("HOME remains focused on the day and reserves Flow without analytics", () => {
  assert.match(home, /id="hero"/);
  assert.match(home, /id="today"/);
  assert.match(home, /id="journal"/);
  assert.match(home, /id="flow"/);
  assert.doesNotMatch(home, /id="volumeChart"/);
  assert.doesNotMatch(home, /id="fitnessChart"/);
  assert.doesNotMatch(home, /id="sportChart"/);
  assert.doesNotMatch(home, /id="wellnessChart"/);
  assert.doesNotMatch(home, /home-progression\.js/);
  assert.doesNotMatch(home, /chart\.js/);
});

test("Progression owns every existing analytical view and its dependencies", () => {
  for (const id of ["fitnessChart", "sportChart", "wellnessChart"]) {
    assert.match(progression, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(progression, /id="volumeChart"/);
  assert.match(progression, /Où ai-je passé mon temps/);
  assert.match(progression, /Comment évolue ma charge d’entraînement/);
  assert.match(progression, /Comment me suis-je senti durant cette période/);
  assert.match(progression, /js\/home-progression\.js/);
  assert.match(progression, /chart\.js/);
  assert.match(progression, /data-momentum-page="progression"/);

  const wellbeingDependency = progression.indexOf('src="js/home-wellbeing.js"');
  const progressionModule = progression.indexOf('src="js/home-progression.js"');
  assert.ok(wellbeingDependency > -1, "Progression doit charger les normalisateurs du bien-être");
  assert.ok(
    wellbeingDependency < progressionModule,
    "Les normalisateurs du bien-être doivent être disponibles avant le rendu des graphiques"
  );
});

test("Progression V1 separates distribution modes and wellbeing filter families", () => {
  assert.match(progression, /data-volume-mode="time"/);
  assert.match(progression, /data-volume-mode="distance"/);
  assert.match(progression, />Ressenti</);
  assert.match(progression, />Mesures physiologiques</);
  assert.doesNotMatch(progression, /data-wellness-mode="recovery"/);
});

test("Progression only queries completed activities and keeps the full history for load", () => {
  assert.match(progressionScript, /\.eq\("status", "done"\)/);
  assert.doesNotMatch(progressionScript, /\["done", "planned"\]/);
  assert.match(progressionScript, /historyActivities/);
  assert.match(progressionScript, /Charge chronique \(CTL\)/);
  assert.match(progressionScript, /Fatigue \(ATL\)/);
  assert.match(progressionScript, /Forme \(TSB\)/);
});

test("shared navigation treats Progression as a first-level destination", () => {
  assert.match(navigation, /railLink\("progression", "progression\.html", "Progression"\)/);
  assert.match(navigation, /\["flow", "Flow", "index\.html#flow"\]/);
  assert.doesNotMatch(navigation, /index\.html#progression/);
});

test("Progression waits for the protected session and surfaces loading failures", () => {
  assert.match(progressionScript, /await window\.momentumPageReady/);
  assert.match(progressionScript, /Les indicateurs n’ont pas pu être chargés/);
  assert.match(progressionScript, /PROGRESSION : impossible de charger les indicateurs/);
});
