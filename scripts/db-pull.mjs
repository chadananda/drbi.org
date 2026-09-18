#!/usr/bin/env node
// :arch: fetch the sanitized dev seed from the live site (GET /api/dev/seed) and load it into
//        LOCAL D1. Keyless to Cloudflare — auth is a personal API token / session, in the header.
// :why: gives local dev real, current, PII-free data without any Cloudflare account or wrangler login.
// :rules: writes ONLY to --local. Token + base URL come from env or .dev.vars. Never log the token.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

function fromDevVars(key) {
  if (!existsSync(".dev.vars")) return undefined;
  const line = readFileSync(".dev.vars", "utf8").split("\n").find((l) => l.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") : undefined;
}

const base = process.env.DRBI_SITE_URL || fromDevVars("DRBI_SITE_URL") || "https://drbi.org";
const token = process.env.DRBI_DEV_TOKEN || fromDevVars("DRBI_DEV_TOKEN");
if (!token) {
  console.error("No DRBI_DEV_TOKEN found (env or .dev.vars). Ask an admin to mint one — see .dev.vars.example.");
  process.exit(1);
}

const res = await fetch(`${base}/api/dev/seed`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`Seed fetch failed: ${res.status} ${res.statusText}${res.status === 401 ? " — token not whitelisted or expired." : ""}`);
  process.exit(1);
}
mkdirSync("tmp", { recursive: true });
const out = "tmp/dev-seed.sql";
writeFileSync(out, await res.text());
execFileSync("npx", ["wrangler", "d1", "execute", "drbi-db", "--local", `--file=${out}`], { stdio: "inherit" });
writeFileSync("tmp/.dev-seed-stamp", new Date().toISOString());
console.log(`Local D1 seeded from ${base}`);
