// Shared, stable URL slug for an event detail page. Includes the start year so annually
// repeated programs don't collide (unless the title already contains the year).
// Used by /events/[slug].astro and EventCalendar so links and lookups always agree.
export function eventSlug(ev) {
  const d = ev?.data ?? ev ?? {};
  const title = d.title || d.name || 'event';
  const base = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let year = '';
  try { if (d.startDate) year = String(new Date(d.startDate).getFullYear()); } catch {}
  return year && !base.includes(year) ? `${base}-${year}` : base;
}
