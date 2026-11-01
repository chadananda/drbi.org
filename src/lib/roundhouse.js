// Roundhouse community events: weekly-repeat expansion + Mon-evening→Thu-evening check. Pure, no I/O.
// Dates are naive 'YYYY-MM-DD' Arizona days; times 'HH:MM'. Day math in UTC so DST never shifts a day.

const DAY = 86400000;
const toMs = (d) => Date.parse(d + "T00:00:00Z");
const toDate = (ms) => new Date(ms).toISOString().slice(0, 10);

/** One row per occurrence between from..to (inclusive), sorted by date then start time. */
export function expandOccurrences(events, from, to) {
  const lo = toMs(from), hi = toMs(to);
  const out = [];
  for (const e of events) {
    let t = toMs(e.date);
    if (Number.isNaN(t)) continue;
    if (e.repeat !== "weekly") {
      if (t >= lo && t <= hi) out.push({ ...e, key: `${e.id}@${e.date}` });
      continue;
    }
    const end = Math.min(hi, e.repeatUntil ? toMs(e.repeatUntil) : hi);
    if (t < lo) t += Math.ceil((lo - t) / (7 * DAY)) * 7 * DAY;
    for (; t <= end; t += 7 * DAY) {
      const date = toDate(t);
      out.push({ ...e, date, key: `${e.id}@${date}` });
    }
  }
  return out.sort((a, b) => (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || "")));
}

/** True when a start falls in the requested Mon 5pm → Thu window (Tue/Wed any time, Thu by day's end). */
export function inMidweekWindow(date, startTime = "") {
  const dow = new Date(toMs(date)).getUTCDay(); // 0 Sun … 6 Sat
  if (dow === 2 || dow === 3 || dow === 4) return true;
  if (dow === 1) return (startTime || "00:00") >= "17:00";
  return false;
}
