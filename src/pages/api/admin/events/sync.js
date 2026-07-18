// On-demand Humanitix → D1 resync. Admin-guarded; runs runSync() immediately (bypasses the
// traffic-driven 5-min throttle) so a human can pull Humanitix changes right after editing.
// Read-only re: publish; never changes site visibility (that is human-owned hide/show).
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { runSync } from '@lib/humanitix-sync';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async (context) => {
  const admin = await getAdmin(context);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);
  try {
    const result = await runSync();
    return json({ ok: !!result.ok, ...result });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
};
