#!/usr/bin/env node
// :arch: apply the full base schema + additive migrations to the LOCAL Miniflare D1 (offline).
// :why: a fresh clone's local DB is empty; this makes astro dev queryable with zero Cloudflare
//       access. Data is loaded separately by `npm run db:pull`.
// :rules: --local ONLY, never --remote. Best-effort per file: schema.sql already folds in the
//         early migrations, so replaying those throws "duplicate column" — expected and ignored.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const files = [
  "src/lib/schema.sql",
  ...readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort().map((f) => join("migrations", f)),
];

function apply(file) {
  try {
    execFileSync("npx", ["wrangler", "d1", "execute", "drbi-db", "--local", `--file=${file}`], { stdio: "pipe" });
    console.log(`  applied  ${file}`);
  } catch (e) {
    const msg = (e.stderr?.toString() || e.stdout?.toString() || e.message || "");
    const benign = /duplicate column|already exists/i.test(msg);
    console.log(`  ${benign ? "skipped " : "FAILED  "}${file}${benign ? " (already in base schema)" : ""}`);
    if (!benign) console.error(msg.split("\n").slice(-6).join("\n"));
  }
}

console.log("Applying schema + migrations to LOCAL D1 (drbi-db)…");
for (const f of files) apply(f);
console.log("Local schema ready. Run `npm run db:pull` to load data.");
