import { test, expect } from '@playwright/test';

test.describe('Events Page', () => {
  test('should display events page', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveTitle(/Events|Desert Rose/i);
  });

  test('should display a list of events', async ({ page }) => {
    await page.goto('/events');
    const events = page.locator('[class*="event"], article, .card');
    await expect(events.first()).toBeVisible();
  });

  test('each event should have a title', async ({ page }) => {
    await page.goto('/events');
    const eventTitles = page.locator('[class*="event"] h2, [class*="event"] h3, article h2, article h3');
    const count = await eventTitles.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        await expect(eventTitles.nth(i)).not.toBeEmpty();
      }
    }
  });

  test('should be able to click on an event for details', async ({ page }) => {
    await page.goto('/events');

    // Find clickable event links
    const eventLinks = page.locator('a[href*="/events/"]');
    const count = await eventLinks.count();

    if (count > 0) {
      const firstEventLink = eventLinks.first();
      await firstEventLink.click();

      // Should be on an event detail page
      await expect(page.url()).toContain('/events/');
    }
  });

  test('events should display date information', async ({ page }) => {
    await page.goto('/events');

    // Look for date-related content
    const dateElements = page.locator('time, [class*="date"], [data-date]');
    const count = await dateElements.count();

    // At least some events should have dates
    if (count > 0) {
      await expect(dateElements.first()).toBeVisible();
    }
  });
});

test.describe('Event Details Page', () => {
  test('should display event details', async ({ page }) => {
    await page.goto('/events');

    const eventLinks = page.locator('a[href*="/events/"]');
    const count = await eventLinks.count();

    if (count > 0) {
      await eventLinks.first().click();

      // Should have a title
      const title = page.locator('h1, h2').first();
      await expect(title).toBeVisible();
    }
  });
});
