import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [discover,navigation,you,together,home,calendar,activities,nutrition,progression,progressionPage,flow,account,story,session,styles,dataSource,cleanupWorker,accountHandler,sharedBackfill] = await Promise.all([
  'discover.html','js/navigation.js','js/you.js','js/together.js','js/home.js','js/home-calendar.js','js/home-activities.js','js/activity-nutrition.js','js/home-progression.js','progression.html','js/home-flow.js','js/you-account.js','js/you-story.js','js/momentum-session.js','css/consolidation.css','js/momentum-data.js','supabase/functions/storage-cleanup/worker.mjs','supabase/functions/account-deletion/handler.mjs','supabase/migrations/20260911205559_cdc_shared_moment_backfill_compatibility.sql'
].map(read));

test('ACC-01/02: public discovery is explicit, fictitious, read-only and leads to real signup', () => {
  assert.match(discover, /Exemple fictif · Lecture seule/);
  assert.match(discover, /Rien n’est enregistré/);
  assert.match(discover, /login\.html\?mode=signup/);
  assert.doesNotMatch(discover, /<script\b|<form\b|momentumDB|supabase/i);
});

test('UX-01/02/03: four direct areas, keyboard access and deep-link history share one navigation contract', () => {
  for (const destination of ['home','you','progression','together']) assert.match(navigation, new RegExp(`railLink\\("${destination}"|data-momentum-section="${destination}"`));
  assert.match(navigation, /addEventListener\("focus"/);
  assert.match(navigation, /addEventListener\("focusout"/);
  assert.match(you, /history\.pushState[\s\S]*addEventListener\("popstate"/);
  assert.match(together, /history\.pushState[\s\S]*addEventListener\("popstate"/);
});

async function surfaceFixture(hash, preference) {
  const source = await read('js/momentum-surface.js');
  const listeners = {};
  const content = { id:'journalContent', hidden:true, before() {} };
  const toggle = { isConnected:true, textContent:'', title:'', attributes:{}, setAttribute(name,value) { this.attributes[name]=value; }, addEventListener(name,handler) { listeners[name]=handler; } };
  const journal = { hidden:false, querySelector(selector) { return selector === '#journalContent' ? content : selector === '#toggleJournal' ? toggle : null; } };
  const target = { id:'mainContent', tabIndex:0, scrollIntoView() {} };
  const context = {
    location:{ pathname:'/index.html', hash, search:'' },
    document:{
      body:{ prepend() {} }, createElement(){ return {}; },
      querySelector(selector) { return selector === '#journal' ? journal : selector === '[data-direct-content]' ? target : selector === '.skip-link' ? {className:'skip-link'} : null; }
    },
    window:{ momentumPageReady:Promise.resolve(), MomentumPreferences:{ get:()=>preference, set:async()=>{} }, addEventListener(name,handler){ listeners[`window:${name}`]=handler; } },
    Promise
  };
  vm.createContext(context); vm.runInContext(source, context); await new Promise(resolve => setImmediate(resolve));
  return { content, toggle, journal, listeners, context };
}

test('UX-04/05/06/07: HOME preserves deliberate position, opens the real Journal content and keeps the chosen date', async () => {
  assert.match(calendar, /const previousScroll = container\.scrollLeft/);
  assert.match(calendar, /if \(!container\.dataset\.initiallyCentered\)/);
  const direct = await surfaceFixture('#journal', false);
  assert.equal(direct.journal.hidden, false);
  assert.equal(direct.content.hidden, false);
  assert.equal(direct.toggle.attributes['aria-controls'], 'journalContent');
  assert.equal(direct.toggle.attributes['aria-expanded'], 'true');
  const collapsed = await surfaceFixture('', false);
  assert.equal(collapsed.content.hidden, true);
  assert.match(activities, /form\.elements\.activity_date\.value = selectedDate/);
});

test('UX-09/10/11/12/13/15: responsive fallbacks, reduced motion, weather isolation and account scoping stay explicit', () => {
  assert.match(styles, /@media\(max-width:900px\)[\s\S]*\.momentum-hero\{min-height:calc\(100svh/);
  assert.match(styles, /hero-overlay\{background:linear-gradient/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)[\s\S]*animation:none!important/);
  assert.match(styles, /@media\(max-width:390px\)/);
  assert.match(home, /catch\(_\)\{if\(weatherCard\)[\s\S]*Ton Journal reste disponible/);
  assert.match(session, /SIGNED_OUT'[\s\S]*clear\(\)/);
  assert.match(session, /session\.user\.id !== userId[\s\S]*clear\(\)/);
});

test('MOM-08/09/10/11/12/19: optional side effects have cancellation, stale-response and targeted recovery guards', () => {
  assert.match(activities, /closeActivityDialog[\s\S]*MomentumNutrition\?\.cancelActivityForm/);
  assert.match(nutrition, /function cancelActivityForm\(\)[\s\S]*activityFormDraft = null/);
  assert.match(activities, /structuredSaved[\s\S]*Le Moment et son ressenti sont enregistrés\. Échec pour/);
  assert.match(activities, /version !== form\.dataset\.formVersion/);
  assert.match(activities, /discard_uploaded_file/);
  assert.match(activities, /delete_personal_activity/);
});

test('TOG migration: populated participants accept only the sessionless schedule-version backfill', () => {
  assert.match(sharedBackfill, /to_jsonb\(new\) \? 'confirmed_schedule_revision'/);
  assert.match(sharedBackfill, /to_jsonb\(new\)-'confirmed_schedule_revision'-'updated_at'/);
  assert.match(sharedBackfill, /raise exception 'Session requise'/);
  assert.doesNotMatch(sharedBackfill, /disable trigger|session_replication_role/);
});

test('DAT-15: complete client pagination handles several thousand stable rows within a bounded lab time', async () => {
  const context = { window:{ addEventListener() {} }, console, Map, Set };
  vm.createContext(context); vm.runInContext(dataSource, context);
  const rows = Array.from({length:5007}, (_,index) => ({ id:index+1 }));
  let calls = 0;
  const started = performance.now();
  const result = await context.window.MomentumData.all(() => ({
    async range(from,to) { calls += 1; return { data:rows.slice(from,to+1), count:rows.length, error:null }; }
  }));
  const elapsed = performance.now() - started;
  assert.equal(result.complete, true);
  assert.equal(result.count, rows.length);
  assert.equal(calls, 11);
  assert.ok(elapsed < 2000, `pagination lab time ${elapsed.toFixed(1)} ms`);
});

test('DAT-16/17/18/19/20/24/25/26: periods, units, overlap choices and stale replies remain tied to their source series', () => {
  assert.match(progression, /periodPreset:"last-7-days"/);
  for (const preset of ['last-7-days','current-week','last-4-weeks','current-month','custom']) assert.match(progressionPage, new RegExp(`data-period-preset="${preset}"`));
  assert.match(progression, /mode === "distance" \? activity\.distance_km : activity\.duration_min/);
  assert.match(progression, /Charge et bien-être à la même date/);
  assert.match(progression, /Le graphique présente une période agrégée\. Choisis un jour/);
  assert.match(flow, /data-flow-group-activity/);
  assert.match(progression, /const requestVersion = \+\+progressionState\.requestVersion/);
  assert.match(progression, /requestVersion !== progressionState\.requestVersion/);
  for (const table of ['volumeChartTable','sportChartTable','fitnessChartTable','wellnessChartTable']) assert.match(progressionPage, new RegExp(`id="${table}"`));
});

test('PER-05/06/09/10/13/14 and SEC-17/18/20: unknown values, unavailable sources and logs never become invented success', () => {
  assert.match(story, /Aucun souvenir écrit pour ce Moment/);
  assert.match(progression, /Ta période · \$\{escapeHtml\(range\)\}/);
  assert.match(nutrition, /Calculé sur la durée écoulée/);
  assert.match(nutrition, /Durée absente : valeurs horaires non calculables/);
  assert.match(nutrition, /Les données enregistrées n’ont pas été modifiées/);
  assert.match(account, /synchronisation automatique indisponible/);
  assert.match(account, /Importer un fichier FIT ou GPX/);
  assert.doesNotMatch(cleanupWorker + accountHandler, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(accountHandler, /respond\([^\n]*(?:password|current|reauthenticated)/);
  assert.match(cleanupWorker, /neither secret nor request body is logged/);
});
