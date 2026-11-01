// Airbnb availability import, all listings. Fetches each listing's iCal export (admin list
// airbnb_feeds; legacy single airbnb_ical_url = whole facility), tags blocks with feed + space,
// and caches them in KV. Airbnb is the source of truth for rentals; /calendar reads the cache.
// Refreshed traffic-driven (SWR, ~30 min) — the calendar page kicks a background refresh.
// KV is a binding *object* — read it off the cloudflare:workers env proxy directly. (getEnv()
// stringifies its value, which is right for string secrets but turns a binding into
// "[object Object]"; that proxy also stays valid inside waitUntil, where the refresh runs.)
import { env as cfEnv } from 'cloudflare:workers';
import { getOption } from './queries';
import { parseICal, resolveFeeds, mergeFeedBlocks } from './airbnb-feeds.js';

const KV_BLOCKS = 'airbnb:blocks';
const KV_TS = 'airbnb:blocks:ts';
const REFRESH_MS = 30 * 60 * 1000;
const kv = () => (cfEnv && cfEnv.SESSION) || null;

export { parseICal };

export async function getAirbnbBlocks() {
  try {
    const raw = await kv()?.get(KV_BLOCKS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getAirbnbFeeds() {
  const [json, legacy] = await Promise.all([getOption('airbnb_feeds').catch(() => null), getOption('airbnb_ical_url').catch(() => null)]);
  return resolveFeeds(json, legacy);
}

export async function refreshAirbnbBlocks() {
  const feeds = await getAirbnbFeeds();
  if (!feeds.length) return;
  const fetchFeed = async (feed) => {
    try { const res = await fetch(feed.url, { cf: { cacheTtl: 300 } }); return { feed, blocks: res.ok ? parseICal(await res.text()) : null }; }
    catch { return { feed, blocks: null }; }
  };
  try {
    const results = await Promise.all(feeds.map(fetchFeed));
    await kv()?.put(KV_BLOCKS, JSON.stringify(mergeFeedBlocks(await getAirbnbBlocks(), results)));
    await kv()?.put(KV_TS, String(Date.now()));
  } catch { /* fail soft — keep the last good cache */ }
}

// Traffic-driven: refresh at most every REFRESH_MS, in the background so the page never waits.
export async function maybeRefreshAirbnb(cfCtx) {
  try {
    const ts = Number((await kv()?.get(KV_TS)) || 0);
    if (Date.now() - ts < REFRESH_MS) return;
    const p = refreshAirbnbBlocks();
    if (cfCtx?.waitUntil) cfCtx.waitUntil(p); else await p;
  } catch { /* ignore */ }
}
