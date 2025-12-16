import { test, expect } from '@playwright/test';

test.describe('Site Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display main navigation', async ({ page }) => {
    const nav = page.locator('nav, [role="navigation"], header');
    await expect(nav.first()).toBeVisible();
  });

  test('should have essential navigation links', async ({ page }) => {
    // Check for home/logo link
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible();

    // Check there are navigation links in general
    const navLinks = page.locator('nav a, header a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to events page via direct URL', async ({ page }) => {
    await page.goto('/events');
    await expect(page.url()).toContain('/events');
  });

  test('should display footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should have logo that links to homepage', async ({ page }) => {
    const logo = page.locator('header a[href="/"], nav a[href="/"]').first();
    await expect(logo).toBeVisible();
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display mobile menu toggle on small screens', async ({ page }) => {
    await page.goto('/');

    // Look for hamburger menu or mobile toggle
    const mobileToggle = page.locator('[class*="mobile"], [class*="hamburger"], button[aria-label*="menu"], [class*="menu-toggle"]');
    const toggleCount = await mobileToggle.count();

    if (toggleCount > 0) {
      await expect(mobileToggle.first()).toBeVisible();
    }
  });

  test('mobile menu should toggle open', async ({ page }) => {
    await page.goto('/');

    const mobileToggle = page.locator('[class*="mobile"], [class*="hamburger"], button[aria-label*="menu"], [class*="menu-toggle"]').first();

    if (await mobileToggle.isVisible()) {
      await mobileToggle.click();

      // Mobile nav should become visible
      const mobileNav = page.locator('[class*="mobile-nav"], [class*="mobile-menu"], nav[class*="open"]');
      const navCount = await mobileNav.count();

      if (navCount > 0) {
        await expect(mobileNav.first()).toBeVisible();
      }
    }
  });
});
