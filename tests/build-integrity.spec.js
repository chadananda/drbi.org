import { test, expect } from '@playwright/test';

test.describe('Build Integrity', () => {
  test('homepage should load without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const response = await page.goto('/');

    // Page should load successfully
    expect(response.status()).toBeLessThan(400);

    // No critical console errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') && // Ignore favicon errors
      !err.includes('third-party') // Ignore third-party script errors
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('events page should load without errors', async ({ page }) => {
    const response = await page.goto('/events');
    expect(response.status()).toBeLessThan(400);
  });

  test('login page should load without errors', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response.status()).toBeLessThan(400);
  });

  test('static assets should load', async ({ page }) => {
    await page.goto('/');

    // Check that stylesheets loaded
    const styles = await page.evaluate(() => {
      return document.styleSheets.length > 0;
    });
    expect(styles).toBeTruthy();
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Images should have alt attribute (can be empty for decorative)
      expect(alt).not.toBeNull();
    }
  });

  test('page should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check for meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
  });

  test('API endpoints should respond', async ({ page }) => {
    // Test events API
    const response = await page.request.get('/api/events?action=list');
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Performance Checks', () => {
  test('homepage should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds in dev mode
    expect(loadTime).toBeLessThan(5000);
  });

  test('no layout shift issues', async ({ page }) => {
    await page.goto('/');

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Check for cumulative layout shift
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 1000);
      });
    });

    // CLS should be under 0.25 (good threshold)
    expect(cls).toBeLessThan(0.25);
  });
});
