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
  vm.runInContext(`${source}\n;globalThis.__api={progressionState,progressionPeriodRange,progressionPeriodDateLabel,progressionGranularity,buildVolumeSeries,buildSportDistribution,buildLoadSeries,buildProgressionEvents};`,context);
  return context.__api;
}

test("standard periods distinguish rolling and civil ranges", () => {
  const { progressionPeriodRange, progressionPeriodDateLabel } = loadFunctions();
  const reference = new Date("2026-08-05T12:00:00");
  assert.deepEqual(
    JSON.parse(JSON.stringify(progressionPeriodRange("last-7-days",null,null,0,reference))),
    {start:"2026-07-30",end:"2026-08-05",label:"7 derniers jours"}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(progressionPeriodRange("current-week",null,null,0,reference))),
    {start:"2026-08-03",end:"2026-08-09",label:"Semaine"}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(progressionPeriodRange("last-4-weeks",null,null,-1,reference))),
    {start:"2026-06-11",end:"2026-07-08",label:"4 dernières semaines"}
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(progressionPeriodRange("current-month",null,null,1,reference))),
    {start:"2026-09-01",end:"2026-09-30",label:"Mois"}
  );
  assert.equal(progressionPeriodDateLabel("2026-08-03","2026-08-09"),"3 – 9 août");
  assert.equal(progressionPeriodDateLabel("2026-07-30","2026-08-05"),"30 juillet – 5 août");
});

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

test("volume groups completed activity time across the selected period", () => {
  const { progressionState, buildVolumeSeries } = loadFunctions();
  progressionState.periodStart="2026-08-03";
  progressionState.periodEnd="2026-08-09";
  progressionState.activities=[
    {status:"done",activity_date:"2026-08-03",duration_min:60,distance_km:10},
    {status:"done",activity_date:"2026-08-03",duration_min:30,distance_km:5},
    {status:"planned",activity_date:"2026-08-04",duration_min:120,distance_km:20}
  ];
  const series=buildVolumeSeries();
  assert.equal(series.length,7);
  assert.deepEqual(JSON.parse(JSON.stringify(series[0])),{date:"2026-08-03",hours:1.5,sessions:2,distance:15});
  assert.equal(series[1].hours,0);
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
