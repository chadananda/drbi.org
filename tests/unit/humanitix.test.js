// Tests for src/lib/humanitix.js — the read-only Humanitix → DRBI event mapper + fetch client.
// Focus: field mapping correctness, defensive fallbacks, and the never-publish invariant
// (the mapper must NOT emit a `visible` field so synced rows default to DRAFT).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapHumanitixEvent, fetchHumanitixEvents } from "../../src/lib/humanitix.js";

// Representative Humanitix API event (fields per the public v1 API, with drift fallbacks).
const sample = {
  _id: "6a26e3ad013e63d5e979aa70",
  name: "Division, Unity, and the Lord of Books",
  slug: "thanksgiving-iqan-weekend",
  description: "<p>A weekend intensive.</p>",
  startDate: "2026-11-26T18:00:00.000Z",
  endDate: "2026-11-29T16:00:00.000Z",
  currency: "USD",
  category: "Education",
  updatedAt: "2026-06-01T00:00:00.000Z",
  bannerImage: { url: "https://img.humanitix.com/banner.jpg" },
  featureImage: { url: "https://img.humanitix.com/feature.jpg" },
  eventLocation: { venueName: "Desert Rose", address: "Eloy, AZ", type: "address" },
  ticketTypes: [
    { name: "Full Program - Adult", price: 480, disabled: false },
    { name: "Full Program - Minor", price: 340 },
    { name: "Retired Ticket", price: 0, disabled: true },
  ],
};

describe("mapHumanitixEvent", () => {
  it("maps core identity fields with the hx id prefix and humanitix source", () => {
    const m = mapHumanitixEvent(sample);
    assert.equal(m.id, "event-hx-6a26e3ad013e63d5e979aa70");
    assert.equal(m.externalId, "6a26e3ad013e63d5e979aa70");
    assert.equal(m.source, "humanitix");
    assert.equal(m.title, "Division, Unity, and the Lord of Books");
    assert.equal(m.organizer, "DRBI");
  });

  it("visible mirrors the source published+public state (auto-show when live on Humanitix)", () => {
    assert.equal(mapHumanitixEvent({ ...sample, published: true, public: true }).visible, true);
    assert.equal(mapHumanitixEvent({ ...sample, published: false, public: true }).visible, false);
    assert.equal(mapHumanitixEvent({ ...sample, published: true, public: false }).visible, false);
    assert.equal(mapHumanitixEvent({ ...sample }).visible, false); // no flags → hidden
  });

  it("builds the registration URL from the slug", () => {
    const m = mapHumanitixEvent(sample);
    assert.equal(m.registrationUrl, "https://events.humanitix.com/thanksgiving-iqan-weekend");
    assert.equal(m.url, m.registrationUrl);
  });

  it("maps only enabled ticket types into price, preserving currency", () => {
    const m = mapHumanitixEvent(sample);
    assert.equal(m.price.length, 2);
    assert.deepEqual(m.price[0], { label: "Full Program - Adult", amount: 480, currency: "USD" });
    assert.ok(!m.price.some((p) => p.label === "Retired Ticket"), "disabled tickets excluded");
  });

  it("uses the banner as the single image (deduped)", () => {
    const m = mapHumanitixEvent(sample);
    assert.equal(m.mainImage, "https://img.humanitix.com/banner.jpg");
    assert.deepEqual(m.images, ["https://img.humanitix.com/banner.jpg"]);
  });

  it("normalizes location from eventLocation", () => {
    const m = mapHumanitixEvent(sample);
    assert.deepEqual(m.location, { venue: "Desert Rose", address: "Eloy, AZ", online: "", type: "address" });
  });

  it("falls back to `location` and `id` and featureImage when banner/eventLocation absent", () => {
    const m = mapHumanitixEvent({
      id: "abc",
      name: "X",
      location: { venueName: "Hall" },
      featureImage: { url: "https://img/f.jpg" },
    });
    assert.equal(m.externalId, "abc");
    assert.equal(m.location.venue, "Hall");
    assert.equal(m.mainImage, "https://img/f.jpg");
    assert.equal(m.price, null, "no ticket types → null price");
  });

  it("handles a minimal/empty event without throwing", () => {
    const m = mapHumanitixEvent({});
    assert.equal(m.source, "humanitix");
    assert.equal(m.title, "");
    assert.equal(m.registrationUrl, "");
    assert.deepEqual(m.categories, []);
    assert.deepEqual(m.additionalDates, []);
  });
});

describe("fetchHumanitixEvents", () => {
  const okResponse = (events) => ({
    ok: true,
    status: 200,
    json: async () => ({ events }),
    text: async () => "",
  });

  it("sends the x-api-key header and returns events", async () => {
    let seenHeaders;
    const fetchImpl = async (_url, init) => {
      seenHeaders = init.headers;
      return okResponse([sample]);
    };
    const events = await fetchHumanitixEvents("secret-key", { fetchImpl });
    assert.equal(seenHeaders["x-api-key"], "secret-key");
    assert.equal(events.length, 1);
    assert.equal(events[0]._id, sample._id);
  });

  it("paginates until a short page and stops", async () => {
    const pages = [Array.from({ length: 100 }, (_, i) => ({ _id: `a${i}` })), [{ _id: "last" }]];
    let calls = 0;
    const fetchImpl = async () => okResponse(pages[calls++] ?? []);
    const events = await fetchHumanitixEvents("k", { fetchImpl, pageSize: 100 });
    assert.equal(calls, 2, "stops after the short second page");
    assert.equal(events.length, 101);
  });

  it("throws with status + body on a non-ok response", async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, text: async () => "Forbidden" });
    await assert.rejects(fetchHumanitixEvents("bad", { fetchImpl }), /Humanitix API 403: Forbidden/);
  });
});
