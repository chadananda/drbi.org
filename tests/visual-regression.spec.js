import { test, expect } from '@playwright/test';

// All public routes to screenshot
const publicRoutes = [
  { path: '/', name: 'homepage' },
  { path: '/about-us', name: 'about' },
  { path: '/working-with-us', name: 'working-with-us' },
  { path: '/contact-us', name: 'contact' },
  { path: '/how-to-purchase-a-plot', name: 'cemetery-plot' },
  { path: '/events', name: 'events' },
  { path: '/topics', name: 'topics' },
  { path: '/categories', name: 'categories' },
  { path: '/authors', name: 'authors' },
  { path: '/memorial', name: 'memorial' },
  { path: '/news', name: 'news' },
  { path: '/login', name: 'login' },
];

test.describe('Visual Regression - Full Page Screenshots', () => {
  for (const route of publicRoutes) {
    test(`${route.name} page matches baseline`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      // Wait for any lazy-loaded content
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});

test.describe('Visual Regression - Above the Fold', () => {
  for (const route of publicRoutes) {
    test(`${route.name} above-fold matches baseline`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${route.name}-fold.png`, {
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});

test.describe('Visual Regression - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const mobileRoutes = [
    { path: '/', name: 'homepage' },
    { path: '/about-us', name: 'about' },
    { path: '/contact-us', name: 'contact' },
    { path: '/events', name: 'events' },
    { path: '/login', name: 'login' },
  ];

  for (const route of mobileRoutes) {
    test(`${route.name} mobile matches baseline`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${route.name}-mobile.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});

test.describe('Visual Regression - Components', () => {
  test('navbar renders correctly', async ({ page }) => {
    await page.goto('/');
    const navbar = page.locator('nav').first();
    await expect(navbar).toHaveScreenshot('navbar.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('footer renders correctly', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveScreenshot('footer.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('contact form renders correctly', async ({ page }) => {
    await page.goto('/contact-us');
    const form = page.locator('form').first();
    await expect(form).toHaveScreenshot('contact-form.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('login form renders correctly', async ({ page }) => {
    await page.goto('/login');
    const form = page.locator('form').first();
    await expect(form).toHaveScreenshot('login-form.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('event cards render correctly', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const eventCard = page.locator('[data-event-start], .event-card').first();
    if (await eventCard.isVisible()) {
      await expect(eventCard).toHaveScreenshot('event-card.png', {
        maxDiffPixelRatio: 0.05,
      });
    }
  });
});

test.describe('Visual Regression - Interactive States', () => {
  test('navbar hover state', async ({ page }) => {
    await page.goto('/');
    const navLink = page.locator('nav a').first();
    await navLink.hover();
    await expect(page.locator('nav').first()).toHaveScreenshot('navbar-hover.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('mobile menu open state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    // Click hamburger menu
    const menuToggle = page.locator('button[aria-expanded], .astronav-toggle, [data-astronav-toggle]');
    if (await menuToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuToggle.click();
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('mobile-menu-open.png', {
        maxDiffPixelRatio: 0.05,
      });
    }
  });

  test('404 page appearance', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz');
    await expect(page).toHaveScreenshot('404-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});
