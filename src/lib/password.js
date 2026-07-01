// Workers-native password hashing (Web Crypto PBKDF2-SHA256). Replaces oslo/argon2
// (native, unsupported on Cloudflare Workers). Works in Workers runtime and Node 20+.
const ITERATIONS = 100_000;
const KEYLEN = 32;   // derived key bytes
const SALTLEN = 16;  // salt bytes
const enc = new TextEncoder();

function b64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function unb64(str) { const bin = atob(str); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, KEYLEN * 8);
  return new Uint8Array(bits);
}

/** Hash a plaintext password → "pbkdf2$<iterations>$<saltB64>$<hashB64>" */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALTLEN));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

/** Verify a plaintext password against a stored pbkdf2 hash. Legacy argon2 hashes return false. */
export async function verifyPassword(stored, password) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('pbkdf2$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  if (!iterations) return false;
  const salt = unb64(parts[2]);
  const expected = unb64(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
