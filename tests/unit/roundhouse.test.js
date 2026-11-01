import { test } from "node:test";
import assert from "node:assert/strict";
import { expandOccurrences, inMidweekWindow } from "../../src/lib/roundhouse.js";

const ev = (o) => ({ id: "r1", title: "Devotional", date: "2026-11-03", startTime: "18:30", endTime: "20:00", repeat: "none", repeatUntil: "", ...o });

test("one-off event yields a single occurrence inside the window", () => {
  const out = expandOccurrences([ev()], "2026-11-01", "2026-11-30");
  assert.deepEqual(out.map((o) => o.date), ["2026-11-03"]);
  assert.equal(out[0].key, "r1@2026-11-03");
});

test("one-off event outside the window is dropped", () => {
  assert.equal(expandOccurrences([ev({ date: "2026-10-27" })], "2026-11-01", "2026-11-30").length, 0);
});

test("weekly event repeats every 7 days until repeatUntil", () => {
  const out = expandOccurrences([ev({ repeat: "weekly", repeatUntil: "2026-11-17" })], "2026-11-01", "2026-12-31");
  assert.deepEqual(out.map((o) => o.date), ["2026-11-03", "2026-11-10", "2026-11-17"]);
});

test("weekly event with no end date runs to the window end", () => {
  const out = expandOccurrences([ev({ repeat: "weekly" })], "2026-11-01", "2026-11-24");
  assert.deepEqual(out.map((o) => o.date), ["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
});

test("weekly series that began before the window starts at the first in-window week", () => {
  const out = expandOccurrences([ev({ date: "2026-10-06", repeat: "weekly" })], "2026-11-01", "2026-11-12");
  assert.deepEqual(out.map((o) => o.date), ["2026-11-03", "2026-11-10"]);
});

test("occurrences are sorted by date then start time", () => {
  const out = expandOccurrences([ev({ id: "b", startTime: "19:00" }), ev({ id: "a", startTime: "10:00" }), ev({ id: "c", date: "2026-11-02" })], "2026-11-01", "2026-11-30");
  assert.deepEqual(out.map((o) => o.id), ["c", "a", "b"]);
});

test("midweek window: Monday evening through Thursday evening", () => {
  assert.equal(inMidweekWindow("2026-11-02", "18:00"), true);  // Mon evening
  assert.equal(inMidweekWindow("2026-11-02", "10:00"), false); // Mon morning
  assert.equal(inMidweekWindow("2026-11-03", "10:00"), true);  // Tue any time
  assert.equal(inMidweekWindow("2026-11-05", "19:00"), true);  // Thu evening
  assert.equal(inMidweekWindow("2026-11-06", "19:00"), false); // Fri
  assert.equal(inMidweekWindow("2026-11-08", "14:00"), false); // Sun
});
