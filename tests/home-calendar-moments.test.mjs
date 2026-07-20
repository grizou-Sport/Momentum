import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const dataSource = await readFile(new URL("../js/home-data.js", import.meta.url), "utf8");
const calendarSource = await readFile(new URL("../js/home-calendar.js", import.meta.url), "utf8");
const momentRulesSource = await readFile(new URL("../js/momentum-moments.js", import.meta.url), "utf8");
const togetherSource = await readFile(new URL("../js/together.js", import.meta.url), "utf8");

function loadDataFunctions() {
  const context = {
    console,
    state: { sessions: [] },
    visibleMonth: new Date(2026, 6, 1, 12),
    iso(value) {
      const date = new Date(value);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      return date.toISOString().slice(0, 10);
    },
    startOfMonth: (date) => new Date(date.getFullYear(), date.getMonth(), 1, 12),
    addDays(date, amount) {
      const result = new Date(date);
      result.setDate(result.getDate() + amount);
      return result;
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(momentRulesSource, context);
  vm.runInContext(dataSource, context);
  return context;
}

test("shared Moments use the same calendar buckets as TOGETHER", () => {
  const context = loadDataFunctions();
  const today = "2026-07-14";

  assert.equal(context.sharedMomentCalendarStatus({ status: "CONFIRMED", start_at: "2026-07-15T08:00:00Z" }, today), "upcoming");
  assert.equal(context.sharedMomentCalendarStatus({ status: "ONGOING", start_at: "2026-07-14T08:00:00Z" }, today), "today");
  assert.equal(context.sharedMomentCalendarStatus({ status: "CONFIRMED", start_at: "2026-07-13T08:00:00Z" }, today), "past");
  assert.equal(context.sharedMomentCalendarStatus({ status: "COMPLETED", start_at: "2026-07-15T08:00:00Z" }, today), "past");
  assert.equal(context.sharedMomentCalendarStatus({ status: "PLANNING", start_at: "2026-07-15T08:00:00Z" }, today), null);
});

test("HOME and TOGETHER share one Moment classification rule", () => {
  assert.match(dataSource, /MomentumMoments\?\.calendarStatus/);
  assert.match(togetherSource, /MomentumMoments\.calendarStatus/);
});

test("the empty-day message is not duplicated above the day feed", () => {
  assert.doesNotMatch(calendarSource, /Une journée calme fait aussi partie du chemin/);
});

test("HOME loads authorized Moments separately from personal activities", () => {
  assert.match(dataSource, /\.from\("moments"\)/);
  assert.match(dataSource, /\.in\("status", \["CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"\]\)/);
  assert.doesNotMatch(dataSource, /\.from\("moments"\)[\s\S]{0,400}\.eq\("user_id"/);
});

test("shared Moment actions deep-link to TOGETHER instead of activity mutations", () => {
  assert.match(calendarSource, /session\.source === "shared_moment"/);
  assert.match(calendarSource, /together\.html\?moment=/);
  assert.match(togetherSource, /URLSearchParams\(window\.location\.search\)\.get\("moment"\)/);
  assert.match(togetherSource, /await openMomentDetail\(requestedMomentId\)/);
});
