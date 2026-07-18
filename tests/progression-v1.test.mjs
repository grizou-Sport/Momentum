import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../js/home-progression.js", import.meta.url), "utf8");

function loadFunctions() {
  const context = {
    console,
    document:{ addEventListener() {} },
    window:{
      MomentumMoments:{ isCompletedActivity:(activity) => activity.status === "done" },
      MomentumSportVisuals:{ getGroup:(sport, category) => ({ id:category === "wellbeing" ? "wellbeing" : sport, label:sport, color:"#273c31" }) },
      MomentumSports:{ getLabel:(_sport, type) => type }
    },
    dateFromIso:(value) => new Date(`${value}T12:00:00`),
    addDays:(date, amount) => { const copy=new Date(date); copy.setDate(copy.getDate()+amount); return copy; },
    iso:(date) => date.toISOString().slice(0,10)
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.__api={progressionState,progressionGranularity,buildSportDistribution,buildLoadSeries,buildProgressionEvents};`,context);
  return context.__api;
}

test("temporal granularity changes from days to weeks to months", () => {
  const { progressionState, progressionGranularity } = loadFunctions();
  progressionState.periodStart="2026-07-01";
  progressionState.periodEnd="2026-07-07";
  assert.equal(progressionGranularity(),"day");
  progressionState.periodEnd="2026-09-01";
  assert.equal(progressionGranularity(),"week");
  progressionState.periodEnd="2027-01-31";
  assert.equal(progressionGranularity(),"month");
});

test("distance distribution excludes activities without distance and sorts descending", () => {
  const { progressionState, buildSportDistribution } = loadFunctions();
  progressionState.mode="distance";
  progressionState.activities=[
    {status:"done",sport:"Course",activity_category:"sport",duration_min:60,distance_km:10},
    {status:"done",sport:"Vélo",activity_category:"sport",duration_min:90,distance_km:45},
    {status:"done",sport:"Massage",activity_category:"wellbeing",duration_min:30,distance_km:null},
    {status:"planned",sport:"Course",activity_category:"sport",duration_min:60,distance_km:20}
  ];
  const groups=buildSportDistribution();
  assert.deepEqual(Array.from(groups, (group) => group.label),["Vélo","Course"]);
  assert.equal(groups[0].distance,45);
});

test("load computation starts at the first completed activity in full history", () => {
  const { progressionState, buildLoadSeries } = loadFunctions();
  progressionState.periodStart="2026-07-01";
  progressionState.periodEnd="2026-07-07";
  progressionState.passport={habits:{weekly_hours:3,weekly_sessions:3}};
  progressionState.historyActivities=[
    {status:"done",activity_date:"2026-05-01",duration_min:60,rpe:5},
    {status:"done",activity_date:"2026-07-03",duration_min:60,rpe:6}
  ];
  const series=buildLoadSeries();
  assert.equal(series[0].date,"2026-05-01");
  assert.ok(series.some((day) => day.date === "2026-07-03"));
  assert.ok(series.length > 60);
});

test("important recorded events are exposed without changing activity data", () => {
  const { buildProgressionEvents } = loadFunctions();
  const events=buildProgressionEvents([
    {activity_date:"2026-07-01",activity_category:"adventure",activity_type:"Traversée"},
    {activity_date:"2026-07-02",activity_category:"wellbeing",activity_type:"Massage"}
  ],[{day_date:"2026-07-03",note:"Début des vacances"}]);
  assert.match(events.get("2026-07-01")[0],/Aventure/);
  assert.match(events.get("2026-07-02")[0],/Massage/);
  assert.deepEqual(Array.from(events.get("2026-07-03")),["Vacances"]);
});
