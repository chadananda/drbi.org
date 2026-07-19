// Humanitix → D1 event sync core, plus a traffic-driven stale-while-revalidate trigger.
// Content is decoupled from code: pages render live from D1, and this refreshes D1 from
// Humanitix as a side effect of serving traffic — no cron/scheduler needed. NEVER publishes
// (rows land as DRAFT; humans own publish). See memory [[humanitix-drbi-events]].
import { env as cfEnv } from "cloudflare:workers";
import { getEnv } from "./runtime-env";
import { fetchHumanitixEvents, mapHumanitixEvent, isSponsorPageEvent } from "./humanitix";
import { upsertSyncedEvent, getEvents } from "./queries";
import { uploadR2 } from "../utils/r2-upload";
import { listThread, addMessage } from "./server/event-thread";
import { deriveMealSummary } from "./server/meal-summary";

const LAST_CHECK_KEY = "events:lastCheck";      // KV: last time we polled Humanitix
const VERSION_KEY = "edge:events:v";            // KV: edge-cache content version (middleware key)
const REVALIDATE_MS = 5 * 60 * 1000;            // refresh content at most once per 5 min

// Cache an external event image (e.g. Humanitix-hosted) into R2 so it can be served +
// face-cropped through the blogworks resize service (ImageKit only transforms images on its
// cdn.shrtr.com origin). Keyed by the source filename (Humanitix uses a UUID that changes
// when the image is replaced), so re-syncs are idempotent and a swapped source image
// re-caches under a fresh key. Non-cacheable inputs return unchanged.
async function cacheExternalImage(url: string): Promise<string> {
  try {
    if (!url || url.startsWith("https://cdn.shrtr.com/") || !/^https?:\/\//.test(url)) return url;
    const r2 = (cfEnv as any)?.R2;
    if (!r2) return url;
    // Derive a clean R2 key from the filename (drop query + Humanitix's @size suffix), but
    // FETCH the original URL as-is — Humanitix 400s without @original.
    const clean = url.split("?")[0].replace(/@[a-z]+$/i, "");
    const base = clean.substring(clean.lastIndexOf("/") + 1) || "image";
    const key = `events/humanitix/${base}`;
    const objectKey = `drbi.org/${key}`;
    if (await r2.head(objectKey)) return `https://cdn.shrtr.com/${objectKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    return await uploadR2(r2, key, await resp.arrayBuffer(), contentType);
  } catch {
    return url;
  }
}

// Seed the coordination thread with an AI meal summary for any upcoming event whose thread is
// still empty (i.e. first import). Runs AI calls, so callers should NOT block a response on it —
// invoke it in the background (waitUntil). Idempotent: skips events that already have a message.
export async function seedMealSummaries(): Promise<number> {
  let seeded = 0;
  try {
    const events = await getEvents();
    const now = Date.now();
    for (const ev of events) {
      const d = ev.data;
      const endMs = d.endDate ? new Date(d.endDate).getTime()
        : d.startDate ? new Date(d.startDate).getTime() : 0;
      if (!endMs || endMs < now) continue; // only upcoming/active events need a meal plan
      if ((await listThread(ev.id)).length > 0) continue; // already seeded / has discussion
      const body = await deriveMealSummary(
        { title: d.name || d.title, startDate: d.startDate, endDate: d.endDate, description: d.fullDescription || d.shortDescription },
        (cfEnv as any)?.AI,
      );
      if (body) { await addMessage({ eventId: ev.id, userId: 'system', authorName: 'DRBI Web AI', body }); seeded++; }
    }
  } catch { /* best-effort */ }
  return seeded;
}

// Pull all events from Humanitix and upsert into D1. Change-detection (updatedAt) means
// unchanged events are skipped, and the edge-cache version only bumps on a real change.
export async function runSync() {
  const apiKey = getEnv("HUMANITIX_API_KEY");
  if (!apiKey) {
    return { ok: false, configured: false, error: "HUMANITIX_API_KEY not configured" };
  }
  const events = await fetchHumanitixEvents(apiKey);
  const summary = { created: 0, updated: 0, unchanged: 0, skippedManual: 0, skippedSponsor: 0, total: events.length };
  for (const hx of events) {
    const mapped = mapHumanitixEvent(hx);
    // Sponsor-a-Youth donation pages are not site events — never sync them onto the events list.
    if (isSponsorPageEvent(mapped)) { summary.skippedSponsor++; continue; }
    // Cache the banner into R2 so it can be face-cropped via ImageKit on the site.
    mapped.mainImage = await cacheExternalImage(mapped.mainImage);
    const r = await upsertSyncedEvent(mapped);
    if (r.action === "created") summary.created++;
    else if (r.action === "updated") summary.updated++;
    else if (r.action === "unchanged") summary.unchanged++;
    else summary.skippedManual++;
  }
  // Bump the edge-cache version only when content actually changed, so unchanged polls
  // leave the cache intact. Middleware keys /events cache entries on this token.
  const changed = summary.created + summary.updated;
  if (changed > 0) {
    try { await (cfEnv as any)?.SESSION?.put(VERSION_KEY, Date.now().toString()); } catch {}
  }
  return { ok: true, configured: true, changed, ...summary };
}

// Stale-while-revalidate: call on event-page requests. If Humanitix hasn't been checked in
// REVALIDATE_MS, claim the slot (best-effort KV lock to avoid a stampede) and refresh in the
// BACKGROUND via waitUntil — the current request still serves instantly from D1/edge cache.
// runSync() only writes D1 + flushes the edge cache when Humanitix actually changed.
export async function revalidateEventsIfStale(cfContext: any): Promise<void> {
  try {
    const kv = (cfEnv as any)?.SESSION;
    if (!kv) return;
    const last = Number((await kv.get(LAST_CHECK_KEY)) || 0);
    if (Date.now() - last < REVALIDATE_MS) return;
    await kv.put(LAST_CHECK_KEY, String(Date.now())); // claim immediately so peers skip
    // Refresh content, then seed any new event's meal summary — both in the background.
    const job = runSync().then(() => seedMealSummaries()).then(() => {}, () => {});
    if (cfContext?.waitUntil) cfContext.waitUntil(job);
    else await job;
  } catch {
    // Never let a refresh error affect the request being served.
  }
}
