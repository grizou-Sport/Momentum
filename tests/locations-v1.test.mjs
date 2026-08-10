import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const api = require("../api/locations.js");
const migration = await readFile(new URL("../supabase/migrations/20260810173058_locations_v1.sql", import.meta.url), "utf8");
const picker = await readFile(new URL("../js/momentum-location-picker.js", import.meta.url), "utf8");
const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const together = await readFile(new URL("../together.html", import.meta.url), "utf8");
const homeActivities = await readFile(new URL("../js/home-activities.js", import.meta.url), "utf8");
const togetherClient = await readFile(new URL("../js/together.js", import.meta.url), "utf8");

test("Geoapify est appelé côté serveur et normalisé dans le modèle MOMENTUM", () => {
  const normalized = api.normalizeGeoapifyResult({
    properties: {
      name: "Sportzentrum Gstaad",
      address_line1: "Sportzentrumstrasse 5",
      postcode: "3780",
      city: "Gstaad",
      country: "Suisse",
      country_code: "ch",
      lat: 46.474,
      lon: 7.286,
      place_id: "geo-123"
    }
  });

  assert.deepEqual(normalized, {
    name: "Sportzentrum Gstaad",
    address: "Sportzentrumstrasse 5",
    postal_code: "3780",
    city: "Gstaad",
    country: "Suisse",
    country_code: "CH",
    latitude: 46.474,
    longitude: 7.286,
    source: "geoapify",
    provider_place_id: "geo-123"
  });
  assert.match(api.toString(), /process\.env\.GEOAPIFY_API_KEY/);
  assert.match(api.toString(), /lang: "fr"/);
  assert.match(api.toString(), /limit: "5"/);
  assert.match(api.toString(), /proximity:/);
  assert.match(api.toString(), /9000/);
  assert.match(api.toString(), /\[locations\] Geoapify request failed/);
  assert.doesNotMatch(picker, /GEOAPIFY_API_KEY|apiKey=/);
});

test("le référentiel commun protège les lieux privés par RLS", () => {
  assert.match(migration, /create table if not exists public\.locations/);
  assert.match(migration, /alter table public\.locations enable row level security/);
  assert.match(migration, /visibility = 'public'\s+or \(visibility = 'private' and owner_user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /for update to authenticated[\s\S]*using[\s\S]*with check/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.search_locations\(text, integer\) from public, anon/);
});

test("les lieux publics sont dédupliqués et les objets conservent le texte historique", () => {
  assert.match(migration, /locations_public_identity_idx/);
  assert.match(migration, /locations_public_provider_place_idx/);
  assert.match(migration, /locations_created_by_idx/);
  assert.match(migration, /on public\.locations\(provider_place_id\)/);
  assert.match(picker, /\.eq\("provider_place_id", location\.provider_place_id\)/);
  for (const relation of [
    /public\.activities[\s\S]*location_id/,
    /public\.moments[\s\S]*location_id/,
    /public\.moment_date_options[\s\S]*location_id/,
    /public\.clubs[\s\S]*default_location_id/
  ]) assert.match(migration, relation);
  assert.match(migration, /location_name[\s\S]*rétrocompatibilité/);
  assert.match(homeActivities, /location_name:/);
  assert.match(togetherClient, /location_name:/);
});

test("LocationPicker privilégie MOMENTUM, attend 3 caractères et propose la création manuelle", () => {
  assert.match(picker, /const MINIMUM_QUERY_LENGTH = 3/);
  assert.match(picker, /const SEARCH_DELAY = 350/);
  assert.match(picker, /attempt < 2/);
  assert.match(picker, /if \(proximity && proximity\.latitude !== null && proximity\.longitude !== null\)/);
  assert.match(picker, /Mes lieux/);
  assert.match(picker, /Lieux MOMENTUM/);
  assert.match(picker, /Résultats/);
  assert.match(picker, /\+ Ajouter un nouveau lieu/);
  assert.match(picker, /Lieu personnel/);
  assert.match(picker, /Lieu public MOMENTUM/);
  assert.match(picker, /value="private" checked/);
  assert.match(picker, /latitude:[\s\S]*null/);
});

test("le composant universel est branché aux activités, Moments et Clubs", () => {
  assert.match(home, /id="activityLocationPicker"/);
  assert.match(together, /id="momentLocationPicker"/);
  assert.match(together, /id="clubLocationPicker"/);
  assert.match(home, /js\/momentum-location-picker\.js/);
  assert.match(together, /js\/momentum-location-picker\.js/);
  assert.match(homeActivities, /MomentumLocations\.resolveForSave/);
  assert.match(togetherClient, /MomentumLocations\.resolveForSave/);
  assert.match(homeActivities, /location_id:/);
  assert.match(togetherClient, /default_location_id:/);
});
