#!/usr/bin/env node
// Stamp this build's identity into the worker, so a deploy can be verified afterwards.
//
// Runs between `astro build` and `wrangler deploy`: the @astrojs/cloudflare adapter generates
// dist/server/wrangler.json, and this adds BUILD_SHA / BUILD_TIME / BUILD_DEPS to its vars.
// src/pages/api/build-info.js reads them back at runtime.
//
// Why this has to exist before any deploy-verification does (#162): `wrangler deploy` exits
// non-zero on a deploy that is already live (the zone-route substep is rejected for zones the
// API token cannot see), AND a genuinely FAILED upload leaves the previous worker serving, so
// the site is up and every page check passes against what is simply the old site. No amount of
// fetching pages can separate those two. Only an identity that the NEW build carries can, which
// is what this writes. A verifier without it would either always pass or always fail.
//
// Deps: node builtins only. Safe to copy verbatim into any Astro + @astrojs/cloudflare project.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CONFIG = 'dist/server/wrangler.json';
if (!existsSync(CONFIG)) {
  console.error(`stamp-build: ${CONFIG} not found — run the build first.`);
  process.exit(1);
}

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8' }).trim(); } catch { return null; }
};
const depVersion = (name) => {
  try { return JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8')).version; } catch { return null; }
};

const gitSha = sh('git rev-parse --short HEAD');
if (!gitSha) {
  // A stamp that cannot say which commit it is describes nothing. Better to stop than to ship
  // a build whose identity is null, because a verifier would then read "no gitSha" forever.
  console.error('stamp-build: could not read a git sha — refusing to stamp an unidentifiable build.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
config.vars = {
  ...(config.vars || {}),
  BUILD_SHA: gitSha,
  BUILD_TIME: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  // The two packages that have actually bitten this fleet: an astro RCE sat live for hours
  // because no fetched page can reveal a dependency version.
  BUILD_DEPS: JSON.stringify({ astro: depVersion('astro'), '@astrojs/cloudflare': depVersion('@astrojs/cloudflare') }),
};
// Re-inject the Workers AI binding for production: it's intentionally omitted from wrangler.jsonc so
// `astro dev` stays keyless (AI has no local emulator → declaring it forces a remote CF connection at
// dev startup). The deployed worker needs it for media alt-text + meal summaries.
config.ai = { binding: 'AI' };
writeFileSync(CONFIG, JSON.stringify(config));
console.log(`stamped ${config.vars.BUILD_SHA} @ ${config.vars.BUILD_TIME} (+AI binding)`);
