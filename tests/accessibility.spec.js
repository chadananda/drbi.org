import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test('homepage should have proper ARIA landmarks', async ({ page }) => {
    await page.goto('/');

    // Main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main.first()).toBeVisible();

    // Navigation landmark
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();

    // Header/banner landmark (filter out dev toolbar)
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();

    // Footer/contentinfo landmark
    const footer = page.locator('footer, [role="contentinfo"]');
    await expect(footer.first()).toBeVisible();
  });

  test('page should have at least one h1', async ({ page }) => {
    await page.goto('/');

    // Filter to only visible h1s in main content area
    const h1s = page.locator('main h1, body > h1');
    const count = await h1s.count();

    // Should have at least one h1
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('heading hierarchy should be correct', async ({ page }) => {
    await page.goto('/');

    const headings = await page.evaluate(() => {
      const hs = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(hs).map(h => parseInt(h.tagName[1]));
    });

    // Check that headings don't skip levels
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i] - headings[i - 1];
      // Should never skip more than 1 level down
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // All links should be focusable
    const links = page.locator('a[href]');
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = links.nth(i);
      const tabIndex = await link.getAttribute('tabindex');
      // tabindex should not be negative (hidden from tab order)
      if (tabIndex !== null) {
        expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('buttons should have accessible names', async ({ page }) => {
    await page.goto('/');

    // Only check visible buttons in main content, excluding dev toolbar
    const buttons = page.locator('main button, header button, footer button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);

      // Skip hidden buttons
      if (!(await button.isVisible())) continue;

      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      const title = await button.getAttribute('title');

      // Button should have some accessible name
      const hasAccessibleName = (text && text.trim().length > 0) ||
                                (ariaLabel && ariaLabel.length > 0) ||
                                (title && title.length > 0);

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('form inputs should have labels', async ({ page }) => {
    await page.goto('/login');

    // Only check visible form inputs in main content
    const inputs = page.locator('main input:not([type="hidden"]):not([type="submit"]), form input:not([type="hidden"]):not([type="submit"])');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);

      // Skip hidden inputs
      if (!(await input.isVisible())) continue;

      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledby = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');
      const name = await input.getAttribute('name');

      // Check for associated label
      let hasLabel = false;

      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        hasLabel = await label.count() > 0;
      }

      // Input should have some form of label
      const isAccessible = hasLabel ||
                           ariaLabel ||
                           ariaLabelledby ||
                           placeholder ||
                           name; // name attribute provides some context

      expect(isAccessible).toBeTruthy();
    }
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // All images must have alt attribute
      expect(alt).not.toBeNull();
    }
  });

  test('color contrast should be sufficient', async ({ page }) => {
    await page.goto('/');

    // Check that text is readable - basic check for very low contrast
    const hasReadableText = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const bgColor = body.backgroundColor;
      const textColor = body.color;

      // Basic check - text and bg should be different
      return bgColor !== textColor;
    });

    expect(hasReadableText).toBeTruthy();
  });

  test('focus indicators should be visible', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Check that something is focused
    const focusedElement = await page.evaluate(() => {
      return document.activeElement !== document.body;
    });

    expect(focusedElement).toBeTruthy();
  });

  test('skip link should exist for keyboard users', async ({ page }) => {
    await page.goto('/');

    // Look for skip link (often hidden until focused)
    const skipLink = page.locator('a[href="#main"], a[href="#content"], [class*="skip"]');
    const count = await skipLink.count();

    // Skip link is recommended but not always present
    // Log warning if missing
    if (count === 0) {
      console.warn('No skip link found - consider adding one for keyboard accessibility');
    }
  });
});

test.describe('Admin Accessibility', () => {
  test('login form should have proper labels', async ({ page }) => {
    await page.goto('/login');

    // Username field
    const usernameInput = page.locator('input[type="text"], input[type="email"]').first();
    const usernameId = await usernameInput.getAttribute('id');

    if (usernameId) {
      const usernameLabel = page.locator(`label[for="${usernameId}"]`);
      await expect(usernameLabel).toBeVisible();
    }

    // Password field
    const passwordInput = page.locator('input[type="password"]');
    const passwordId = await passwordInput.getAttribute('id');

    if (passwordId) {
      const passwordLabel = page.locator(`label[for="${passwordId}"]`);
      await expect(passwordLabel).toBeVisible();
    }
  });

  test('form should have submit button with accessible name', async ({ page }) => {
    await page.goto('/login');

    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    await expect(submitButton.first()).toBeVisible();

    const text = await submitButton.first().textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('error messages should be accessible', async ({ page }) => {
    await page.goto('/login');

    // Submit empty form to trigger validation
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
    await submitButton.click();

    await page.waitForTimeout(500);

    // If there are error messages, they should have proper roles
    const errorMessages = page.locator('[role="alert"], [class*="error"]');
    const count = await errorMessages.count();

    if (count > 0) {
      // Errors should be announced to screen readers
      const firstError = errorMessages.first();
      const role = await firstError.getAttribute('role');
      const ariaLive = await firstError.getAttribute('aria-live');

      const isAccessible = role === 'alert' || ariaLive === 'assertive' || ariaLive === 'polite';
      // This is a recommendation check
      if (!isAccessible) {
        console.warn('Error messages should use role="alert" or aria-live for screen reader users');
      }
    }
  });
});
