import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [timelineSource, importSource, activitySource, migration, homePage, architecture] = await Promise.all([
  readFile(new URL("../js/activity-timeline.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-import.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-activities.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260720000100_activity_timeline_b1.sql", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../docs/Architecture_Activity_Timeline.md", import.meta.url), "utf8")
]);

function loadTimeline() {
  const context = { console, Date, Math, Number, Object, Set };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(timelineSource, context);
  return context.MomentumTimeline;
}

test("the timeline reconstructs objective FIT events in chronological order", () => {
  const timeline = loadTimeline().build({
    startTime:"2026-07-20T07:12:00.000Z",
    endTime:"2026-07-20T08:12:00.000Z",
    laps:[
      {
        number:1,
        startTime:"2026-07-20T07:12:00.000Z",
        endTime:"2026-07-20T07:42:00.000Z",
        totalElapsedSeconds:1800,
        totalTimerSeconds:1740,
        distanceMeters:5000
      }
    ],
    fitEvents:[
      { timestamp:"2026-07-20T07:12:00.000Z", event:0, eventType:0 },
      { timestamp:"2026-07-20T07:32:00.000Z", event:0, eventType:1 },
      { timestamp:"2026-07-20T07:34:00.000Z", event:0, eventType:0 },
      { timestamp:"2026-07-20T07:50:00.000Z", event:26, eventType:3, data:7 }
    ],
    records:[
      { timestamp:"2026-07-20T07:12:01.000Z", positionValid:true },
      { timestamp:"2026-07-20T07:45:00.000Z", positionValid:false },
      { timestamp:"2026-07-20T07:45:03.000Z", positionValid:false },
      { timestamp:"2026-07-20T07:45:05.000Z", positionValid:true }
    ]
  });

  assert.equal(timeline.version, 1);
  assert.deepEqual(
    Array.from(timeline.events, (event) => event.event_type),
    ["start", "pause", "resume", "lap", "gps_lost", "gps_recovered", "fit_event", "finish"]
  );
  assert.deepEqual(
    Array.from(timeline.events, (event) => event.elapsed_seconds),
    [0, 1200, 1320, 1800, 1980, 1985, 2280, 3600]
  );
  assert.equal(timeline.events[3].metadata.lap, 1);
  assert.equal(timeline.events[6].metadata.fit_event, "user_marker");
});

test("timer transitions do not invent duplicate pauses or a resume at initial start", () => {
  const timeline = loadTimeline().build({
    startTime:"2026-07-20T07:00:00.000Z",
    endTime:"2026-07-20T07:10:00.000Z",
    fitEvents:[
      { timestamp:"2026-07-20T07:00:00.000Z", event:0, eventType:0 },
      { timestamp:"2026-07-20T07:02:00.000Z", event:0, eventType:1 },
      { timestamp:"2026-07-20T07:02:01.000Z", event:0, eventType:4 },
      { timestamp:"2026-07-20T07:03:00.000Z", event:0, eventType:0 }
    ]
  });

  assert.deepEqual(
    Array.from(timeline.events, (event) => event.event_type),
    ["start", "pause", "fit_event", "resume", "finish"]
  );
});

test("Lot B.1 persists a protected business object and exposes a read API", () => {
  for (const field of ["activity_id", "timestamp", "elapsed_seconds", "event_type", "metadata jsonb"]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /unique \(activity_id, position\)/);
  assert.match(timelineSource, /from\("activity_timeline"\)[\s\S]*\.order\("timestamp"/);
  assert.match(activitySource, /saveActivityTimelineSafely\([\s\S]*persistedActivityId,[\s\S]*user\.id,[\s\S]*timeline/);
  assert.match(activitySource, /await window\.MomentumTimeline\.save\(activityId, userId, timeline\)/);
  assert.ok(homePage.indexOf("js/activity-timeline.js") < homePage.indexOf("js/home-import.js"));
});

test("FIT ingestion retains laps, timer events and compressed timestamps", () => {
  assert.match(importSource, /globalMessageNumber === 19/);
  assert.match(importSource, /globalMessageNumber === 21/);
  assert.match(importSource, /compressedTimestamp && lastFitTimestamp/);
  assert.match(importSource, /MomentumTimeline\?\.build/);
});

test("terrain and physiological interpretation remain outside the Timeline", () => {
  for (const excluded of ["uphill", "downhill", "rolling", "fatigue", "cardiac_drift", "recommendation"]) {
    assert.doesNotMatch(timelineSource, new RegExp(excluded, "i"));
  }
  assert.match(architecture, /montées, descentes, portions roulantes/);
  assert.match(architecture, /ne font pas partie de cette version/);
});
