// GET /api/build-info — what this worker actually ships, not what the working tree holds.
//
// "We can verify what we build. We cannot verify what we ship." A deploy cannot be checked by
// fetching pages: a FAILED upload leaves the previous worker serving, so the site is up and
// every page renders, it is simply the old site. Only an identity the new build carries can
// tell a successful deploy from a failed one — that is this. scripts/stamp-build.mjs writes
// BUILD_SHA/BUILD_TIME/BUILD_DEPS into the worker's vars between build and deploy.
//
// BUILD_DEPS is the RESOLVED version (from node_modules, not package.json's range) of the two
// packages that have actually bitten this fleet. Unset in local dev, where they read as null
// rather than as a stale or invented value.
export const prerender = false;

import { env } from 'cloudflare:workers';

export async function GET() {
  let deps = null;
  try { deps = env.BUILD_DEPS ? JSON.parse(env.BUILD_DEPS) : null; } catch { /* malformed beats crashing this route */ }
  const body = { ok: true, gitSha: env.BUILD_SHA || null, builtAt: env.BUILD_TIME || null, deps };
  // no-store: this answers "what is live right now" — a cached copy of THIS route would defeat
  // its own point, and a cached body is the previous build answering on behalf of this one.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'cache-control': 'no-store' },
  });
}
