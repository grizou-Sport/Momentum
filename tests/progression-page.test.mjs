import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [home, progression, navigation] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../progression.html", import.meta.url), "utf8"),
  readFile(new URL("../js/navigation.js", import.meta.url), "utf8")
]);

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
  for (const id of ["volumeChart", "fitnessChart", "sportChart", "wellnessChart"]) {
    assert.match(progression, new RegExp(`id="${id}"`));
  }
  assert.match(progression, /js\/home-progression\.js/);
  assert.match(progression, /chart\.js/);
  assert.match(progression, /data-momentum-page="progression"/);
});

test("shared navigation treats Progression as a first-level destination", () => {
  assert.match(navigation, /railLink\("progression", "progression\.html", "Progression"\)/);
  assert.match(navigation, /\["flow", "Flow", "index\.html#flow"\]/);
  assert.doesNotMatch(navigation, /index\.html#progression/);
});
