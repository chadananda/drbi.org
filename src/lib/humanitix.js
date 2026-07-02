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
  const images = [hx.bannerImage?.url, hx.featureImage?.url].filter(Boolean);
  return {
    id: `event-hx-${externalId}`,
    externalId,
    source: "humanitix",
    title: hx.name ?? "",
    shortDescription: "",
    fullDescription: hx.description ?? "",
    startDate: hx.startDate ?? "",
    endDate: hx.endDate ?? "",
    additionalDates: (hx.dates ?? [])
      .filter((d) => d && d.startDate)
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
    mainImage: hx.bannerImage?.url ?? hx.featureImage?.url ?? "",
    images,
    organizer: "DRBI",
    categories: hx.category ? [hx.category] : [],
    lastModified: hx.updatedAt ?? null,
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
