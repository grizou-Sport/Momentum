import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [importSource, activitiesSource] = await Promise.all([
  readFile(new URL("../js/home-import.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-activities.js", import.meta.url), "utf8")
]);

function loadActivityImportFunctions(overrides = {}) {
  const context = {
    console,
    Date,
    Intl,
    JSON,
    Math,
    Number,
    Object,
    Promise,
    Set,
    ...overrides
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(importSource, context);
  vm.runInContext(activitiesSource, context);
  return context;
}

function formWithImportedData() {
  return {
    dataset: {
      importedActivity: JSON.stringify({
        started_at: "2026-07-20T07:00:00.000Z",
        distance_m: 42195
      }),
      activityTimeline: JSON.stringify({
        events: [{ event_type: "start" }, { event_type: "finish" }]
      })
    }
  };
}

test("un GPX planifié reste sur le contrat historique", () => {
  const context = loadActivityImportFunctions();
  const form = formWithImportedData();
  const gpx = { name: "parcours-samedi.gpx" };

  assert.deepEqual(
    JSON.parse(JSON.stringify(
      context.normalizedFitActivityPayload(form, gpx, true)
    )),
    {}
  );
  assert.equal(context.activityTimelineForSave(form, gpx, false), null);
});

test("un FIT réalisé conserve ses données normalisées et sa Timeline", () => {
  const context = loadActivityImportFunctions();
  const form = formWithImportedData();
  const fit = { name: "activite.fit" };

  assert.deepEqual(
    JSON.parse(JSON.stringify(
      context.normalizedFitActivityPayload(form, fit, true)
    )),
    {
      started_at: "2026-07-20T07:00:00.000Z",
      distance_m: 42195
    }
  );
  assert.equal(
    context.activityTimelineForSave(form, fit, true).events.length,
    2
  );
});

test("l’import GPX planifié préserve les champs de planification", () => {
  const fields = {
    activity_category: { value: "sport" },
    status: { value: "planned" },
    activity_date: { value: "2026-07-25" },
    sport: { value: "cycling", options: [] },
    sport_activity_type: { value: "Sortie longue", options: [] },
    distance_km: { value: "" },
    elevation_m: { value: "" },
    avg_hr: { value: "" },
    location_name: { value: "" }
  };
  const durationPicker = { value: 180 };
  const form = {
    dataset: {},
    elements: fields,
    querySelector(selector) {
      return selector === 'duration-picker[name="duration_min"]'
        ? durationPicker
        : null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const context = loadActivityImportFunctions({
    $(selector) {
      return selector === "#activityForm" ? form : null;
    }
  });

  context.fillActivityForm({
    sourceFileType: "gpx",
    date: "2026-07-20",
    sport: "running",
    type: "parcours-samedi",
    distance: 42.2,
    duration: 300,
    elevation: "",
    avgHr: "",
    locationName: "Interlaken",
    routeSummary: { map_points: [[46.6, 7.8], [46.7, 7.9]] },
    timeline: { events: [] }
  });

  assert.equal(fields.activity_date.value, "2026-07-25");
  assert.equal(fields.sport.value, "cycling");
  assert.equal(fields.sport_activity_type.value, "Sortie longue");
  assert.equal(durationPicker.value, 180);
  assert.equal(fields.distance_km.value, 42.2);
  assert.equal(fields.location_name.value, "Interlaken");
  assert.match(form.dataset.routeSummary, /map_points/);
});

test("l’import préremplit l’heure de départ dans le fuseau local", () => {
  const fields = {
    activity_category: { value: "sport" },
    status: { value: "done" },
    activity_date: { value: "" },
    activity_time: { value: "" },
    sport: { value: "running", options: [] },
    sport_activity_type: { value: "Course", options: [] },
    distance_km: { value: "" },
    elevation_m: { value: "" },
    avg_hr: { value: "" },
    location_name: { value: "" }
  };
  const form = {
    dataset: {},
    elements: fields,
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const context = loadActivityImportFunctions({
    $(selector) { return selector === "#activityForm" ? form : null; }
  });
  const startedAt = "2026-07-20T07:37:00.000Z";
  const expected = context.activityLocalDateTime(startedAt);

  context.fillActivityForm({
    sourceFileType: "fit",
    date: expected.date,
    startedAt,
    distance: 10,
    duration: 60
  });

  assert.equal(fields.activity_time.value, expected.time);
  assert.equal(form.dataset.importedActivityTime, expected.time);
});

test("une heure corrigée manuellement n’est pas remplacée par un nouvel import", () => {
  const fields = {
    activity_category: { value: "sport" },
    status: { value: "done" },
    activity_date: { value: "2026-07-20" },
    activity_time: { value: "08:37" },
    sport: { value: "running", options: [] },
    sport_activity_type: { value: "Course", options: [] },
    distance_km: { value: "" },
    elevation_m: { value: "" },
    avg_hr: { value: "" },
    location_name: { value: "" }
  };
  const form = {
    dataset: {},
    elements: fields,
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const context = loadActivityImportFunctions({
    $(selector) { return selector === "#activityForm" ? form : null; }
  });

  context.fillActivityForm({
    sourceFileType: "gpx",
    date: "2026-07-20",
    startedAt: "2026-07-20T10:00:00.000Z"
  });

  assert.equal(fields.activity_time.value, "08:37");
  assert.equal(form.dataset.importedActivityTime, undefined);
});

test("un horodatage absent ou invalide laisse l’heure vide", () => {
  const context = loadActivityImportFunctions();

  assert.equal(context.activityLocalDateTime(null), null);
  assert.equal(context.activityLocalDateTime("not-a-date"), null);
});

test("le parseur GPX retient le premier horodatage valide", async () => {
  const points = [
    { lat: "46.9", lon: "7.4", time: "invalid" },
    { lat: "46.91", lon: "7.41", time: "2026-07-20T07:37:00Z" },
    { lat: "46.92", lon: "7.42", time: "2026-07-20T08:37:00Z" }
  ];
  const xml = {
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector !== "trkpt") return [];
      return points.map((point) => ({
        getAttribute(name) { return point[name]; },
        hasAttribute(name) { return Object.hasOwn(point,name); },
        querySelector(name) {
          return name === "time" ? { textContent: point.time } : null;
        }
      }));
    }
  };
  const context = loadActivityImportFunctions({
    DOMParser: class { parseFromString() { return xml; } }
  });

  const parsed = await context.parseGpx({
    name: "sortie.gpx",
    async text() { return "<gpx />"; }
  });

  assert.equal(parsed.startTime, "2026-07-20T07:37:00.000Z");
  assert.equal(parsed.endTime, "2026-07-20T08:37:00.000Z");
});

test("une Timeline indisponible signale un échec ciblé et permet la reprise", async () => {
  const warnings = [];
  const context = loadActivityImportFunctions({
    console: {
      ...console,
      warn(...args) {
        warnings.push(args);
      }
    },
    MomentumTimeline: {
      async save() {
        throw new Error("activity_timeline indisponible");
      }
    }
  });

  await assert.rejects(context.saveActivityTimelineSafely(
    "activity-1", "user-1", { events: [{ event_type: "start" }] }
  ), /chronologie/);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /Timeline/i);
});

test("le repli de schéma retire uniquement les champs FIT normalisés", () => {
  const context = loadActivityImportFunctions();
  const payload = {
    activity_date: "2026-07-20",
    source_file_type: "fit",
    started_at: "2026-07-20T07:00:00.000Z",
    distance_m: 42195,
    distance_km: 42.195
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(
      context.withoutNormalizedFitActivityFields(payload)
    )),
    {
      activity_date: "2026-07-20",
      source_file_type: "fit",
      distance_km: 42.195
    }
  );
});
