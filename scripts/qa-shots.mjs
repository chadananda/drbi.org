// Post-fix visual QA: screenshot public routes at 375/768/1280 and measure horizontal overflow.
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://drbi.org';
const routes = ['/', '/about-us', '/news', '/categories', '/memorial', '/working-with-us', '/contact-us', '/how-to-purchase-a-plot', '/topics', '/authors'];
const widths = [375, 768, 1280];
const browser = await chromium.launch();
const page = await browser.newPage();
const issues = [];
for (const route of routes) {
  const slug = route === '/' ? 'home' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    } catch { await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); }
    await page.waitForTimeout(500);
    const over = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    if (over > 1) issues.push(`${route} @${w}: +${over}px overflow`);
    await page.screenshot({ path: `tmp/qa/${slug}-${w}.png`, fullPage: false });
  }
  console.log(`done ${route}`);
}
console.log('\n=== OVERFLOW ISSUES ===');
console.log(issues.length ? issues.join('\n') : 'none — all routes clean at 375/768/1280');
await browser.close();
