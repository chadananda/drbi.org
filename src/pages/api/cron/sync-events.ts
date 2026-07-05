// Secured Humanitix → D1 event sync. Read-only; NEVER publishes (rows land as DRAFT).
// Auth: Bearer CRON_SECRET (or ?token=). Triggered by a scheduler (GitHub Action / CF cron).
// Returns 503 until HUMANITIX_API_KEY is configured. See memory [[humanitix-drbi-events]].
import type { APIRoute } from "astro";
import { getEnv } from "../../../lib/runtime-env";
import { fetchHumanitixEvents, mapHumanitixEvent, isSponsorPageEvent } from "../../../lib/humanitix";
import { upsertSyncedEvent } from "../../../lib/queries";

export const prerender = false;

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
