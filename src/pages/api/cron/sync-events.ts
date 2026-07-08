// Secured on-demand Humanitix → D1 event sync. Read-only; NEVER publishes (rows land as
// DRAFT). Auth: Bearer CRON_SECRET (or ?token=). Returns 503 until HUMANITIX_API_KEY is set.
// Routine refreshes are traffic-driven (stale-while-revalidate in middleware) — this endpoint
// stays for manual/force triggers. Sync core lives in lib/humanitix-sync. See [[humanitix-drbi-events]].
import type { APIRoute } from "astro";
import { getEnv } from "../../../lib/runtime-env";
import { runSync } from "../../../lib/humanitix-sync";

export const prerender = false;

function authorized(request: Request): boolean {
  const secret = getEnv("CRON_SECRET");
  if (!secret) return false; // fail closed — no secret set means no access
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const qToken = new URL(request.url).searchParams.get("token") ?? "";
  return token === secret || qToken === secret;
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
