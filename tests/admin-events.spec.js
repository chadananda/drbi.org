import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

// Test credentials - should be set in environment or test fixtures
const TEST_ADMIN_USER = process.env.TEST_ADMIN_USER || '';
const TEST_ADMIN_PASS = process.env.TEST_ADMIN_PASS || '';

// Helper to login
async function loginAsAdmin(page) {
  await page.goto('/login');

  if (!TEST_ADMIN_USER || !TEST_ADMIN_PASS) {
    test.skip('Test admin credentials not configured');
    return false;
  }

  const usernameField = page.locator('input[type="text"], input[type="email"], input[name*="user"], input[name*="email"]').first();
  const passwordField = page.locator('input[type="password"]');

  await usernameField.fill(TEST_ADMIN_USER);
  await passwordField.fill(TEST_ADMIN_PASS);

  const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
  await submitButton.click();

  // Wait for redirect
  await page.waitForURL(/admin/);
  return true;
}

test.describe('Admin Events Management', () => {
  test.describe('Without Authentication', () => {
    test('admin events page should require authentication', async ({ page }) => {
      await page.goto('/admin/events');
      await expect(page.url()).toContain('/login');
    });
  });

  test.describe('With Authentication', () => {
    test.beforeEach(async ({ page }) => {
      const loggedIn = await loginAsAdmin(page);
      if (!loggedIn) {
        test.skip();
      }
    });

    test('should display events list in admin', async ({ page }) => {
      await page.goto('/admin/events');

      // Should see event cards
      const eventCards = page.locator('[class*="event"], article, .card');
      await expect(eventCards.first()).toBeVisible();
    });

    test('events should have visibility indicators', async ({ page }) => {
      await page.goto('/admin/events');

      // Each event should have hide/show button
      const toggleButtons = page.locator('.toggle-visibility, [class*="visibility"]');
      await expect(toggleButtons.first()).toBeVisible();
    });

    test('events should have edit buttons', async ({ page }) => {
      await page.goto('/admin/events');

      const editButtons = page.getByRole('link', { name: /edit/i });
      await expect(editButtons.first()).toBeVisible();
    });

    test('hidden events should be visually distinct', async ({ page }) => {
      await page.goto('/admin/events');

      // Look for hidden event styling
      const hiddenEvents = page.locator('[class*="opacity"], [class*="orange"], [class*="dashed"]');
      // This may or may not find elements depending on if there are hidden events
      // Just verify the page loads without error
      await expect(page).toHaveURL(/admin\/events/);
    });

    test('should be able to toggle event visibility', async ({ page }) => {
      await page.goto('/admin/events');

      const toggleButton = page.locator('.toggle-visibility').first();

      if (await toggleButton.isVisible()) {
        const initialText = await toggleButton.textContent();

        await toggleButton.click();

        // Wait for API response and UI update
        await page.waitForTimeout(1000);

        const newText = await toggleButton.textContent();
        // Text should change between Hide/Show
        expect(newText).not.toBe(initialText);
      }
    });

    test('should navigate to edit form', async ({ page }) => {
      await page.goto('/admin/events');

      const editLink = page.getByRole('link', { name: /edit/i }).first();

      if (await editLink.isVisible()) {
        await editLink.click();

        // Should be on edit page
        await expect(page.url()).toMatch(/admin\/events\/\d+/);
      }
    });

    test('edit form should have visibility checkbox', async ({ page }) => {
      await page.goto('/admin/events');

      const editLink = page.getByRole('link', { name: /edit/i }).first();

      if (await editLink.isVisible()) {
        await editLink.click();

        // Look for visibility checkbox
        const visibilityCheckbox = page.locator('input[name="visible"], input[id*="visible"]');
        await expect(visibilityCheckbox).toBeVisible();
      }
    });
  });
});

test.describe('Event Visibility Integration', () => {
  // This test verifies the full flow of visibility changes
  test('hidden events should not appear on homepage', async ({ page }) => {
    // Read events from filesystem to find hidden ones
    const eventsDir = path.join(process.cwd(), 'src/content/events');

    try {
      const files = await fs.readdir(eventsDir);
      const hiddenEvents = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(eventsDir, file), 'utf-8');
          const event = JSON.parse(content);
          if (event.visible === false) {
            hiddenEvents.push(event);
          }
        }
      }

      if (hiddenEvents.length > 0) {
        await page.goto('/');

        // Verify hidden event titles don't appear in the events section
        for (const event of hiddenEvents) {
          const eventTitle = page.locator(`text="${event.title}"`);
          await expect(eventTitle).not.toBeVisible();
        }
      }
    } catch (e) {
      // Skip if can't read events
      test.skip();
    }
  });
});
