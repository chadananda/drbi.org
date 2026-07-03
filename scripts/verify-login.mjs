// Visual check: hero text shadow + navbar account/login popover.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('https://drbi.org/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'tmp/home-hero.png', clip: { x: 0, y: 0, width: 1280, height: 520 } });
// Open the account popover
await page.click('#account-btn');
await page.waitForTimeout(500);
const open = await page.evaluate(() => !document.getElementById('account-menu').classList.contains('hidden'));
console.log('popover-open:', open);
await page.screenshot({ path: 'tmp/home-login-popover.png', clip: { x: 760, y: 0, width: 520, height: 420 } });
await browser.close();
