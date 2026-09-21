// DRBI availability feed (iCal export). Publishes events + facility-blocking calendar holds as
// all-day VEVENTs so Airbnb (and Danny & Flora's co-host listings) can *import* this feed and
// auto-block those dates — the DRBI calendar is the source of truth flowing outward. Holy Days are
// informational and don't occupy the facility, so they're excluded.
import type { APIRoute } from 'astro';
import { getVisibleEvents, getCalendarItems } from '@lib/queries';
import { eventSlug } from '@lib/event-slug';

export const prerender = false;

const BLOCKING_TYPES = new Set(['reserved', 'program', 'event']);

// 'YYYY-MM-DD' or full ISO → 'YYYYMMDD' (all-day DATE value).
const dateStamp = (iso: string) => String(iso || '').slice(0, 10).replace(/-/g, '');
// iCal all-day DTEND is exclusive; add a day so a single-day range covers that day.
const nextDay = (iso: string) => {
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};
const esc = (s: string) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');

export const GET: APIRoute = async ({ url }) => {
  const origin = url.origin;
  const [events, items] = await Promise.all([
    getVisibleEvents().catch(() => []),
    getCalendarItems().catch(() => []),
  ]);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Desert Rose Bahá\'í Institute//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Desert Rose Bahá\'í Institute',
    'X-WR-TIMEZONE:America/Phoenix',
  ];

  const push = (uid: string, start: string, end: string | null, summary: string, urlPath: string) => {
    if (!start) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}@drbi.org`);
    lines.push(`DTSTAMP:${dateStamp(start)}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(end || start)}`);
    lines.push(`SUMMARY:${esc(summary)}`);
    if (urlPath) lines.push(`URL:${origin}${urlPath}`);
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  };

  for (const ev of events as any[]) {
    const d = ev.data || {};
    if (!d.startDate) continue;
    push(`event-${ev.id}`, d.startDate, d.endDate || null, d.name || d.title || 'DRBI Event', `/events/${eventSlug(ev)}`);
  }
  for (const it of items as any[]) {
    if (!BLOCKING_TYPES.has(it.type)) continue;
    push(`cal-${it.id}`, it.start, it.end, it.title || 'DRBI (reserved)', it.linkUrl || '');
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="drbi-availability.ics"',
      'cache-control': 'public, max-age=1800',
    },
  });
};
