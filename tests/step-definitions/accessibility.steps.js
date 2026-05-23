import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('the page should have a skip-to-content link or proper heading hierarchy', async function () {
  const skipLink = this.page.locator('a[href="#content"], a[href="#main"], .skip-link, [class*="skip"]');
  const h1 = this.page.locator('h1');
  const hasSkip = await skipLink.count() > 0;
  const hasH1 = await h1.count() > 0;
  expect(hasSkip || hasH1).toBeTruthy();
});

Then('all images should have alt attributes', async function () {
  const imagesWithoutAlt = await this.page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    return Array.from(imgs).filter(img => !img.hasAttribute('alt')).length;
  });
  expect(imagesWithoutAlt).toBe(0);
});

Then('all form inputs should have associated labels or placeholders', async function () {
  const unlabeled = await this.page.evaluate(() => {
    const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select');
    return Array.from(inputs).filter(input => {
      // Skip visually hidden inputs (botcheck honeypots, etc.)
      const style = window.getComputedStyle(input);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (input.getAttribute('aria-hidden') === 'true') return false;
      const hasLabel = input.id && document.querySelector(`label[for="${input.id}"]`);
      const hasPlaceholder = input.placeholder;
      const hasAriaLabel = input.getAttribute('aria-label');
      const parentLabel = input.closest('label');
      return !hasLabel && !hasPlaceholder && !hasAriaLabel && !parentLabel;
    }).length;
  });
  expect(unlabeled).toBe(0);
});

Then('form labels should be readable', async function () {
  const labels = this.page.locator('label');
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const text = await labels.nth(i).textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  }
});

Then('the navigation links should be focusable', async function () {
  const navLinks = this.page.locator('nav a');
  const count = await navLinks.count();
  expect(count).toBeGreaterThan(0);
  await navLinks.first().focus();
  const focused = await this.page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe('A');
});
