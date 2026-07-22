// Aggregate Humanitix orders + tickets into registration stats and a registrant list
// (attendee + their checkout answers). Pure — unit tested. See admin/events/[id]/registrants.

const donationOf = (o) => Number(o?.clientDonation ?? o?.totals?.clientDonation ?? 0) || 0;
const isCancelled = (x) => (x?.status ?? "complete") === "cancelled";

/** Summary stats for an event's registrations. */
export function computeEventStats(orders = [], tickets = []) {
  const live = tickets.filter((t) => !isCancelled(t));
  const revenue = orders.reduce((s, o) => s + (Number(o?.totals?.total ?? o?.total ?? 0) || 0), 0);
  const donationTotal = orders.reduce((s, o) => s + donationOf(o), 0);
  const donationCount = orders.filter((o) => donationOf(o) > 0).length;
  const byTicketType = {};
  for (const t of live) { const n = t.ticketTypeName || "Ticket"; byTicketType[n] = (byTicketType[n] || 0) + 1; }
  return { registrations: live.length, orders: orders.length, revenue, donationTotal, donationCount, byTicketType };
}

/** questionId → label map, from the event's additionalQuestions. */
export function questionLabels(questions = []) {
  const m = new Map();
  for (const q of questions) m.set(q?._id ?? q?.id, q?.question ?? q?.name ?? q?.label ?? "Question");
  return m;
}

function fieldValue(f) {
  if (f?.value != null && f.value !== "") return Array.isArray(f.value) ? f.value.join(", ") : String(f.value);
  if (f?.details) { const d = f.details; return [d.street, d.suburb, d.city, d.state, d.postalCode, d.country].filter(Boolean).join(", "); }
  return "";
}

/** Grayed placeholder data — shown (clearly labelled) when an event has no registrations yet. */
export function sampleRegistrants() {
  const q1 = 'Where will you stay?', q2 = 'Meal preference';
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString(); // newest first
  const rows = [
    { name: 'Amelia Hart', email: 'amelia@example.com', phone: '+1 480-555-0142', ticketType: 'Full Weekend — Adult', checkedIn: false, registeredAt: ago(2), answers: [{ label: q1, value: 'Dorm A' }, { label: q2, value: 'Vegetarian' }] },
    { name: 'Noah Reed', email: 'noah@example.com', phone: '+1 602-555-0199', ticketType: 'Full Weekend — Adult', checkedIn: true, registeredAt: ago(20), answers: [{ label: q1, value: 'Apartment' }, { label: q2, value: 'No preference' }] },
    { name: 'Sofia Marín', email: 'sofia@example.com', phone: '+1 520-555-0170', ticketType: 'Full Weekend — Minor (under 18)', checkedIn: false, registeredAt: ago(52), answers: [{ label: q1, value: 'Dorm B' }, { label: q2, value: 'Gluten-free' }] },
    { name: 'Liam Osei', email: 'liam@example.com', phone: '', ticketType: 'Local / Commuter', checkedIn: false, registeredAt: ago(74), answers: [{ label: q1, value: 'Commuting' }, { label: q2, value: 'Vegan' }] },
  ];
  const stats = { registrations: 4, orders: 3, revenue: 1360, donationTotal: 170, donationCount: 1, byTicketType: { 'Full Weekend — Adult': 2, 'Full Weekend — Minor (under 18)': 1, 'Local / Commuter': 1 } };
  return { rows, stats, questionCols: [q1, q2] };
}

/** One row per attendee: name, email (from their order), ticket type, check-in, answers, and
 * when they registered. Ordered NEWEST-FIRST (most recent registration at the top) so new
 * sign-ups appear as they come in. Rows with no usable timestamp keep their original (API)
 * order at the bottom. */
export function buildRegistrantRows(tickets = [], orders = [], questions = []) {
  const emailByOrder = new Map();
  const phoneByOrder = new Map();
  const dateByOrder = new Map();
  for (const o of orders) {
    const oid = o?._id ?? o?.id;
    emailByOrder.set(oid, o?.email ?? "");
    phoneByOrder.set(oid, o?.mobile ?? o?.phone ?? o?.buyerDetails?.mobile ?? o?.buyer?.mobile ?? "");
    dateByOrder.set(oid, o?.createdAt ?? o?.orderDate ?? o?.createdDate ?? o?.date ?? null);
  }
  const labels = questionLabels(questions);
  const rows = tickets
    .filter((t) => !isCancelled(t))
    .map((t) => ({
      name: [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim() || "(no name)",
      email: t?.email || emailByOrder.get(t?.orderId) || "",
      phone: t?.mobile ?? t?.phone ?? phoneByOrder.get(t?.orderId) ?? "",
      ticketType: t?.ticketTypeName || "",
      checkedIn: !!(t?.checkIn?.checkedIn ?? t?.checkedIn),
      registeredAt: t?.createdAt ?? t?.orderDate ?? dateByOrder.get(t?.orderId) ?? null,
      answers: (t?.additionalFields ?? []).map((f) => ({ label: labels.get(f?.questionId) ?? "Question", value: fieldValue(f) })).filter((a) => a.value),
    }));
  // Newest first; undated rows keep original order at the bottom (stable via original index).
  return rows
    .map((r, i) => ({ r, i, t: r.registeredAt ? Date.parse(r.registeredAt) : NaN }))
    .sort((a, b) => {
      if (Number.isNaN(a.t) && Number.isNaN(b.t)) return a.i - b.i;
      if (Number.isNaN(a.t)) return 1;
      if (Number.isNaN(b.t)) return -1;
      return b.t - a.t || a.i - b.i;
    })
    .map((x) => x.r);
}
