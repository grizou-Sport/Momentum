import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [page, progressionStyles, motionStyles, motionSource, progressionSource] = await Promise.all([
  readFile(new URL("../progression.html", import.meta.url), "utf8"),
  readFile(new URL("../css/progression.css", import.meta.url), "utf8"),
  readFile(new URL("../css/momentum-motion.css", import.meta.url), "utf8"),
  readFile(new URL("../js/momentum-motion.js", import.meta.url), "utf8"),
  readFile(new URL("../js/home-progression.js", import.meta.url), "utf8")
]);

function loadReducedMotionApi() {
  const document = {
    addEventListener() {},
    documentElement: { classList:{ add() {} } },
    querySelectorAll() { return []; }
  };
  const window = {
    document,
    matchMedia() { return { matches:true }; }
  };
  const context = { console, Date, Intl, Math, Object, WeakSet, document, window };
  vm.createContext(context);
  vm.runInContext(motionSource, context);
  return context.window.MomentumMotion;
}

test("Progression loads the dawn hero and the reusable motion component", () => {
  assert.match(page, /Assets\/photography\/dawn\/dawn-002\.jpg/);
  assert.match(page, /css\/momentum-motion\.css/);
  assert.match(page, /js\/momentum-motion\.js/);
  assert.ok(page.indexOf("js/momentum-motion.js") < page.indexOf("js/home-progression.js"));
  assert.match(motionSource, /document\.documentElement\.classList\.add\("motion-capable"\)/);
  assert.match(page, /data-motion-parallax="0\.24"/);
  assert.ok((page.match(/data-motion-reveal/g) || []).length >= 6);
});

test("the Progression hero is full width while its content stays on the page grid", () => {
  assert.match(page, /class="progression-hero-inner"/);
  assert.match(progressionStyles, /\.progression-hero\{[\s\S]*?width:100%;min-height:76svh/);
  assert.match(progressionStyles, /\.progression-hero-inner\{width:min\(var\(--page-width\),calc\(100% - var\(--page-gutter\) \* 2\)\)/);
  assert.doesNotMatch(progressionStyles, /\.progression-hero,\.progression-dashboard/);
});

test("motion timings stay calm and use only opacity and transforms", () => {
  assert.match(progressionStyles, /progression-hero-in 600ms ease-out/);
  assert.match(progressionStyles, /translate3d\(0,15px,0\)/);
  assert.match(motionStyles, /opacity 450ms ease-out/);
  assert.match(motionStyles, /transform 450ms ease-out/);
  assert.match(motionStyles, /translate3d\(0,20px,0\)/);
  assert.doesNotMatch(motionStyles, /transition:[^;}]*(?:width|height|top|left)/);
});

test("reveals and charts play once and respect reduced motion", () => {
  assert.match(motionSource, /observer\.unobserve\(entry\.target\)/);
  assert.match(motionSource, /motionChartPlayed === "true"/);
  assert.match(motionSource, /prefers-reduced-motion: reduce/);
  assert.match(progressionSource, /animation:false/);
  assert.match(progressionSource, /stageProgressionChart\(progressionState\.loadChart/);
  assert.match(progressionSource, /stageProgressionChart\(progressionState\.sportChart/);
  assert.match(progressionSource, /stageProgressionChart\(progressionState\.wellnessChart/);
});

test("important counters finish immediately when reduced motion is requested", () => {
  const motion = loadReducedMotionApi();
  const counter = {
    dataset: {
      motionValue:"87",
      motionDecimals:"0",
      motionPrefix:"+",
      motionSuffix:" km"
    },
    textContent:"0"
  };

  motion.animateNumber(counter);

  assert.equal(counter.textContent, "+87 km");
  assert.match(progressionSource, /data-motion-number/);
});

test("chart points receive a halo and an animated HTML tooltip", () => {
  assert.match(motionSource, /id:"momentumPointHalo"/);
  assert.match(motionSource, /context\.arc\(point\.x, point\.y, 10/);
  assert.match(motionStyles, /opacity 200ms ease-out,transform 200ms ease-out/);
  assert.match(motionStyles, /translateY\(8px\)/);
  assert.match(progressionSource, /pointHoverRadius:6/);
  assert.match(progressionSource, /externalChartTooltip/);
});
