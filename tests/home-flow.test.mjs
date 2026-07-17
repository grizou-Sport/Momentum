import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [flowSource, homePage, activitySource, importSource, migration] = await Promise.all([
  readFile(new URL("../js/home-flow.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../js/home-activities.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-import.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260718000100_flow_module_v1.sql", import.meta.url), "utf8")
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
  assert.match(flowSource, /analysis_context:buildFlowAnalysisContext/);
  assert.doesNotMatch(homePage, /Flow Score|Momentum Score/);
});

test("the three-question assessment is offered after a completed activity", () => {
  for (const question of [
    "Quel effort physique cette activité t'a demandé",
    "Quel niveau de défi as-tu ressenti",
    "À quel point t'es-tu senti en maîtrise"
  ]) assert.match(homePage, new RegExp(question));

  assert.match(homePage, /id="flowAssessmentLater"/);
  assert.match(activitySource, /window\.MomentumFlow\.offerAssessment/);
  assert.match(activitySource, /payload\.status === "done"/);
  assert.match(activitySource, /\.select\("id"\)\s*\.single\(\)/);
  assert.doesNotMatch(homePage, />RPE</);
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
