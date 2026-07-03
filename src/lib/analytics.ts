// Analytics data layer for the admin dashboard. Source priority:
//   1. Live Cloudflare Web Analytics (GraphQL) when CF_ANALYTICS_API_TOKEN + CF_ACCOUNT_ID
//      + CF_WEB_ANALYTICS_TAG (the Web Analytics "site tag") are set as Worker secrets.
//   2. Otherwise a rich, clearly-labelled SAMPLE dataset so the dashboard is always impressive.
// Deps: runtime-env (getEnv), fetch. Data shape is identical regardless of source.
import { getEnv } from './runtime-env';

export interface Point { date: string; pageviews: number; visits: number; }
export interface Slice { label: string; views: number; pct: number; sub?: string; }
export interface Analytics {
  source: 'cloudflare' | 'sample';
  days: number;
  from: string;
  to: string;
  totals: { pageviews: number; visits: number; avgLoadMs: number; pagesPerVisit: number };
  deltas: { pageviews: number; visits: number; avgLoadMs: number; pagesPerVisit: number };
  series: Point[];
  topPages: Slice[];
  referrers: Slice[];
  countries: Slice[];
  devices: Slice[];
  browsers: Slice[];
}

const CF_GQL = 'https://api.cloudflare.com/client/v4/graphql';
const iso = (d: Date) => d.toISOString();
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : 0);

/** Entry point: returns analytics for the last `days`, live if configured else sample. */
export async function getAnalytics(days = 30): Promise<Analytics> {
  const token = getEnv('CF_ANALYTICS_API_TOKEN');
  const account = getEnv('CF_ACCOUNT_ID');
  const siteTag = getEnv('CF_WEB_ANALYTICS_TAG');
  if (token && account && siteTag) {
    try {
      return await queryCloudflare(days, token, account, siteTag);
    } catch (e) {
      console.error('[analytics] Cloudflare query failed, using sample:', (e as any)?.message ?? e);
    }
  }
  return sampleAnalytics(days);
}

// ── Cloudflare Web Analytics (RUM) via GraphQL ───────────────────────────────
async function queryCloudflare(days: number, token: string, accountTag: string, siteTag: string): Promise<Analytics> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 864e5);
  const prevStart = new Date(now.getTime() - 2 * days * 864e5);
  const F = (path: string, extra = '') =>
    `${path}(limit: $limit, filter: { AND: [{ siteTag: $siteTag }, { datetime_geq: $s }, { datetime_leq: $e }] }${extra}) { count sum { visits } %DIMS% }`;

  const query = `
    query($account: String!, $siteTag: String!, $s: Time!, $e: Time!, $ps: Time!, $limit: Int!) {
      viewer { accounts(filter: { accountTag: $account }) {
        cur: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count sum { visits } }
        prev: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag, datetime_geq: $ps, datetime_leq: $s }) { count sum { visits } }
        series: rumPageloadEventsAdaptiveGroups(limit: 1000, orderBy: [date_ASC], filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count sum { visits } dimensions { date } }
        pages: rumPageloadEventsAdaptiveGroups(limit: 12, orderBy: [count_DESC], filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count dimensions { requestPath } }
        refs: rumPageloadEventsAdaptiveGroups(limit: 12, orderBy: [count_DESC], filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count dimensions { refererHost } }
        countries: rumPageloadEventsAdaptiveGroups(limit: 12, orderBy: [count_DESC], filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count dimensions { countryName } }
        devices: rumPageloadEventsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count dimensions { deviceType } }
        browsers: rumPageloadEventsAdaptiveGroups(limit: 8, orderBy: [count_DESC], filter: { siteTag: $siteTag, datetime_geq: $s, datetime_leq: $e }) { count dimensions { userAgentBrowser } }
      } }
    }`;

  const res = await fetch(CF_GQL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables: { account: accountTag, siteTag, s: iso(start), e: iso(now), ps: iso(prevStart), limit: 1000 } }),
  });
  const body: any = await res.json();
  if (!res.ok || body.errors) throw new Error(`CF GraphQL: ${JSON.stringify(body.errors ?? res.status)}`);
  const acct = body.data?.viewer?.accounts?.[0];
  if (!acct) throw new Error('CF GraphQL: no account data');

  const curPv = acct.cur?.[0]?.count ?? 0;
  const curVis = acct.cur?.[0]?.sum?.visits ?? 0;
  const prevPv = acct.prev?.[0]?.count ?? 0;
  const prevVis = acct.prev?.[0]?.sum?.visits ?? 0;

  const byDate = new Map<string, Point>();
  for (const r of acct.series ?? []) {
    const d = r.dimensions?.date;
    if (d) byDate.set(d, { date: d, pageviews: r.count ?? 0, visits: r.sum?.visits ?? 0 });
  }
  const series: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayStr(new Date(now.getTime() - i * 864e5));
    series.push(byDate.get(d) ?? { date: d, pageviews: 0, visits: 0 });
  }
  const toSlices = (rows: any[], dim: string): Slice[] => {
    const total = (rows ?? []).reduce((a, r) => a + (r.count ?? 0), 0);
    return (rows ?? []).map((r) => ({ label: String(r.dimensions?.[dim] ?? '—') || 'Direct', views: r.count ?? 0, pct: pct(r.count ?? 0, total) }));
  };
  return {
    source: 'cloudflare', days, from: dayStr(start), to: dayStr(now),
    totals: { pageviews: curPv, visits: curVis, avgLoadMs: 0, pagesPerVisit: curVis ? Math.round((curPv / curVis) * 10) / 10 : 0 },
    deltas: { pageviews: delta(curPv, prevPv), visits: delta(curVis, prevVis), avgLoadMs: 0, pagesPerVisit: delta(curPv / (curVis || 1), prevPv / (prevVis || 1)) },
    series,
    topPages: toSlices(acct.pages, 'requestPath'),
    referrers: toSlices(acct.refs, 'refererHost'),
    countries: toSlices(acct.countries, 'countryName'),
    devices: toSlices(acct.devices, 'deviceType'),
    browsers: toSlices(acct.browsers, 'userAgentBrowser'),
  };
}

