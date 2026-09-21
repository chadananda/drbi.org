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
      variant: it.type === 'reserved' ? 'drbi' : undefined,
      start: it.start,
      end: it.end,
      allDay: it.allDay,
      url: it.linkUrl || '',
      color: it.color || TYPE_COLORS[it.type] || TYPE_COLORS.program,
    });
  }

  // Airbnb blocks (imported iCal) → reserved so a taken date never shows as open. An actual guest
  // stay ("booked") and turnaround/host padding ("blocked") stay visually distinct on the calendar.
  for (const b of airbnbBlocks) {
    if (!b?.start) continue;
    // Actual guest stay → labeled by its source ("Airbnb"). Turnaround/host padding → still blocks
    // the day (never shown bookable) but carries no label, so the public calendar isn't cluttered
    // with cleaning days. The client hides the label for the 'airbnb-block' variant.
    entries.push({
      id: `abnb-${b.start}`,
      title: b.booked ? 'Airbnb' : '',
      type: 'reserved',
      variant: b.booked ? 'airbnb-booked' : 'airbnb-block',
      start: b.start,
      end: b.end || null,
      allDay: true,
      url: '',
      color: b.booked ? TYPE_COLORS.reserved : '#c9b299',
    });
  }

  // Stable order by start; the client re-buckets by day/week/month.
  entries.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return { entries, airbnbUrl: airbnbUrl || '' };
}
