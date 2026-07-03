// Screenshot the logged-out homepage: our sign-in popover should auto-open below the navbar.
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://drbi.org';
const browser = await chromium.launch();
for (const w of [1280, 375]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 820 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500); // wait past the 900ms auto-open delay
  const open = await p.evaluate(() => { const m = document.getElementById('account-menu'); return m && !m.classList.contains('hidden'); });
  console.log(`w=${w} popover auto-open: ${open}`);
  await p.screenshot({ path: `tmp/signin-${w}.png`, clip: { x: Math.max(0, w - 520), y: 0, width: Math.min(520, w), height: 460 } });
  await ctx.close();
}
await browser.close();
