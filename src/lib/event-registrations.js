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

/** One row per attendee: name, email (from their order), ticket type, check-in, and answers. */
export function buildRegistrantRows(tickets = [], orders = [], questions = []) {
  const emailByOrder = new Map();
  for (const o of orders) emailByOrder.set(o?._id ?? o?.id, o?.email ?? "");
  const labels = questionLabels(questions);
  return tickets
    .filter((t) => !isCancelled(t))
    .map((t) => ({
      name: [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim() || "(no name)",
      email: t?.email || emailByOrder.get(t?.orderId) || "",
      ticketType: t?.ticketTypeName || "",
      checkedIn: !!(t?.checkIn?.checkedIn ?? t?.checkedIn),
      answers: (t?.additionalFields ?? []).map((f) => ({ label: labels.get(f?.questionId) ?? "Question", value: fieldValue(f) })).filter((a) => a.value),
    }));
}
