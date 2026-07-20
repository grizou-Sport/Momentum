import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const dataSource = await readFile(new URL("../js/home-data.js", import.meta.url), "utf8");
const calendarSource = await readFile(new URL("../js/home-calendar.js", import.meta.url), "utf8");
const activitiesSource = await readFile(new URL("../js/home-activities.js", import.meta.url), "utf8");
const importSource = await readFile(new URL("../js/home-import.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../css/home.css", import.meta.url), "utf8");

function loadCalendarFunctions() {
  const context = {
    console,
    window: null,
    dateFromIso(value) {
      return new Date(`${value}T12:00:00`);
    },
    escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    },
    sessionStatusLabel() {
      return "Terminée";
    },
    sessionLabel(session) {
      return session.type || "Activité";
    },
    sessionMeta() {
      return "";
    },
    activitySportLabel(value) {
      return value === "trail_running" ? "Trail" : String(value || "");
    }
  };

  context.window = context;
  context.MomentumDuration = {
    format(value) {
      const minutes = Math.max(0, Math.round(Number(value) || 0));
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
  };

  vm.createContext(context);
  vm.runInContext(calendarSource, context);
  return context;
}

function loadDataFunctions() {
  const context = {
    console,
    state: { sessions: [] },
    visibleMonth: new Date(2026, 6, 1),
    window: { MomentumMoments: {} }
  };

  vm.createContext(context);
  vm.runInContext(dataSource, context);
  return context;
}

test("HOME charge et adapte les champs normalisés du Lot A", () => {
  for (const field of [
    "started_at",
    "ended_at",
    "total_duration_seconds",
    "moving_time_seconds",
    "paused_time_seconds",
    "distance_m",
    "total_ascent_m",
    "average_heart_rate_bpm",
    "calories_kcal",
    "device_manufacturer",
    "device_model"
  ]) {
    assert.match(dataSource, new RegExp(`"${field}"`));
  }

  assert.match(activitiesSource, /queryActivitiesWithFieldFallback/);

  const context = loadDataFunctions();
  const session = context.mapActivityRow({
    id: "activity-1",
    activity_date: "2026-07-20",
    started_at: "2026-07-20T07:12:00",
    ended_at: "2026-07-20T13:01:00",
    total_duration_seconds: 20940,
    moving_time_seconds: 18320,
    paused_time_seconds: 2620,
    distance_m: 42195,
    total_ascent_m: 1988,
    average_heart_rate_bpm: 151,
    calories_kcal: 2650,
    device_manufacturer: "coros",
    device_model: "Apex 2 Pro"
  });

  assert.equal(session.totalDurationSeconds, 20940);
  assert.equal(session.movingTimeSeconds, 18320);
  assert.equal(session.pausedTimeSeconds, 2620);
  assert.equal(session.distanceMeters, 42195);
  assert.equal(session.deviceManufacturer, "coros");
  assert.equal(session.deviceModel, "Apex 2 Pro");
});

test("HOME retombe sur le schéma historique si les colonnes FIT ne sont pas déployées", async () => {
  const context = loadDataFunctions();
  const selectedFields = [];

  const result = await context.queryActivitiesWithFieldFallback((fields) => {
    selectedFields.push(fields);
    return Promise.resolve(selectedFields.length === 1
      ? {
          data: null,
          error: {
            code: "42703",
            message: "column activities.started_at does not exist"
          }
        }
      : { data: [{ id: "legacy-activity" }], error: null });
  });

  assert.equal(selectedFields.length, 2);
  assert.match(selectedFields[0], /started_at/);
  assert.doesNotMatch(selectedFields[1], /started_at/);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), [
    { id: "legacy-activity" }
  ]);
});

test("la grille affiche les sept indicateurs disponibles et masque les absents", () => {
  const context = loadCalendarFunctions();
  const complete = JSON.parse(JSON.stringify(context.activityMetricItems({
    totalDurationSeconds: 20940,
    movingTimeSeconds: 18320,
    pausedTimeSeconds: 2620,
    distanceMeters: 42195,
    totalAscentMeters: 1988,
    averageHeartRateBpm: 151,
    caloriesKcal: 2650
  })));

  assert.deepEqual(complete.map((metric) => metric.label), [
    "Distance",
    "Durée totale",
    "Temps en mouvement",
    "Temps de pause",
    "Dénivelé positif",
    "Fréquence cardiaque moyenne",
    "Calories"
  ]);
  assert.equal(complete.find((metric) => metric.label === "Distance").value, "42,2 km");
  assert.equal(complete.find((metric) => metric.label === "Durée totale").value, "05:49");

  const incomplete = JSON.parse(JSON.stringify(context.activityMetricItems({
    distanceMeters: 10000,
    totalDurationSeconds: 3600,
    caloriesKcal: null
  })));

  assert.deepEqual(incomplete.map((metric) => metric.label), [
    "Distance",
    "Durée totale"
  ]);
});

test("la fiche suit l’ordre En-tête, Indicateurs, Carte, Actions", () => {
  const context = loadCalendarFunctions();
  const html = context.renderPersonalActivityCard({
    id: "activity-1",
    type: "Kandersteg Course",
    category: "sport",
    sport: "trail_running",
    locationName: "Kandersteg (BE)",
    startedAt: "2026-07-20T07:12:00",
    endedAt: "2026-07-20T13:01:00",
    totalDurationSeconds: 20940,
    movingTimeSeconds: 18320,
    pausedTimeSeconds: 2620,
    distanceMeters: 42195,
    totalAscentMeters: 1988,
    averageHeartRateBpm: 151,
    caloriesKcal: 2650,
    deviceManufacturer: "coros",
    deviceModel: "Apex 2 Pro",
    sourceFileType: "fit",
    routeSummary: { map_points: [[46.49, 7.67], [46.51, 7.7]] }
  }, "2026-07-20");

  const headerIndex = html.indexOf("activity-detail-header");
  const metricsIndex = html.indexOf("activity-detail-metrics");
  const mapIndex = html.indexOf("activity-detail-map");
  const actionsIndex = html.indexOf("activity-detail-actions");

  assert.ok(headerIndex < metricsIndex);
  assert.ok(metricsIndex < mapIndex);
  assert.ok(mapIndex < actionsIndex);
  assert.match(html, /📍 Départ : Kandersteg \(BE\)/);
  assert.match(html, /07:12 → 13:01/);
  assert.match(html, /Import automatique • COROS Apex 2 Pro/);
  assert.doesNotMatch(html, /FICHIER FIT|Fichier FIT/);
});

test("la carte est mise en page sans modification de Leaflet", () => {
  assert.match(cssSource, /\.activity-detail-map \.activity-route-map\s*\{[\s\S]*?height:420px;[\s\S]*?margin:0;[\s\S]*?border:0;/);
  assert.match(cssSource, /\.activity-detail-metrics dl\s*\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(calendarSource, /L\.map|tileLayer|polyline/);
});

test("le lieu est résolu pendant l’import et non à l’ouverture de la fiche", () => {
  assert.match(importSource, /locationName = await reverseGeocode\(/);
  assert.match(activitiesSource, /location_name:\s*String\(/);
  assert.doesNotMatch(calendarSource, /reverseGeocode|fetch\(/);
});

test("le Lot A.1 n’ajoute aucune analyse à la fiche", () => {
  assert.doesNotMatch(calendarSource, /Puissance détaillée|Zones cardio|Recommandation|Commentaire IA/);
  assert.doesNotMatch(calendarSource, /<canvas|<svg/);
});
