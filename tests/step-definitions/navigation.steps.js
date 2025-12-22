import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import selectors from '../support/selectors.js';

Then('I should see the main navigation', async function () {
  const nav = this.page.locator(selectors.navbar);
  await expect(nav.first()).toBeVisible({ timeout: 5000 });
});

Then('the navigation should contain essential links', async function () {
  // Click menu toggle to expand navigation (astro-navbar keeps menu collapsed by default)
  const menuToggle = this.page.locator('button').first();
  if (await menuToggle.isVisible()) {
    await menuToggle.click();
    await this.page.waitForTimeout(300);
  }
  const eventsLink = this.page.locator('a:has-text("Events")').first();
  await expect(eventsLink).toBeVisible({ timeout: 5000 });
});

When('I click on the events link in navigation', async function () {
  // Check if menu toggle exists and click it first (for mobile/collapsed menu)
  const menuToggle = this.page.locator('button[aria-expanded], .astronav-toggle, [data-astronav-toggle]');
  if (await menuToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    await menuToggle.click();
    await this.page.waitForTimeout(300);
  }
  const eventsLink = this.page.getByRole('link', { name: /events/i }).first();
  await eventsLink.click({ timeout: 10000 });
  await this.page.waitForLoadState('networkidle');
});

Then('I should be on the events page', async function () {
  const url = this.page.url();
  expect(url).toContain('/events');
});

When('I click on the about link in navigation', async function () {
  const aboutLink = this.page.getByRole('link', { name: /about/i }).first();
  await aboutLink.click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should be on the about page', async function () {
  const url = this.page.url();
  expect(url).toContain('/about');
});

Then('I should see the footer section', async function () {
  const footer = this.page.locator(selectors.footer);
  await expect(footer).toBeVisible({ timeout: 5000 });
});

Then('the footer should contain contact information', async function () {
  const footer = this.page.locator(selectors.footer);
  const text = await footer.textContent();
  expect(text.length).toBeGreaterThan(10);
});

Given('I am using a mobile viewport', async function () {
  await this.page.setViewportSize({ width: 375, height: 667 });
});

Then('I should see a mobile menu toggle', async function () {
  const toggle = this.page.locator(selectors.mobileMenuToggle);
  // Mobile menu toggle should be visible on mobile viewport
  await expect(toggle.first()).toBeVisible({ timeout: 5000 });
});

When('I click the mobile menu toggle', async function () {
  const toggle = this.page.locator(selectors.mobileMenuToggle).first();
  await toggle.click();
  // Wait for menu animation
  await this.page.waitForTimeout(300);
});

Then('the mobile navigation menu should appear', async function () {
  const nav = this.page.locator(selectors.mobileNav);
  await expect(nav.first()).toBeVisible({ timeout: 5000 });
});
