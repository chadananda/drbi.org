// Runtime server config/secrets. Reads from the Cloudflare Workers env (secrets +
// vars), which is populated at request time — NEVER baked into the bundle.
// Production: `wrangler secret put`. Local dev: .dev.vars. Build time: returns
// undefined (module-scope callers must tolerate that and read lazily at request time).
import { env as cfEnv } from 'cloudflare:workers';

export function getEnv(name: string): string | undefined {
  const v = (cfEnv as any)?.[name];
  if (v != null && v !== '') return String(v);
  // process.env is populated from CF vars/secrets under nodejs_compat; used by some libs.
  if (typeof process !== 'undefined' && process.env && (process.env as any)[name]) {
    return String((process.env as any)[name]);
  }
  return undefined;
}

/** Same, but throws if missing — for required secrets read at request time. */
export function requireEnv(name: string): string {
  const v = getEnv(name);
  if (!v) throw new Error(`Required env "${name}" is not configured`);
  return v;
}
