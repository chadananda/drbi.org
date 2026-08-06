// On-demand Humanitix → D1 resync. Admin-guarded; runs runSync() immediately (bypasses the
// traffic-driven 5-min throttle) so a human can pull Humanitix changes right after editing.
// Read-only re: publish; never changes site visibility (that is human-owned hide/show).
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { runSync, seedMealSummaries, refreshRegisteredCounts } from '@lib/humanitix-sync';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async (context) => {
  const admin = await getAdmin(context);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);
  try {
    const result = await runSync();
    // Seed meal summaries for any newly-imported events in the BACKGROUND — AI calls are slow,
    // so we don't make the caller wait. waitUntil keeps the worker alive after the response.
    const bg = seedMealSummaries().then(() => refreshRegisteredCounts());
    const ctx = context.locals?.cfContext;
    if (ctx?.waitUntil) ctx.waitUntil(bg); else bg.catch(() => {});
    return json({ ok: !!result.ok, ...result });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
};
