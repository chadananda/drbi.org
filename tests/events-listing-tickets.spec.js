// /events listing must let a decided visitor buy without clicking into the detail page.
// Backlog 0005. Assertions are per-card, so an empty local D1 proves nothing but never
// fails falsely; a listing with events is checked in full.
import { test, expect } from '@playwright/test';

const CARD = '.event-list-full-item';
const BAR = '.list-full-bottom';

// What a card offers a visitor who has already decided: tickets, the waitlist when the
// program is full, or — for a collapsed recurring instance — the control that reveals them.
const ACTION = '.get-tickets-btn, .waitlist-link-btn, .show-more-btn';

test.describe('Events listing — ticket path', () => {
  test('every priced event offers a direct path to its tickets', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const cards = page.locator(CARD);
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // Only an event that quotes a price is selling something to link to.
      if ((await card.locator('.meta-item.price').count()) === 0) continue;
      // The CTA lives in the always-visible action bar — no expanding, no navigating.
      await expect(card.locator(`${BAR} ${ACTION}`).first()).toBeVisible();
    }
  });

  test('prices sit beside a way to act on them', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const priced = page.locator(`${CARD} .meta-item.price`);
    const count = await priced.count();

    for (let i = 0; i < count; i++) {
      const block = priced.nth(i);
      if (!(await block.isVisible())) continue; // collapsed recurring instance
      // A visible price is either buyable on the spot or explained by the waitlist.
      const card = block.locator(`xpath=ancestor::*[contains(@class,"event-list-full-item")][1]`);
      const beside = card.locator('.price-tickets-link, .waitlist-link-btn');
      await expect(beside.first()).toBeVisible();
    }
  });

  test('ticket links go off-site to the registration page, safely', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const links = page.locator('.get-tickets-btn, .price-tickets-link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      expect(await link.getAttribute('href')).toMatch(/^https?:\/\//);
      expect(await link.getAttribute('target')).toBe('_blank');
      // rel guards the opener against the destination tab.
      expect(await link.getAttribute('rel')).toContain('noopener');
      // Distinguishable for a screen reader running the page's link list.
      expect(await link.getAttribute('aria-label')).toBeTruthy();
    }
  });

  for (const [name, width, height] of [['mobile', 375, 667], ['tablet', 820, 1180], ['desktop', 1280, 900]]) {
    test(`listing does not overflow horizontally on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/events');
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
