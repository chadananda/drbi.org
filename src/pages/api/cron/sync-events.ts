// Secured Humanitix → D1 event sync. Read-only; NEVER publishes (rows land as DRAFT).
// Auth: Bearer CRON_SECRET (or ?token=). Triggered by a scheduler (GitHub Action / CF cron).
// Returns 503 until HUMANITIX_API_KEY is configured. See memory [[humanitix-drbi-events]].
import type { APIRoute } from "astro";
import { env as cfEnv } from "cloudflare:workers";
import { getEnv } from "../../../lib/runtime-env";
import { fetchHumanitixEvents, mapHumanitixEvent, isSponsorPageEvent } from "../../../lib/humanitix";
import { upsertSyncedEvent } from "../../../lib/queries";
import { uploadR2 } from "../../../utils/r2-upload";

export const prerender = false;

// Cache an external event image (e.g. Humanitix-hosted) into R2 so it can be
// served + face-cropped through the blogworks resize service (ImageKit only
// transforms images on its cdn.shrtr.com origin). Keyed by the source filename
// (Humanitix uses a UUID that changes when the image is replaced), so re-syncs
// are idempotent and a swapped source image re-caches under a fresh key.
// Non-cacheable inputs (already-R2, non-http, fetch failure) return unchanged.
async function cacheExternalImage(url: string): Promise<string> {
  try {
    if (!url || url.startsWith("https://cdn.shrtr.com/") || !/^https?:\/\//.test(url)) return url;
    const r2 = (cfEnv as any)?.R2;
    if (!r2) return url;
    // Derive a clean R2 key from the filename (drop query + Humanitix's @size
    // suffix), but FETCH the original URL as-is — Humanitix 400s without @original.
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

function authorized(request: Request): boolean {
  const secret = getEnv("CRON_SECRET");
  if (!secret) return false; // fail closed — no secret set means no access
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const qToken = new URL(request.url).searchParams.get("token") ?? "";
  return token === secret || qToken === secret;
}

async function runSync() {
  const apiKey = getEnv("HUMANITIX_API_KEY");
  if (!apiKey) {
    return { ok: false, configured: false, error: "HUMANITIX_API_KEY not configured" };
  }
  const events = await fetchHumanitixEvents(apiKey);
  const summary = { created: 0, updated: 0, skippedManual: 0, skippedSponsor: 0, total: events.length };
  for (const hx of events) {
    const mapped = mapHumanitixEvent(hx);
    // Sponsor-a-Youth donation pages are not site events — never sync them onto the events list.
    if (isSponsorPageEvent(mapped)) { summary.skippedSponsor++; continue; }
    // Cache the banner into R2 so it can be face-cropped via ImageKit on the site.
    mapped.mainImage = await cacheExternalImage(mapped.mainImage);
    const r = await upsertSyncedEvent(mapped);
    if (r.action === "created") summary.created++;
    else if (r.action === "updated") summary.updated++;
    else summary.skippedManual++;
  }
  return { ok: true, configured: true, ...summary };
}

const handler: APIRoute = async ({ request }) => {
  if (!authorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const result = await runSync();
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 503,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const POST = handler;
export const GET = handler; // allow simple GET pingers (still requires the token)
