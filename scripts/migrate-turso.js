// Run schema migration against Turso. Safe to re-run (IF NOT EXISTS).
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_TOKEN;

if (!url) throw new Error('TURSO_URL env var required');
if (!authToken) throw new Error('TURSO_TOKEN env var required');

const db = createClient({ url, authToken });

const schema = readFileSync(join(__dirname, '../src/lib/schema.sql'), 'utf-8');

// Strip comment lines, split on semicolons, filter empty
const stripped = schema
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

const statements = stripped
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Running ${statements.length} schema statements against ${url}...`);

for (const stmt of statements) {
  try {
    await db.execute(stmt);
    const match = stmt.match(/CREATE (?:TABLE|INDEX)(?: IF NOT EXISTS)? (\S+)/i);
    if (match) console.log(`  ✓ ${match[1]}`);
  } catch (err) {
    console.error(`  ✗ Failed: ${stmt.slice(0, 100)}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

console.log('Migration complete.');
db.close();
