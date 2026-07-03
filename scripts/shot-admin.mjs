// Logs into admin via the navbar break-glass popover, then screenshots given admin routes.
// Usage: node scripts/shot-admin.mjs "/admin/analytics?range=30" [more routes...]
import 'dotenv/config';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://drbi.org';
const EMAIL = process.env.SITE_ADMIN_EMAIL;
const PASS = process.env.SITE_ADMIN_PASS;
const routes = process.argv.slice(2);
if (!routes.length) routes.push('/admin/analytics?range=30');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.click('#account-btn');
await page.waitForTimeout(300);
await page.click('#account-menu details summary');
await page.waitForTimeout(200);
await page.fill('#nav-pass-form input[name="email"]', EMAIL);
await page.fill('#nav-pass-form input[name="password"]', PASS);
await Promise.all([
  page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
  page.click('#nav-pass-form button[type="submit"]'),
]);
await page.waitForTimeout(800);
console.log('after-login url:', page.url());

for (const route of routes) {
  const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `tmp/shot-${slug}-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 780 });
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `tmp/shot-${slug}-375.png`, fullPage: true });
  console.log('shot:', route);
}
await browser.close();
