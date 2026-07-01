// Seed superadmin user from env vars. Safe to re-run — skips if user already exists.
import { createClient } from '@libsql/client';
import { hashPassword } from '../src/lib/password.js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.TURSO_URL) throw new Error('TURSO_URL required');
if (!process.env.TURSO_TOKEN) throw new Error('TURSO_TOKEN required');
if (!process.env.SITE_ADMIN_EMAIL) throw new Error('SITE_ADMIN_EMAIL required');
if (!process.env.SITE_ADMIN_PASS) throw new Error('SITE_ADMIN_PASS required');

const db = createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_TOKEN });

const email = process.env.SITE_ADMIN_EMAIL.trim().toLowerCase();
const password = process.env.SITE_ADMIN_PASS.trim();
const name = process.env.SITE_ADMIN_NAME?.trim() || 'Administrator';
const id = email.replace(/[^a-z0-9]/g, '-');

const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
if (existing.rows.length > 0) {
  console.log(`Superadmin already exists: ${email}`);
} else {
  const hashed_password = await hashPassword(password);
  await db.execute({
    sql: 'INSERT INTO users (id, email, hashed_password, name, role) VALUES (?,?,?,?,?)',
    args: [id, email, hashed_password, name, 'superadmin']
  });
  console.log(`Created superadmin: ${email} (id: ${id})`);
}

db.close();