// ── Sample data (deterministic, realistic) ───────────────────────────────────
// Seeded so the dashboard is stable across reloads but varies by day/range.
function seeded(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function sampleAnalytics(days = 30): Analytics {
  const now = new Date();
  const start = new Date(now.getTime() - days * 864e5);
  const rnd = seeded(days * 7 + 42);
  const series: Point[] = [];
  let base = 120 + Math.round(rnd() * 40);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 0.68 : 1;
    const trend = 1 + (days - i) / (days * 6); // gentle upward trend
    const noise = 0.82 + rnd() * 0.4;
    const pv = Math.max(8, Math.round(base * weekend * trend * noise));
    const vis = Math.round(pv * (0.52 + rnd() * 0.12));
    series.push({ date: dayStr(d), pageviews: pv, visits: vis });
    base += (rnd() - 0.45) * 6;
  }
  const sum = (k: 'pageviews' | 'visits', arr = series) => arr.reduce((a, p) => a + p[k], 0);
  const half = Math.floor(days / 2);
  const curPv = sum('pageviews'), curVis = sum('visits');
  const prevPv = Math.round(sum('pageviews', series.slice(0, half)) * (days / (half || 1)) * 0.9);
  const prevVis = Math.round(sum('visits', series.slice(0, half)) * (days / (half || 1)) * 0.9);

  const mk = (rows: [string, number, string?][]): Slice[] => {
    const total = rows.reduce((a, r) => a + r[1], 0);
    return rows.map(([label, w, sub]) => ({ label, views: Math.round((w / total) * curPv), pct: pct(Math.round((w / total) * curPv), curPv), sub }));
  };
  return {
    source: 'sample', days, from: dayStr(start), to: dayStr(now),
    totals: { pageviews: curPv, visits: curVis, avgLoadMs: 840 + Math.round(rnd() * 220), pagesPerVisit: Math.round((curPv / curVis) * 10) / 10 },
    deltas: { pageviews: delta(curPv, prevPv), visits: delta(curVis, prevVis), avgLoadMs: -6.2, pagesPerVisit: 3.4 },
    series,
    topPages: mk([['/', 100], ['/events', 61], ['/arts', 44], ['/agriculture', 39], ['/memorial', 31], ['/working-with-us', 24], ['/radio', 19], ['/facilities-and-rentals', 16], ['/contact-us', 12], ['/about-us', 9]]),
    referrers: mk([['Direct', 88], ['google.com', 72], ['facebook.com', 28], ['bing.com', 11], ['instagram.com', 9], ['t.co', 6], ['duckduckgo.com', 5], ['linkedin.com', 3]]),
    countries: mk([['United States', 140, 'US'], ['Canada', 22, 'CA'], ['United Kingdom', 14, 'GB'], ['Mexico', 11, 'MX'], ['Germany', 8, 'DE'], ['Australia', 7, 'AU'], ['India', 6, 'IN'], ['France', 5, 'FR']]),
    devices: mk([['Mobile', 118], ['Desktop', 96], ['Tablet', 14]]),
    browsers: mk([['Chrome', 120], ['Safari', 78], ['Edge', 22], ['Firefox', 14], ['Samsung Internet', 8]]),
  };
}
