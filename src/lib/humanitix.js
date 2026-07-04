// Read-only Humanitix sync client. Maps Humanitix API events → DRBI event `data` shape
// (consumed by upsertSyncedEvent). NEVER sets visibility — humans own the publish action.
// Deps: fetch. API: https://api.humanitix.com/v1 (auth via x-api-key header).
// Field shapes are defensive: the public API has drifted names (eventLocation vs location,
// bannerImage vs featureImage), so we read several fallbacks. See humanitix.test.js fixture.

const HX_API_BASE = "https://api.humanitix.com/v1";

/**
 * @typedef {Object} HumanitixEvent
 * @property {string} [_id]
 * @property {string} [id]
 * @property {string} [name]
 * @property {string} [slug]
 * @property {string} [description]
 * @property {string} [startDate]
 * @property {string} [endDate]
 * @property {Array<{startDate?:string,endDate?:string}>} [dates]
 * @property {Object} [eventLocation]
 * @property {Object} [location]
 * @property {{url?:string}} [bannerImage]
 * @property {{url?:string}} [featureImage]
 * @property {string} [currency]
 * @property {Array<{name:string,price:number,disabled?:boolean}>} [ticketTypes]
 * @property {string} [category]
 * @property {string} [updatedAt]
 */

/**
 * Map one Humanitix API event to the DRBI event `data` object.
 * Deliberately omits `visible` so upsertSyncedEvent can default new rows to DRAFT.
 * @param {HumanitixEvent} hx
 */
export function mapHumanitixEvent(hx) {
  const externalId = hx._id ?? hx.id ?? "";
  const loc = hx.eventLocation ?? hx.location ?? {};
  const price = (hx.ticketTypes ?? [])
    .filter((t) => t && !t.disabled)
    .map((t) => ({ label: t.name, amount: t.price, currency: hx.currency ?? "USD" }));
  const registrationUrl = hx.slug ? `https://events.humanitix.com/${hx.slug}` : "";
  // Humanitix events usually have a single banner image — dedupe banner/feature so we don't
  // store the same URL twice (or a redundant variant).
  const mainImage = hx.bannerImage?.url ?? hx.featureImage?.url ?? "";
  const images = mainImage ? [mainImage] : [];
  return {
    id: `event-hx-${externalId}`,
    externalId,
    source: "humanitix",
    title: hx.name ?? "",
    shortDescription: "",
    fullDescription: hx.description ?? "",
    startDate: hx.startDate ?? "",
    endDate: hx.endDate ?? "",
    // Humanitix's `dates` array repeats the primary occurrence — drop that duplicate so the
    // event isn't rendered twice; keep only genuinely additional (recurring) dates.
    additionalDates: (hx.dates ?? [])
      .filter((d) => d && d.startDate && d.startDate !== hx.startDate)
      .map((d) => ({ startDate: d.startDate, endDate: d.endDate ?? d.startDate })),
    location: {
      venue: loc.venueName ?? "",
      address: loc.address ?? "",
      online: loc.onlineUrl ?? "",
      type: loc.type ?? "",
    },
    price: price.length ? price : null,
    registrationUrl,
    url: registrationUrl,
    slug: hx.slug ?? "",
    mainImage,
    images,
    organizer: "DRBI",
    categories: hx.category ? [hx.category] : [],
    lastModified: hx.updatedAt ?? null,
    // Auto-show on our site only when the event is live (published + public) on Humanitix.
    visible: !!(hx.published && hx.public),
  };
}

/**
 * Fetch all events for the API key's org (paginates until a short page is returned).
 * @param {string} apiKey
 * @param {{pageSize?:number,maxPages?:number,fetchImpl?:typeof fetch}} [opts]
 * @returns {Promise<HumanitixEvent[]>}
 */
export async function fetchHumanitixEvents(apiKey, opts = {}) {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 20;
  const doFetch = opts.fetchImpl ?? fetch;
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await doFetch(`${HX_API_BASE}/events?page=${page}&pageSize=${pageSize}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Humanitix API ${res.status}: ${text}`);
    }
    const body = await res.json();
    const batch = body.events ?? body.data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break; // last page
  }
  return all;
}

// ── Orders (for the sponsor-a-youth follow-up) ───────────────────────────────
/** Fetch all orders for one event. GET /events/{id}/orders → { total, page, orders }. */
export async function fetchHumanitixOrders(apiKey, eventId, opts = {}) {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 20;
  const doFetch = opts.fetchImpl ?? fetch;
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await doFetch(`${HX_API_BASE}/events/${eventId}/orders?page=${page}&pageSize=${pageSize}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Humanitix orders API ${res.status}`);
    const body = await res.json();
    const batch = body.orders ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

/** Fetch all (complete) tickets/attendees for one event, incl. their checkout answers. */
export async function fetchHumanitixTickets(apiKey, eventId, opts = {}) {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 40;
  const doFetch = opts.fetchImpl ?? fetch;
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await doFetch(`${HX_API_BASE}/events/${eventId}/tickets?page=${page}&pageSize=${pageSize}&status=complete`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Humanitix tickets API ${res.status}`);
    const body = await res.json();
    const batch = body.tickets ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

/** Donation amount on an order (clientDonation is the buyer's own donation). */
export function orderDonation(order) {
  return Number(order?.clientDonation ?? order?.totals?.clientDonation ?? order?.purchaseTotals?.clientDonation ?? 0) || 0;
}

/** Normalize a raw Humanitix order to the fields the sponsor follow-up needs. */
export function shapeOrder(order) {
  return {
    id: order?._id ?? order?.id ?? "",
    email: String(order?.email ?? "").trim().toLowerCase(),
    name: [order?.firstName, order?.lastName].filter(Boolean).join(" ").trim(),
    createdAt: order?.createdAt ?? null,
    status: String(order?.status ?? order?.financialStatus ?? "").toLowerCase(),
    donation: orderDonation(order),
  };
}

/**
 * Eligible for a "sponsor a youth" invite: a completed order, registered at least
 * `delayDays` ago, that has NOT already donated/sponsored. (Dedup — already emailed —
 * is handled by the caller against the sponsor_invites table.)
 */
export function isSponsorInviteEligible(o, { delayDays = 2, now = Date.now() } = {}) {
  if (!o?.email || !o?.createdAt) return false;
  if (o.donation > 0) return false; // already sponsored/donated
  const ok = ["complete", "completed", "paid", "succeeded", "success", ""];
  if (o.status && !ok.includes(o.status)) return false; // skip cancelled/refunded/pending
  const created = new Date(o.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return created <= now - delayDays * 864e5;
}
