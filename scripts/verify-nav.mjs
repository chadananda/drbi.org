// Visual + behavioral check of the responsive priority+ navbar across widths.
import { chromium } from 'playwright';
const URL = process.env.NAV_URL || 'https://drbi.org/';
const widths = [1440, 1100, 900, 700, 480];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
for (const w of widths) {
  await page.setViewportSize({ width: w, height: 700 });
  await page.waitForTimeout(400); // let ResizeObserver reflow
  const r = await page.evaluate(() => {
    const nav = document.getElementById('primary-nav');
    const list = document.getElementById('nav-overflow-list');
    const more = document.getElementById('nav-more');
    const profile = document.querySelector('[aria-label="Account"]');
    const vis = (el) => !!(el && el.offsetParent !== null);
    return {
      visibleLinks: nav ? nav.querySelectorAll('.nav-link').length : -1,
      overflowLinks: list ? list.querySelectorAll('.nav-link').length : -1,
      hamburgerVisible: vis(more),
      profileVisible: vis(profile),
    };
  });
  console.log(`w=${String(w).padEnd(5)} visibleLinks=${r.visibleLinks} overflow=${r.overflowLinks} hamburger=${r.hamburgerVisible} profile=${r.profileVisible}`);
  await page.screenshot({ path: `tmp/nav-${w}.png`, clip: { x: 0, y: 0, width: w, height: 90 } });
}
// open the hamburger at a narrow width and confirm the dropdown shows the overflow links
await page.setViewportSize({ width: 700, height: 700 });
await page.waitForTimeout(300);
await page.click('#nav-more');
await page.waitForTimeout(200);
const openState = await page.evaluate(() => {
  const panel = document.getElementById('nav-overflow');
  return { panelOpen: panel && !panel.classList.contains('hidden'), itemsShown: document.querySelectorAll('#nav-overflow-list .nav-link').length };
});
console.log('dropdown-open:', JSON.stringify(openState));
await page.screenshot({ path: 'tmp/nav-700-open.png', clip: { x: 0, y: 0, width: 700, height: 400 } });
await browser.close();
