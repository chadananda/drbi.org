import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeLocation, validateEventInput, pickEventContent, pickEventMeta } from "../../src/lib/event-input.js";
import { isApiTokenMatch } from "../../src/lib/server/api-token.js";

describe("normalizeLocation", () => {
  it("maps legacy {name,city,state,zip} → {venue,address}", () => {
    assert.deepEqual(
      normalizeLocation({ name: "Main Hall", city: "Eloy", state: "AZ", zip: "85131" }),
      { venue: "Main Hall", address: "Eloy, AZ, 85131" }
    );
  });
  it("keeps canonical {venue,address,online}", () => {
    assert.deepEqual(
      normalizeLocation({ venue: "Roundhouse", address: "1950 W. William Sears Dr.", online: "https://zoom.us/x" }),
      { venue: "Roundhouse", address: "1950 W. William Sears Dr.", online: "https://zoom.us/x" }
    );
  });
  it("prefers explicit address over city/state parts", () => {
    assert.deepEqual(normalizeLocation({ venue: "Hall", address: "123 Main", city: "Eloy" }), { venue: "Hall", address: "123 Main" });
  });
  it("non-object → undefined", () => {
    assert.equal(normalizeLocation(null), undefined);
    assert.equal(normalizeLocation("Eloy"), undefined);
  });
});

describe("validateEventInput (create)", () => {
  it("requires title and startDate", () => {
    const e = validateEventInput({});
    assert.ok(e.includes("title is required"));
    assert.ok(e.includes("startDate is required"));
  });
  it("passes with minimal valid input", () => {
    assert.deepEqual(validateEventInput({ title: "Fall Retreat", startDate: "2026-11-03" }), []);
  });
  it("rejects a bad startDate", () => {
    assert.ok(validateEventInput({ title: "X", startDate: "not-a-date" }).some(m => /startDate must be/.test(m)));
  });
  it("rejects a non-http registrationUrl", () => {
    assert.ok(validateEventInput({ title: "X", startDate: "2026-11-03", registrationUrl: "drbi.org/x" }).some(m => /registrationUrl/.test(m)));
  });
  it("rejects a bad waitlistOverride", () => {
    assert.ok(validateEventInput({ title: "X", startDate: "2026-11-03", waitlistOverride: "maybe" }).some(m => /waitlistOverride/.test(m)));
  });
  it("rejects negative capacity", () => {
    assert.ok(validateEventInput({ title: "X", startDate: "2026-11-03", capacity: -5 }).some(m => /capacity/.test(m)));
  });
});

describe("validateEventInput (partial/PATCH)", () => {
  it("does not require title/startDate when partial", () => {
    assert.deepEqual(validateEventInput({ shortDescription: "hi" }, { partial: true }), []);
  });
  it("still validates provided fields when partial", () => {
    assert.ok(validateEventInput({ startDate: "nope" }, { partial: true }).some(m => /startDate must be/.test(m)));
  });
});

describe("pickEventContent", () => {
  it("whitelists content fields and never accepts source/externalId/manuallyEdited", () => {
    const out = pickEventContent({ title: "T", startDate: "2026-11-03", source: "humanitix", externalId: "hx1", manuallyEdited: false, id: "x", registeredCount: 99 });
    assert.equal(out.title, "T");
    assert.equal(out.startDate, "2026-11-03");
    assert.equal(out.source, undefined);
    assert.equal(out.externalId, undefined);
    assert.equal(out.manuallyEdited, undefined);
    assert.equal(out.id, undefined);
    assert.equal(out.registeredCount, undefined);
  });
  it("normalizes location and coerces booleans", () => {
    const out = pickEventContent({ location: { name: "Hall" }, visible: 1, featured: 0 });
    assert.deepEqual(out.location, { venue: "Hall" });
    assert.equal(out.visible, true);
    assert.equal(out.featured, false);
  });
  it("only includes provided keys (partial-friendly)", () => {
    assert.deepEqual(Object.keys(pickEventContent({ shortDescription: "hi" })), ["shortDescription"]);
  });
});

describe("pickEventMeta", () => {
  it("extracts capacity (number) and waitlistOverride only when present", () => {
    assert.deepEqual(pickEventMeta({ capacity: "80", waitlistOverride: "open", title: "x" }), { capacity: 80, waitlistOverride: "open" });
    assert.deepEqual(pickEventMeta({ capacity: null }), { capacity: null });
    assert.deepEqual(pickEventMeta({ title: "x" }), {});
  });
});

describe("isApiTokenMatch", () => {
  it("true only on exact match with a configured token", () => {
    assert.equal(isApiTokenMatch("secret-abc", "secret-abc"), true);
    assert.equal(isApiTokenMatch("secret-abc", "secret-xyz"), false);
  });
  it("false when either side is missing/empty (never allow blank token)", () => {
    assert.equal(isApiTokenMatch("", ""), false);
    assert.equal(isApiTokenMatch("abc", ""), false);
    assert.equal(isApiTokenMatch("", "abc"), false);
    assert.equal(isApiTokenMatch(null, "abc"), false);
    assert.equal(isApiTokenMatch("abc", undefined), false);
  });
  it("is length-safe (no throw on mismatched lengths)", () => {
    assert.equal(isApiTokenMatch("short", "a-much-longer-token"), false);
  });
});
