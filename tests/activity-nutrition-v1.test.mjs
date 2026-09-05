import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const nutritionSource = await readFile(new URL("../js/activity-nutrition.js", import.meta.url), "utf8");
const calendarSource = await readFile(new URL("../js/home-calendar.js", import.meta.url), "utf8");
const homeSource = await readFile(new URL("../js/home.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../css/home.css", import.meta.url), "utf8");
const migrationSource = await readFile(
  new URL("../supabase/migrations/20260905100319_activity_nutrition_v1.sql", import.meta.url),
  "utf8"
);

function loadNutritionModule() {
  const context = {
    console,
    Intl,
    Map,
    window:null,
    document:{
      readyState:"loading",
      addEventListener() {}
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(nutritionSource, context);
  return context.MomentumNutrition;
}

function product(id, values = {}) {
  return {
    id,
    name:id,
    carbohydrates_g:0,
    sodium_mg:0,
    caffeine_mg:0,
    potassium_mg:0,
    magnesium_mg:0,
    calcium_mg:0,
    bicarbonate_mg:0,
    zinc_mg:0,
    ...values
  };
}

test("calcule les totaux et débits horaires depuis la durée réelle", () => {
  const nutrition = loadNutritionModule();
  const products = [
    product("gel", { carbohydrates_g:25, sodium_mg:20, caffeine_mg:100 }),
    product("drink", { carbohydrates_g:40, sodium_mg:313, potassium_mg:761 }),
    product("bar", { carbohydrates_g:27, sodium_mg:180 })
  ];
  const totals = nutrition.calculateTotals(
    products,
    new Map([["gel", 3], ["drink", 2], ["bar", .5]]),
    { totalDurationSeconds:4 * 3600 }
  );

  assert.equal(totals.carbs_total_g, 168.5);
  assert.equal(totals.carbs_per_hour, 42.125);
  assert.equal(totals.sodium_total_mg, 776);
  assert.equal(totals.sodium_per_hour, 194);
  assert.equal(totals.caffeine_total_mg, 300);
  assert.equal(totals.potassium_total_mg, 1522);
});

test("accepte le pas de 0,25, ignore zéro et tolère une durée absente", () => {
  const nutrition = loadNutritionModule();
  const totals = nutrition.calculateTotals(
    [product("banana", { carbohydrates_g:25 }), product("gel", { carbohydrates_g:30 })],
    { banana:1.25, gel:0 },
    {}
  );

  assert.equal(totals.carbs_total_g, 31.25);
  assert.equal(totals.items.length, 1);
  assert.equal(totals.carbs_per_hour, null);
  assert.equal(totals.sodium_per_hour, null);
});

test("utilise le snapshot historique plutôt que la composition courante", () => {
  const nutrition = loadNutritionModule();
  const current = product("gel", { carbohydrates_g:30, sodium_mg:50 });
  const historical = product("gel", { carbohydrates_g:25, sodium_mg:20 });
  const totals = nutrition.calculateTotals(
    [current],
    new Map([["gel", 2]]),
    { duration:60 },
    new Map([["gel", historical]])
  );

  assert.equal(totals.carbs_total_g, 50);
  assert.equal(totals.sodium_total_mg, 40);
  assert.equal(totals.carbs_per_hour, 50);
});

test("branche la carte sur la fiche activité et la rafraîchit sans rechargement", () => {
  assert.match(indexSource, /id="nutritionDialog"/);
  assert.match(indexSource, /js\/activity-nutrition\.js/);
  assert.match(calendarSource, /MomentumNutrition\?\.ensureActivities\(sessions\)/);
  assert.match(calendarSource, /MomentumNutrition\?\.renderActivitySection\(session, date\)/);
  assert.match(homeSource, /action === "edit-nutrition"/);
  assert.match(nutritionSource, /await openDay\(activityDate\)/);
  assert.match(nutritionSource, /Impossible d’enregistrer le ravitaillement\. Réessayer\./);
});

test("la carte expose catégories, recherche, quantités tactiles et produit personnel", () => {
  for (const label of ["Favoris", "Boissons", "Gels", "Barres & gaufres", "Purées", "Fruits", "Autres"]) {
    assert.match(nutritionSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(nutritionSource, /Rechercher un produit…/);
  assert.match(nutritionSource, /step="0\.25"/);
  assert.match(nutritionSource, /\+ Ajouter un produit/);
  assert.match(nutritionSource, /created_by:user\.id/);
  assert.match(cssSource, /\.nutrition-dialog\s*\{[\s\S]*?width:min\(1380px/);
  assert.match(cssSource, /@media\(max-width:760px\)[\s\S]*?\.nutrition-dialog\s*\{[\s\S]*?height:100svh/);
  assert.match(cssSource, /\.nutrition-quantity button\s*\{[\s\S]*?width:48px/);
});

test("la migration crée snapshots, RLS, RPC atomique et catalogue initial", () => {
  for (const field of [
    "carbohydrates_g", "sodium_mg", "caffeine_mg", "potassium_mg",
    "magnesium_mg", "calcium_mg", "bicarbonate_mg", "zinc_mg"
  ]) {
    assert.match(migrationSource, new RegExp(`${field} numeric`));
    assert.match(migrationSource, new RegExp(`${field}_snapshot numeric`));
  }

  assert.match(migrationSource, /alter table public\.nutrition_products enable row level security/);
  assert.match(migrationSource, /alter table public\.activity_nutrition_items enable row level security/);
  assert.match(migrationSource, /not is_global\s+and created_by = \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /activities\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /security invoker/);
  assert.match(migrationSource, /save_activity_nutrition/);
  assert.match(migrationSource, /on conflict \(activity_id, product_id\) do update\s+set quantity/);

  for (const seed of [
    "Gel 100 CAF 100", "Drink Mix 320 CAF 100", "Solid 225 C",
    "ULTRA Drink Mix 250 · Lime", "ULTRA Waffle 140 · Maple Syrup",
    "Boisson électrolytes zéro calorie · Citron / Citron vert",
    "Banane", "Datte Medjool", "Biberli", "Appenzeller Bärli-Biber", "Mars", "Snickers"
  ]) {
    assert.ok(migrationSource.includes(seed), `seed manquant: ${seed}`);
  }
});
