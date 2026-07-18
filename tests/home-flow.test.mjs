import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [flowSource, homePage, activitySource, calendarSource, homeSource, importSource, migration, implementation109Migration, durationSource] = await Promise.all([
  readFile(new URL("../js/home-flow.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../js/home-activities.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-calendar.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-import.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260718000100_flow_module_v1.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260718000200_moment_form_and_shared_duration.sql", import.meta.url), "utf8"),
  readFile(new URL("../js/momentum-duration-picker.js", import.meta.url), "utf8")
]);

function loadFlowPublicApi() {
  const context = {
    console,
    document:{ addEventListener() {} },
    window:{},
    Date,
    Map,
    Number,
    Object,
    Math,
    Promise,
    Set
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(flowSource, context);
  return context.MomentumFlow;
}

test("FLOW exposes the definitive nine-zone vocabulary", () => {
  const flow = loadFlowPublicApi();
  assert.equal(flow.zone(9, 9), "flow");
  assert.equal(flow.zone(9, 2), "explorer");
  assert.equal(flow.zone(9, 5), "se-depasser");
  assert.equal(flow.zone(5, 2), "apprendre");
  assert.equal(flow.zone(5, 9), "maitriser");
  assert.equal(flow.zone(2, 2), "recuperer");
  assert.equal(flow.zone(2, 5), "routine");
  assert.equal(flow.zone(2, 9), "relaxation");

  for (const label of ["Explorer", "Se dépasser", "FLOW", "Apprendre", "Maîtriser", "Récupérer", "Routine", "Relaxation"]) {
    assert.match(homePage, new RegExp(label));
  }
});

test("FLOW positions points exclusively from reported challenge and mastery", () => {
  assert.match(flowSource, /flowCoordinate\(assessment\.perceived_mastery\)/);
  assert.match(flowSource, /flowCoordinate\(assessment\.perceived_challenge\)/);
  assert.doesNotMatch(flowSource, /flowCoordinate\([^)]*(?:fit|load|weather|rpe)/i);
  assert.match(flowSource, /function buildFlowAnalysisContext/);
  assert.match(flowSource, /const exertion = Number\(activity\.rpe/);
  assert.doesNotMatch(homePage, /Flow Score|Momentum Score/);
});

test("the three experience questions are part of the single Moment form", () => {
  for (const question of ["Effort physique", "Défi", "Maîtrise"]) {
    assert.match(homePage, new RegExp(question));
  }
  assert.match(homePage, /data-activity-experience/);
  assert.match(homePage, /Enregistrer le Moment/);
  assert.match(activitySource, /completed \? numberOrNull\(values, "rpe"\) : null/);
  assert.match(activitySource, /from\("activity_flow_assessments"\)[\s\S]*\.upsert\(assessmentPayload/);
  assert.match(activitySource, /\.select\("id"\)\s*\.single\(\)/);
  assert.doesNotMatch(homePage, /id="flowAssessmentDialog"/);
  assert.doesNotMatch(activitySource, /offerAssessment/);
});

test("FLOW remains an analysis model and editing returns to the Moment", () => {
  assert.doesNotMatch(homePage, /id="flowPendingDialog"/);
  assert.doesNotMatch(flowSource, /openFlowAssessment|saveFlowAssessment/);
  assert.match(flowSource, /data-flow-action="edit-moment"/);
  assert.match(flowSource, /openEditActivityDialog\(activity\.id\)/);
  assert.doesNotMatch(calendarSource, /Raconter mon FLOW/);
  assert.doesNotMatch(homeSource, /MomentumFlow\.openAssessment/);
});

test("FLOW persistence is isolated, constrained and owner-protected", () => {
  assert.match(migration, /create table if not exists public\.activity_flow_assessments/);
  assert.match(migration, /perceived_exertion between 1 and 10/);
  assert.match(migration, /perceived_challenge between 1 and 10/);
  assert.match(migration, /perceived_mastery between 1 and 10/);
  assert.match(migration, /analysis_context jsonb/);
  assert.match(migration, /alter table public\.activity_flow_assessments enable row level security/);
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /activities\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(implementation109Migration, /set rpe = assessment\.perceived_exertion/);
  assert.match(implementation109Migration, /drop column if exists perceived_exertion/);
  assert.match(activitySource, /rpe:\s*completed \? numberOrNull/);
  assert.doesNotMatch(flowSource, /update\(\{ rpe:/);
});

test("all visible duration inputs use the shared minute-based component", () => {
  assert.match(durationSource, /class DurationPicker extends HTMLElement/);
  assert.match(durationSource, /\^\\d\+\$/);
  assert.match(durationSource, /Number\(match\[1\]\) \* 60/);
  assert.match(homePage, /<duration-picker name="duration_min"/);
  assert.match(homePage, /<duration-picker name="sleepDuration"/);
  assert.doesNotMatch(homePage, /duration_hours|duration_minutes|sleepHours|sleepMinutes/);
});

test("FIT ingestion prepares the internal analysis layer without moving FLOW points", () => {
  for (const capability of [
    "fitHeartRateZones",
    "fitCardiacDrift",
    "power_watts",
    "cadence_rpm",
    "temperature_celsius",
    "training_stress_score",
    "fit_analysis"
  ]) assert.match(importSource, new RegExp(capability));
});
