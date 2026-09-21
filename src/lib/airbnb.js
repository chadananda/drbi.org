// Airbnb availability import. Fetches the listing's iCal export (admin-set airbnb_ical_url),
// parses the blocked date ranges (real bookings + host blocks), and caches them in KV. The
// public calendar merges these as "reserved" so a date booked on Airbnb never shows as open.
// Refreshed traffic-driven (SWR, ~30 min) — the calendar page kicks a background refresh.
import { getEnv } from './runtime-env';
import { getOption } from './queries';

const KV_BLOCKS = 'airbnb:blocks';
const KV_TS = 'airbnb:blocks:ts';
const REFRESH_MS = 30 * 60 * 1000;

const isoFromICal = (v) => { const m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

// Minimal VEVENT parser → [{ start:'YYYY-MM-DD', end:'YYYY-MM-DD'|null, summary }].
// Airbnb blocks are all-day ranges with an *exclusive* DTEND, so we step back a day for display.
export function parseICal(text) {
  const out = [];
  const events = String(text || '').split('BEGIN:VEVENT').slice(1);
  for (const chunk of events) {
    const seg = chunk.split('END:VEVENT')[0];
    const field = (k) => { const m = seg.match(new RegExp(k + '[^:\\r\\n]*:([^\\r\\n]+)')); return m ? m[1].trim() : ''; };
    const start = isoFromICal(field('DTSTART'));
    if (!start) continue;
    let end = isoFromICal(field('DTEND'));
    if (end && end !== start) {
      const d = new Date(end + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      end = d.toISOString().slice(0, 10);
    }
    out.push({ start, end: end && end !== start ? end : null, summary: field('SUMMARY') || 'Booked (Airbnb)' });
  }
  return out;
}

export async function getAirbnbBlocks() {
  try {
    const raw = await getEnv('SESSION')?.get(KV_BLOCKS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function refreshAirbnbBlocks() {
  const url = await getOption('airbnb_ical_url').catch(() => null);
  if (!url) return;
  try {
    const res = await fetch(url, { cf: { cacheTtl: 300 } });
    if (!res.ok) return;
    const blocks = parseICal(await res.text());
    const kv = getEnv('SESSION');
    await kv?.put(KV_BLOCKS, JSON.stringify(blocks));
    await kv?.put(KV_TS, String(Date.now()));
  } catch { /* fail soft — keep the last good cache */ }
}

// Traffic-driven: refresh at most every REFRESH_MS, in the background so the page never waits.
export async function maybeRefreshAirbnb(cfCtx) {
  try {
    const ts = Number((await getEnv('SESSION')?.get(KV_TS)) || 0);
    if (Date.now() - ts < REFRESH_MS) return;
    const p = refreshAirbnbBlocks();
    if (cfCtx?.waitUntil) cfCtx.waitUntil(p); else await p;
  } catch { /* ignore */ }
}
