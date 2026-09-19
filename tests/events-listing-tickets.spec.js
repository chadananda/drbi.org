// /events listing must let a decided visitor buy without clicking into the detail page.
// Backlog 0005. Every card is checked, and the suite now fails outright when the
// listing is empty — an assertion loop over zero cards passed while proving nothing,
// which is how this criterion was first reported as met when it was not.
import { test, expect } from '@playwright/test';

const CARD = '.event-list-full-item';
const BAR = '.list-full-bottom';

// What a card offers a visitor who has already decided: tickets, the waitlist when the
// program is full, or — for a collapsed recurring instance — the control that reveals them.
const ACTION = '.get-tickets-btn, .waitlist-link-btn, .registration-link-btn, .show-more-btn';

test.describe('Events listing — ticket path', () => {
  test('every event offers a direct path to its tickets', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const cards = page.locator(CARD);
    const count = await cards.count();

    // The criterion is "each event", not "each priced event". An event with no
    // external ticket URL still has a registration route on its detail page, and the
    // card must surface it — previously such a card rendered no action at all.
    expect(count, 'no event cards rendered — this assertion would prove nothing').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // The CTA lives in the always-visible action bar — no expanding, no navigating.
      await expect(
        card.locator(`${BAR} ${ACTION}`).first(),
        `card ${i} offers no path to act on`,
      ).toBeVisible();
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
