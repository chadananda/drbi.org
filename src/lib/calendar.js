// Unified calendar feed. Merges auto events (D1) + team calendar_items + imported Airbnb blocks
// into dated entries the /calendar page renders. Team overrides (label / link / hide), managed in
// /admin/calendar, are layered on top by entry id so events and bookings can be relabeled/linked
// without touching their source records. Availability (green → Book) is computed per-day client-side.
import { getVisibleEvents, getCalendarItems, getAllCalendarItems, getOption, getCalendarOverrides } from './queries';
import { getAirbnbBlocks } from './airbnb';
import { eventSlug } from './event-slug';

// Warm legend palette: pine = event, teal = program, plum = Holy Day, terracotta = booked/in use.
const TYPE_COLORS = { event: '#356b63', program: '#4a7d75', holyday: '#7a5a86', reserved: '#b0692c' };

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+::\s+/g, ' — ').replace(/\s+/g, ' ').trim();
const teaserOf = (d) => {
  let t = stripHtml(d.shortDescription || d.fullDescription || '');
  const n = (d.name || '').trim();
  if (n && t.toLowerCase().startsWith(n.toLowerCase())) t = t.slice(n.length).replace(/^[\s:·—–-]+/, '');
  return t.length > 150 ? t.slice(0, 150).replace(/\s+\S*$/, '') + '…' : t;
};

// Build the raw, un-overridden entry list (+ airbnbUrl). Each entry has a stable `id` (the override
// key), a `kind` (event | item | airbnb) for the admin editor, and its base label/link.
async function buildEntries() {
  const [events, items, airbnbUrl, airbnbBlocks] = await Promise.all([
    getVisibleEvents().catch(() => []),
    getCalendarItems().catch(() => []),
    getOption('airbnb_listing_url').catch(() => null),
    getAirbnbBlocks().catch(() => []),
  ]);

  const entries = [];
  for (const ev of events) {
    const d = ev.data || {};
    if (!d.startDate) continue;
    entries.push({
      id: ev.id, kind: 'event', type: 'event',
      title: d.name || d.title || 'Event',
      start: d.startDate, end: d.endDate || null, allDay: false,
      url: `/events/${eventSlug(ev)}`, color: TYPE_COLORS.event,
      // Rich fields for the visual showcase + grid thumbnails (overrides still apply to title/url).
      image: d.mainImage || '', category: (d.categories || [])[0] || '', teaser: teaserOf(d),
    });
  }
  for (const it of items) {
    entries.push({
      id: it.id, kind: 'item', type: it.type,
      variant: it.type === 'reserved' ? 'drbi' : undefined,
      title: it.title, start: it.start, end: it.end, allDay: it.allDay,
      url: it.linkUrl || '', color: it.color || TYPE_COLORS[it.type] || TYPE_COLORS.program,
    });
  }
  // Airbnb blocks: an actual stay ("booked") is labeled by source ("Airbnb"); turnaround/host
  // padding blocks the day but carries no label (kept off the public grid, still not bookable).
  for (const b of airbnbBlocks) {
    if (!b?.start) continue;
    entries.push({
      id: `abnb-${b.start}`, kind: 'airbnb', type: 'reserved',
      variant: b.booked ? 'airbnb-booked' : 'airbnb-block',
      title: b.booked ? 'Airbnb' : '',
      start: b.start, end: b.end || null, allDay: true,
      url: '', color: b.booked ? TYPE_COLORS.reserved : '#c9b299',
    });
  }
  return { entries, airbnbUrl: airbnbUrl || '' };
}

// Public feed: apply overrides (relabel / relink / hide) and drop hidden entries.
export async function getCalendarData() {
  const [{ entries, airbnbUrl }, overrides] = await Promise.all([
    buildEntries(),
    getCalendarOverrides().catch(() => ({})),
  ]);
  const out = [];
  for (const e of entries) {
    const o = overrides[e.id];
    if (o && o.hidden) continue;
    out.push({ ...e, title: (o && o.label) ? o.label : e.title, url: (o && o.linkUrl) ? o.linkUrl : e.url });
  }
  out.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return { entries: out, airbnbUrl };
}

// Admin manager: one row per calendar entry (events + ALL custom items incl. hidden + Airbnb
// blocks) with its base label/link and any override, so the team can relabel/relink/hide anything.
export async function getAdminCalendarEntries() {
  const [events, items, airbnbBlocks, overrides] = await Promise.all([
    getVisibleEvents().catch(() => []),
    getAllCalendarItems().catch(() => []),
    getAirbnbBlocks().catch(() => []),
    getCalendarOverrides().catch(() => ({})),
  ]);
  const rows = [];
  for (const ev of events) {
    const d = ev.data || {};
    if (!d.startDate) continue;
    rows.push({ id: ev.id, kind: 'event', type: 'event', baseTitle: d.name || d.title || 'Event',
      baseUrl: `/events/${eventSlug(ev)}`, start: d.startDate, end: d.endDate || null, override: overrides[ev.id] || null });
  }
  for (const it of items) {
    rows.push({ id: it.id, kind: 'item', type: it.type, baseTitle: it.title, baseUrl: it.linkUrl || '',
      start: it.start, end: it.end, itemHidden: !it.visible, override: null });
  }
  for (const b of airbnbBlocks) {
    if (!b?.start) continue;
    const id = `abnb-${b.start}`;
    rows.push({ id, kind: 'airbnb', type: 'reserved', booked: !!b.booked,
      baseTitle: b.booked ? 'Airbnb booking' : 'Airbnb — unavailable', baseUrl: '',
      start: b.start, end: b.end || null, override: overrides[id] || null });
  }
  return rows.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
