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

test("une Timeline indisponible ne transforme pas le succès principal en échec", async () => {
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

  const saved = await context.saveActivityTimelineSafely(
    "activity-1",
    "user-1",
    { events: [{ event_type: "start" }] }
  );

  assert.equal(saved, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][0], /Moment enregistré sans Timeline/);
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
