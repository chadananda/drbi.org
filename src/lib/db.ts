// Turso LibSQL client singleton
import { createClient } from '@libsql/client';

if (!import.meta.env.TURSO_URL) throw new Error('TURSO_URL env var is required');
if (!import.meta.env.TURSO_TOKEN) throw new Error('TURSO_TOKEN env var is required');

export const db = createClient({
  url: import.meta.env.TURSO_URL,
  authToken: import.meta.env.TURSO_TOKEN,
});
