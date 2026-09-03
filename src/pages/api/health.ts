// Liveness/readiness probe. Actually touches each bound resource (D1, R2, KV) —
// a constant-returning health check tells you nothing when a binding is missing.
// 200 when every required check passes, 503 otherwise. Deps: cloudflare:workers env.
import { env } from 'cloudflare:workers';

export const prerender = false;

type Check = { status: 'ok' | 'error' | 'unbound'; ms: number; error?: string };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const t0 = Date.now();
  try {
    await fn();
    return { status: 'ok', ms: Date.now() - t0 };
  } catch (e) {
    return {
      status: 'error',
      ms: Date.now() - t0,
      error: String(e instanceof Error ? e.message : e).slice(0, 120),
    };
  }
}

export const GET = async () => {
  const e = env as any;
  const checks: Record<string, Check> = {};

  // D1 — real round trip against the live database.
  checks.d1 = e?.DB
    ? await timed(() => e.DB.prepare('SELECT 1 AS ok').first())
    : { status: 'unbound', ms: 0 };

  // R2 — cheapest call that proves the bucket answers, under our own prefix.
  checks.r2 = e?.R2
    ? await timed(() => e.R2.list({ prefix: 'drbi.org/', limit: 1 }))
    : { status: 'unbound', ms: 0 };

  // KV session store — read of a key that need not exist; proves reachability.
  checks.kv = e?.SESSION
    ? await timed(() => e.SESSION.get('__health__'))
    : { status: 'unbound', ms: 0 };

  const healthy = Object.values(checks).every((c) => c.status === 'ok');

  return new Response(
    JSON.stringify(
      {
        status: healthy ? 'ok' : 'degraded',
        service: 'drbi.org',
        time: new Date().toISOString(),
        checks,
      },
      null,
      2,
    ),
    {
      status: healthy ? 200 : 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
};
