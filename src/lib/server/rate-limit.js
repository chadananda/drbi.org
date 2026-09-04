// Fixed-window rate limiting for token-authenticated API calls, held in D1 so
// the count is shared across every edge location. Interactive (cookie) admin
// traffic is deliberately not limited — a person clicking around the CMS should
// never be throttled. Deps: @lib/db.

import { db } from '@lib/db';
import { DEFAULT_LIMIT, DEFAULT_WINDOW, windowStart, bucketKey } from '@lib/api-token-format';

export { DEFAULT_LIMIT, DEFAULT_WINDOW, windowStart, bucketKey };

// Returns { allowed, count, limit, remaining, resetAt }.
// Fail-open: if D1 misbehaves we let the request through rather than taking the
// content API down over a counter.
export async function checkRateLimit(id, { limit = DEFAULT_LIMIT, windowSec = DEFAULT_WINDOW, now = Date.now() } = {}) {
  const start = windowStart(now, windowSec);
  const key = bucketKey(id, start);
  const resetAt = (start + windowSec) * 1000;
  try {
    // Upsert then read back: one round trip, atomic per row.
    const { rows } = await db.execute({
      sql: `INSERT INTO api_rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
            ON CONFLICT(bucket) DO UPDATE SET count = count + 1
            RETURNING count`,
      args: [key, start],
    });
    const count = rows?.[0]?.count ?? 1;
    // Opportunistic pruning of windows we will never read again.
    if (count === 1) {
      db.execute({
        sql: `DELETE FROM api_rate_limits WHERE window_start < ?`,
        args: [start - windowSec * 5],
      }).catch(() => {});
    }
    return { allowed: count <= limit, count, limit, remaining: Math.max(0, limit - count), resetAt };
  } catch {
    return { allowed: true, count: 0, limit, remaining: limit, resetAt, degraded: true };
  }
}

export function rateLimitHeaders(r) {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.floor(r.resetAt / 1000)),
  };
}
