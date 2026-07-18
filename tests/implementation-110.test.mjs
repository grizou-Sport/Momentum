import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [flowSource, activitySource, sliderSource, wellbeingSource, homePage, progressionSource, homeSource, homeCoreSource, togetherSource, missionSource] = await Promise.all([
  readFile(new URL("../js/home-flow.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-activities.js", import.meta.url), "utf8"),
  readFile(new URL("../js/momentum-slider.js", import.meta.url), "utf8"),
  readFile(new URL("../js/momentum-wellbeing.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../js/home-progression.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-core.js", import.meta.url), "utf8"),
  readFile(new URL("../js/together.js", import.meta.url), "utf8"),
  readFile(new URL("../js/you-mission.js", import.meta.url), "utf8")
]);

function loadFlowApi() {
  const context = { console, document:{ addEventListener() {} }, window:{}, Date, Map, Number, Object, Math, Promise, Set };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(flowSource, context);
  return context.MomentumFlow;
}

test("FLOW groups exact coordinate overlaps without changing reported values", () => {
  const flow = loadFlowApi();
  const activities = [
    { id:"a", activity_date:"2026-07-10", activity_type:"Massage" },
    { id:"b", activity_date:"2026-07-11", activity_type:"Course" },
    { id:"c", activity_date:"2026-07-12", activity_type:"Yoga" }
  ];
  const assessments = new Map([
    ["a", { perceived_challenge:6, perceived_mastery:7 }],
    ["b", { perceived_challenge:6, perceived_mastery:7 }],
    ["c", { perceived_challenge:8, perceived_mastery:9 }]
  ]);
  const groups = flow.groupByCoordinates(activities, assessments);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.key === "6:7").activities.length, 2);
  assert.deepEqual(assessments.get("a"), { perceived_challenge:6, perceived_mastery:7 });
  assert.match(flowSource, /data-flow-group-activity/);
  assert.match(flowSource, /requestVersion/);
  assert.match(flowSource, /data-flow-action="retry"/);
});

test("the shared slider starts unset and owns all three required responses", () => {
  assert.match(sliderSource, /static formAssociated = true/);
  assert.match(sliderSource, /this\.currentValue = null/);
  assert.match(sliderSource, /setFormValue\(disabled \|\| missing \? null/);
  assert.equal((homePage.match(/<momentum-slider /g) || []).length, 3);
  assert.doesNotMatch(homePage, /name="(?:rpe|perceived_challenge|perceived_mastery)"[^>]*value="5"/);
  assert.match(homePage, /title="Effort physique"[^>]*min-label="Facile"[^>]*max-label="Maximal"/);
  assert.match(activitySource, /setFormValue\(form, "rpe", ""\)/);
});

test("wellbeing icons are centralized, complete and theme-compatible", async () => {
  assert.match(wellbeingSource, /id: "massage"[\s\S]*icon: "massage"/);
  assert.match(wellbeingSource, /console\.warn/);
  assert.match(activitySource, /populateWellbeingOptions/);
  assert.match(homeCoreSource, /MomentumWellbeing\?\.getIcon\(type\)/);
  assert.doesNotMatch(homeCoreSource, /render\("mobility"/);

  const iconNames = await readdir(new URL("../Assets/icons/wellbeing/", import.meta.url));
  assert.ok(iconNames.includes("massage.svg"));
  assert.ok(iconNames.includes("wellbeing.svg"));
  for (const iconName of iconNames) {
    const svg = await readFile(new URL(`../Assets/icons/wellbeing/${iconName}`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /stroke="currentColor"/);
    assert.doesNotMatch(svg, /stroke="#[0-9a-f]{3,6}"|fill="#[0-9a-f]{3,6}"/i);
  }
});

test("empty states remain distinct from loading and errors", () => {
  assert.match(flowSource, /Ta carte FLOW prendra forme au fil de tes Moments/);
  assert.match(flowSource, /La carte n’a pas pu être chargée/);
  assert.match(progressionSource, /Aucune donnée ne correspond à cette période/);
  assert.match(progressionSource, /data-progression-retry/);
  assert.match(togetherSource, /Ton Cercle est encore vide/);
  assert.match(togetherSource, /TOGETHER n’a pas pu être chargé/);
  assert.match(missionSource, /Ton Horizon n’est pas encore défini/);
  assert.match(missionSource, /Ton Horizon n’a pas pu être chargé/);
});

test("FLOW and Progression share the completed activity status", () => {
  assert.match(flowSource, /\.eq\("status", "done"\)/);
  assert.match(progressionSource, /\.in\("status", \["done", "planned"\]\)/);
  assert.match(progressionSource, /MomentumMoments\?\.isCompletedActivity/);
});
