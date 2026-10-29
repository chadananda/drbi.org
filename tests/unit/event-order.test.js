import { test } from "node:test";
import assert from "node:assert/strict";
import { compareEvents, byEventData } from "../../src/lib/event-order.js";

test("same start day: event that ends first lists first", () => {
  const weekend = { data: { startDate: "2026-11-26T23:00:00.200Z", endDate: "2026-11-29T19:00:00.200Z" } };
  const dinner = { data: { startDate: "2026-11-27T00:00:00.600Z", endDate: "2026-11-27T02:00:00.600Z" } };
  assert.deepEqual([weekend, dinner].sort(byEventData), [dinner, weekend]);
});

test("earlier start day wins regardless of length", () => {
  assert.ok(compareEvents("2026-11-01T17:00Z", "2026-11-30T00:00Z", "2026-11-15T22:00Z", "2026-11-15T23:00Z") < 0);
});

test("same-day single events keep time order", () => {
  assert.ok(compareEvents("2026-11-26T17:00Z", "2026-11-26T18:00Z", "2026-11-26T21:00Z", "2026-11-26T22:00Z") < 0);
});

test("missing end falls back to start", () => {
  assert.ok(compareEvents("2026-11-26T23:00Z", null, "2026-11-26T23:00Z", "2026-11-27T01:00Z") < 0);
});

test("zoneless strings are Arizona time", () => {
  // 2026-11-26T20:00 Arizona = 2026-11-27T03:00Z — same AZ day as a 4pm start.
  assert.ok(compareEvents("2026-11-26T20:00", "2026-11-26T21:00", "2026-11-26T23:00Z", "2026-11-29T19:00Z") < 0);
  assert.equal(compareEvents("2026-11-26", null, "2026-11-26T07:00Z", null), 0);
});
