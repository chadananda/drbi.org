import { test } from "node:test";
import assert from "node:assert/strict";
import { parseICal, parseFeedLines, feedsToLines, resolveFeeds, mergeFeedBlocks, roundhouseConflict } from "../../src/lib/airbnb-feeds.js";

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261106
DTEND;VALUE=DATE:20261108
SUMMARY:Reserved
DESCRIPTION:Phone Number (Last 4 Digits): 1234
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261111
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

test("parseICal: exclusive DTEND stepped back, booked vs blocked, no description", () => {
  const b = parseICal(ICS);
  assert.deepEqual(b, [
    { start: "2026-11-06", end: "2026-11-07", summary: "Reserved", booked: true },
    { start: "2026-11-10", end: null, summary: "Airbnb (Not available)", booked: false },
  ]);
});

test("parseFeedLines: 'Label | space | url' lines, bad space → facility, junk dropped", () => {
  const f = parseFeedLines("Retreat Center | facility | https://www.airbnb.com/calendar/ical/1.ics?t=a\nApt 2 | lodging | https://www.airbnb.com/calendar/ical/2.ics\n\nnonsense line\nHall | ballroom | https://x/3.ics");
  assert.deepEqual(f, [
    { label: "Retreat Center", space: "facility", url: "https://www.airbnb.com/calendar/ical/1.ics?t=a" },
    { label: "Apt 2", space: "lodging", url: "https://www.airbnb.com/calendar/ical/2.ics" },
    { label: "Hall", space: "facility", url: "https://x/3.ics" },
  ]);
  assert.equal(parseFeedLines(feedsToLines(f)).length, 3);
});

test("resolveFeeds: falls back to the legacy single iCal URL", () => {
  assert.deepEqual(resolveFeeds(null, "https://a.ics"), [{ label: "Desert Rose Retreat Center", space: "facility", url: "https://a.ics" }]);
  assert.deepEqual(resolveFeeds('[{"label":"R","space":"roundhouse","url":"https://r.ics"}]', "https://a.ics"), [{ label: "R", space: "roundhouse", url: "https://r.ics" }]);
  assert.deepEqual(resolveFeeds("", ""), []);
});

test("mergeFeedBlocks: tags blocks by feed; a failed feed keeps its last good blocks", () => {
  const prev = [{ start: "2026-11-01", end: null, booked: true, feed: "Apt 2", space: "lodging" }];
  const out = mergeFeedBlocks(prev, [
    { feed: { label: "Retreat Center", space: "facility" }, blocks: [{ start: "2026-11-06", end: "2026-11-07", booked: true }] },
    { feed: { label: "Apt 2", space: "lodging" }, blocks: null },
  ]);
  assert.deepEqual(out, [
    { start: "2026-11-06", end: "2026-11-07", booked: true, feed: "Retreat Center", space: "facility" },
    { start: "2026-11-01", end: null, booked: true, feed: "Apt 2", space: "lodging" },
  ]);
});

test("roundhouseConflict: only real bookings of facility/roundhouse listings, inclusive nights", () => {
  const blocks = [
    { start: "2026-11-06", end: "2026-11-07", booked: true, space: "facility", feed: "Retreat Center" },
    { start: "2026-11-10", end: null, booked: false, space: "facility" },
    { start: "2026-11-11", end: "2026-11-12", booked: true, space: "lodging" },
    { start: "2026-11-18", end: null, booked: true, space: "roundhouse", feed: "Roundhouse" },
  ];
  assert.equal(roundhouseConflict("2026-11-07", blocks)?.feed, "Retreat Center");
  assert.equal(roundhouseConflict("2026-11-08", blocks), null);
  assert.equal(roundhouseConflict("2026-11-10", blocks), null);
  assert.equal(roundhouseConflict("2026-11-11", blocks), null);
  assert.equal(roundhouseConflict("2026-11-18", blocks)?.feed, "Roundhouse");
});
