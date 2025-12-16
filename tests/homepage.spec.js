import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Desert Rose/);
  });

  test('should display the hero section', async ({ page }) => {
    // Wait for page to load, then check for main content area
    await page.waitForLoadState('domcontentloaded');
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should display categories section', async ({ page }) => {
    // Look for the categories component
    const categories = page.locator('[class*="categories"], [class*="category"]').first();
    await expect(categories).toBeVisible();
  });

  test('should display video player', async ({ page }) => {
    const video = page.locator('iframe[src*="youtube"]');
    await expect(video).toBeVisible();
  });

  test('should display upcoming events section', async ({ page }) => {
    const eventsHeading = page.getByRole('heading', { name: /Upcoming DRBI Events/i });
    await expect(eventsHeading).toBeVisible();
  });

  test('should display events calendar', async ({ page }) => {
    // Check for event cards or calendar component
    const eventsSection = page.locator('[class*="event"]');
    await expect(eventsSection.first()).toBeVisible();
  });

  test('should have newsletter signup link', async ({ page }) => {
    const newsletterLink = page.getByRole('link', { name: /Newsletter/i });
    await expect(newsletterLink).toBeVisible();
    await expect(newsletterLink).toHaveAttribute('target', '_blank');
  });

  test('should not display hidden events', async ({ page }) => {
    // Get all event cards
    const eventCards = page.locator('[class*="event-card"], .event-item, [data-event-id]');
    const count = await eventCards.count();

    // Verify that if there are events, they should all be visible ones
    // Hidden events should have visible: false in their data and not appear
    for (let i = 0; i < count; i++) {
      const card = eventCards.nth(i);
      // Hidden events should not have the hidden visual indicators on the public page
      await expect(card).not.toHaveClass(/hidden/);
    }
  });
});
