// One-time harvest of all PostHog analytics → dated JSON archive, before removing PostHog.
// Reads POSTHOG_API_SERVER_KEY + POSTHOG_HOST from .env. Run: node scripts/harvest-posthog.mjs
import { writeFileSync, mkdirSync } from 'fs';
import 'dotenv/config';

const KEY = process.env.POSTHOG_API_SERVER_KEY || process.env.POSTHOG_API_KEY;
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
if (!KEY) { console.error('No POSTHOG key in env'); process.exit(1); }

const headers = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const end = new Date().toISOString().slice(0, 10);
const start = '2024-01-01'; // wide range to capture all retained history
const base = `${HOST}/api/projects/@current/insights/trend/`;
const pv = `events=[{"id":"$pageview","name":"$pageview","type":"events","order":0}]&date_from=${start}&date_to=${end}`;

const queries = {
  pageViews:      `${base}?${pv}&interval=day`,
  uniqueVisitors: `${base}?events=[{"id":"$pageview","name":"$pageview","type":"events","order":0,"math":"dau"}]&date_from=${start}&date_to=${end}&interval=day`,
  topPages:       `${base}?${pv}&breakdown_type=event&breakdown=$current_url`,
  referrers:      `${base}?${pv}&breakdown_type=event&breakdown=$referrer`,
  countries:      `${base}?${pv}&breakdown_type=event&breakdown=$geoip_country_name`,
  states:         `${base}?${pv}&breakdown_type=event&breakdown=$geoip_subdivision_1_name`,
};

const out = { harvested_at: new Date().toISOString(), host: HOST, date_from: start, date_to: end, data: {} };
for (const [name, url] of Object.entries(queries)) {
  try {
    const r = await fetch(url, { headers });
    if (r.ok) { out.data[name] = await r.json(); const n = out.data[name]?.result?.length ?? 0; console.log(`  ✓ ${name} (${n} series)`); }
    else { console.error(`  ✗ ${name}: HTTP ${r.status}`); out.data[name] = { error: r.status, body: await r.text() }; }
  } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); out.data[name] = { error: e.message }; }
}

mkdirSync('data/analytics-archive', { recursive: true });
const file = `data/analytics-archive/posthog-export-${end}.json`;
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`\nSaved: ${file} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
