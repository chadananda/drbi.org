// Unified calendar feed for the public /calendar page: existing events (auto, from D1) merged
// with team-managed calendar_items. Each entry is a plain, date-ranged item the client renders
// across the Week/Month/Year views. Availability (green → Book on Airbnb) is computed per-day in
// the client from these entries; days with no event and no "reserved" hold are bookable.
import { getVisibleEvents, getCalendarItems, getOption } from './queries';
import { getAirbnbBlocks } from './airbnb';
import { eventSlug } from './event-slug';

// Legend: blue = event/program, purple = Holy Day, amber = DRBI-reserved.
const TYPE_COLORS = { event: '#2563eb', program: '#0e7490', holyday: '#7c3aed', reserved: '#b45309' };

export async function getCalendarData() {
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
      id: ev.id,
      title: d.name || d.title || 'Event',
      type: 'event',
      start: d.startDate,
      end: d.endDate || null,
      allDay: false,
      url: `/events/${eventSlug(ev)}`,
      color: TYPE_COLORS.event,
    });
  }
  for (const it of items) {
    entries.push({
      id: it.id,
      title: it.title,
      type: it.type,
      start: it.start,
      end: it.end,
      allDay: it.allDay,
      url: it.linkUrl || '',
      color: it.color || TYPE_COLORS[it.type] || TYPE_COLORS.program,
    });
  }

  // Airbnb bookings (imported iCal) → reserved holds so a booked date never shows as open.
  for (const b of airbnbBlocks) {
    if (!b?.start) continue;
    entries.push({
      id: `abnb-${b.start}`,
      title: b.summary || 'Booked (Airbnb)',
      type: 'reserved',
      start: b.start,
      end: b.end || null,
      allDay: true,
      url: '',
      color: TYPE_COLORS.reserved,
    });
  }

  // Stable order by start; the client re-buckets by day/week/month.
  entries.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return { entries, airbnbUrl: airbnbUrl || '' };
}
