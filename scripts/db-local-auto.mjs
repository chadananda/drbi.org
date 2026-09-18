#!/usr/bin/env node
// :arch: predev hook — ensure local D1 has schema, then pull data if a token is configured.
//        Never blocks dev; each step is guarded so it runs at most once until it needs redoing.
// :why: makes `npm run dev` "just work" on a fresh clone without slowing every subsequent launch.
// :rules: schema applied once (stamped); data pulled only when DRBI_DEV_TOKEN exists and the last
//         pull is >24h old. Any failure warns and continues (dev still boots with an empty DB).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const SCHEMA_STAMP = "tmp/.dev-schema-stamp";
const SEED_STAMP = "tmp/.dev-seed-stamp";
const FRESH_MS = 24 * 60 * 60 * 1000;
const stampFresh = (f) => existsSync(f) && Date.now() - Date.parse(readFileSync(f, "utf8").trim()) < FRESH_MS;
const hasToken = !!(process.env.DRBI_DEV_TOKEN
  || (existsSync(".dev.vars") && /(^|\n)DRBI_DEV_TOKEN=\S/.test(readFileSync(".dev.vars", "utf8"))));

if (!existsSync(SCHEMA_STAMP)) {
  try {
    execFileSync("node", ["scripts/db-local.mjs"], { stdio: "inherit" });
    writeFileSync(SCHEMA_STAMP, new Date().toISOString());
  } catch { console.warn("[dev] local schema apply failed — `npm run db:local` to retry."); }
}

if (!hasToken) {
  console.log("[dev] no DRBI_DEV_TOKEN set — skipping data pull. Add one (see .dev.vars.example) then `npm run db:pull`.");
} else if (stampFresh(SEED_STAMP)) {
  console.log("[dev] local data seeded <24h ago — skipping pull.");
} else {
  try { execFileSync("node", ["scripts/db-pull.mjs"], { stdio: "inherit" }); }
  catch { console.warn("[dev] data pull skipped (offline or endpoint not deployed yet)."); }
}
