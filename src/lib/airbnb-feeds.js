// Airbnb multi-listing sync, pure parts (no I/O, unit-tested): iCal parsing, the admin
// "Label | space | url" feed list, per-feed block merging, and Roundhouse-conflict lookup.
// space: facility (whole campus incl. Hall + Roundhouse) | roundhouse | hall | lodging (apartments/studios).
export const SPACES = ['facility', 'roundhouse', 'hall', 'lodging'];
const LEGACY_LABEL = 'Desert Rose Retreat Center';
const isoFromICal = (v) => { const m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
// Minimal VEVENT parser → [{ start, end|null, summary, booked }]. Airbnb DTEND is exclusive, so step
// back a day (end = last night). Airbnb labels a guest stay "Reserved", padding/host blocks
// "Airbnb (Not available)". DESCRIPTION (guest phone last-4 + reservation URL) is never read.
export function parseICal(text) {
  const out = [];
  for (const chunk of String(text || '').split('BEGIN:VEVENT').slice(1)) {
    const seg = chunk.split('END:VEVENT')[0];
    const field = (k) => { const m = seg.match(new RegExp('\\n?' + k + '[^:\\r\\n]*:([^\\r\\n]+)')); return m ? m[1].trim() : ''; };
    const start = isoFromICal(field('DTSTART'));
    if (!start) continue;
    let end = isoFromICal(field('DTEND'));
    if (end && end !== start) { const d = new Date(end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); end = d.toISOString().slice(0, 10); }
    const summary = field('SUMMARY') || 'Booked (Airbnb)';
    out.push({ start, end: end && end !== start ? end : null, summary, booked: /reserved/i.test(summary) });
  }
  return out;
}
// Admin textarea ↔ feed list. One feed per line: "Label | space | iCal URL"; lines without a URL are dropped.
export function parseFeedLines(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.split('|').map((s) => s.trim())).filter((p) => p.length >= 3 && /^https?:\/\//.test(p[2]))
    .map(([label, space, url]) => ({ label: label.slice(0, 80) || 'Listing', space: SPACES.includes(space.toLowerCase()) ? space.toLowerCase() : 'facility', url: url.slice(0, 1000) }));
}
export const feedsToLines = (feeds) => (feeds || []).map((f) => `${f.label} | ${f.space} | ${f.url}`).join('\n');
// Stored option (JSON) → feeds; before any list is saved, the legacy single airbnb_ical_url is the whole facility.
export function resolveFeeds(json, legacyUrl) {
  try { const f = JSON.parse(json || 'null'); if (Array.isArray(f)) return f.filter((x) => x && x.url); } catch {}
  return legacyUrl ? [{ label: LEGACY_LABEL, space: 'facility', url: legacyUrl }] : [];
}
// results: [{ feed, blocks|null }] — null = fetch failed, so keep that feed's previous blocks.
export function mergeFeedBlocks(prev, results) {
  return results.flatMap(({ feed, blocks }) => blocks
    ? blocks.map((b) => ({ ...b, feed: feed.label, space: feed.space }))
    : (prev || []).filter((b) => b.feed === feed.label));
}
// The booking that takes the Roundhouse on a 'YYYY-MM-DD' night, or null. Only real stays on
// whole-facility/Roundhouse listings count; apartment stays and turnaround padding don't.
export const roundhouseConflict = (date, blocks) =>
  (blocks || []).find((b) => b.booked && (b.space === 'facility' || b.space === 'roundhouse') && date >= b.start && date <= (b.end || b.start)) || null;
