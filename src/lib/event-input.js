// :arch: pure normalize/validate for the events write API. Maps public JSON payloads → the
//        camelCase shape createEvent/updateEvent expect (which mirrors shapeEvent's output).
// :why: write endpoints MUST whitelist fields — callers can never set source/externalId/
//       manuallyEdited/registeredCount — and location must land in one canonical shape.
// :rules: canonical location = {venue,address,online}. Required on create: title + startDate.
//         source is ALWAYS forced to 'manual' by the endpoint, never taken from input.
// :deps: no I/O — safe to unit test. Consumers: src/pages/api/events.js, api/events/[id].js
const CONTENT_FIELDS = ['title','name','startDate','endDate','shortDescription','fullDescription','price','registrationUrl','url','mainImage','teacherImage','images','highlights','eventSchedule','organizer','categories','additionalDates','visible','featured'];
export function normalizeLocation(loc) {
  if (loc == null || typeof loc !== 'object' || Array.isArray(loc)) return undefined;
  const venue = loc.venue ?? loc.name ?? '';
  const online = loc.online ?? '';
  let address = loc.address ?? '';
  if (!address) address = [loc.city, loc.state, loc.zip].filter(Boolean).join(', ');
  const out = {};
  if (venue) out.venue = String(venue);
  if (address) out.address = String(address);
  if (online) out.online = String(online);
  return out;
}
// Only the provided, whitelisted content keys (partial-friendly for PATCH). Ignores everything else.
export function pickEventContent(payload = {}) {
  const out = {};
  for (const k of CONTENT_FIELDS) if (payload[k] !== undefined) out[k] = payload[k];
  if (payload.location !== undefined) out.location = normalizeLocation(payload.location);
  if (out.visible !== undefined) out.visible = !!out.visible;
  if (out.featured !== undefined) out.featured = !!out.featured;
  return out;
}
// DRBI-internal meta (capacity + waitlist), stored via setEventMeta — separate from content.
export function pickEventMeta(payload = {}) {
  const out = {};
  if (payload.capacity !== undefined) out.capacity = payload.capacity === null ? null : Number(payload.capacity);
  if (payload.waitlistOverride !== undefined) out.waitlistOverride = payload.waitlistOverride;
  return out;
}
const isDate = (v) => !isNaN(Date.parse(v));
export function validateEventInput(payload = {}, { partial = false } = {}) {
  const errors = [];
  if (!partial) {
    if (!payload.title || !String(payload.title).trim()) errors.push('title is required');
    if (!payload.startDate || !String(payload.startDate).trim()) errors.push('startDate is required');
  }
  if (payload.startDate != null && String(payload.startDate).trim() && !isDate(payload.startDate)) errors.push('startDate must be an ISO date');
  if (payload.endDate != null && String(payload.endDate).trim() && !isDate(payload.endDate)) errors.push('endDate must be an ISO date');
  if (payload.registrationUrl != null && payload.registrationUrl !== '' && !/^https?:\/\//i.test(payload.registrationUrl)) errors.push('registrationUrl must be an http(s) URL');
  if (payload.waitlistOverride != null && !['open','closed'].includes(payload.waitlistOverride)) errors.push("waitlistOverride must be 'open', 'closed', or null");
  if (payload.capacity != null && (isNaN(Number(payload.capacity)) || Number(payload.capacity) < 0)) errors.push('capacity must be a non-negative number');
  return errors;
}
