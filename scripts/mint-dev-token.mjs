#!/usr/bin/env node
// :arch: mint a personal dev API token (editor role) for a whitelisted contributor. Prints the
//        one-time token + the remote INSERT to register it. Does NOT touch Cloudflare itself.
// :why: there's no admin UI for api_tokens yet; this lets an admin grant seed access in one step.
// :rules: the plaintext token is shown ONCE. Only the SHA-256 + prefix are stored (see api_tokens).
//         Run the printed wrangler command yourself (needs your Cloudflare auth). Revoke via
//         `UPDATE api_tokens SET revoked_at=datetime('now') WHERE name LIKE '%<who>%'`.
import { newToken, tokenPrefix, sha256Hex } from "../src/lib/api-token-format.js";

const who = process.argv.slice(2).join(" ").trim();
if (!who) { console.error('Usage: node scripts/mint-dev-token.mjs "<contributor name>"'); process.exit(1); }

const token = newToken();
const id = crypto.randomUUID();
const name = `${who} (dev seed)`.replace(/'/g, "''");
const sql = `INSERT INTO api_tokens (id, prefix, token_hash, name, role) VALUES ('${id}','${tokenPrefix(token)}','${await sha256Hex(token)}','${name}','editor');`;

console.log(`\nDev token for ${who} — give them this, it is shown ONCE:\n\n  ${token}\n`);
console.log("They put it in their .dev.vars as:\n");
console.log(`  DRBI_DEV_TOKEN=${token}\n`);
console.log("Register it (needs your Cloudflare auth):\n");
console.log(`  npx wrangler d1 execute drbi-db --remote --command "${sql}"\n`);
