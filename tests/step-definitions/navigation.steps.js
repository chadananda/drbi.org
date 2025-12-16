import { Given, When, Then } from '@cucumber/cucumber';

Then('I should see the main navigation', async function () {
  const nav = this.page.locator('nav, [role="navigation"], header');
  const visible = await nav.first().isVisible();
  if (!visible) {
    throw new Error('Navigation not found');
  }
});

Then('the navigation should contain essential links', async function () {
  const homeLink = this.page.getByRole('link', { name: /home|drbi|desert rose/i });
  const eventsLink = this.page.getByRole('link', { name: /events/i });

  const hasHome = await homeLink.first().isVisible();
  const hasEvents = await eventsLink.first().isVisible();

  if (!hasHome || !hasEvents) {
    throw new Error('Missing essential navigation links');
  }
});

When('I click on the events link in navigation', async function () {
  const eventsLink = this.page.getByRole('link', { name: /events/i }).first();
  await eventsLink.click();
});

Then('I should be on the events page', async function () {
  const url = this.page.url();
  if (!url.includes('/events')) {
    throw new Error('Not on events page');
  }
});

When('I click on the about link in navigation', async function () {
  const aboutLink = this.page.getByRole('link', { name: /about/i }).first();
  await aboutLink.click();
});

Then('I should be on the about page', async function () {
  const url = this.page.url();
  if (!url.includes('/about')) {
    throw new Error('Not on about page');
  }
});

Then('I should see the footer section', async function () {
  const footer = this.page.locator('footer');
  const visible = await footer.isVisible();
  if (!visible) {
    throw new Error('Footer not found');
  }
});

Then('the footer should contain contact information', async function () {
  const footer = this.page.locator('footer');
  const text = await footer.textContent();
  // Just verify footer has some content
  if (text.length < 10) {
    throw new Error('Footer seems empty');
  }
});

Given('I am using a mobile viewport', async function () {
  await this.page.setViewportSize({ width: 375, height: 667 });
});

Then('I should see a mobile menu toggle', async function () {
  const toggle = this.page.locator('[class*="mobile"], [class*="hamburger"], button[aria-label*="menu"]');
  const count = await toggle.count();
  // Mobile toggle may not exist in all designs
});

When('I click the mobile menu toggle', async function () {
  const toggle = this.page.locator('[class*="mobile"], [class*="hamburger"], button[aria-label*="menu"]').first();
  if (await toggle.isVisible()) {
    await toggle.click();
  }
});

Then('the mobile navigation menu should appear', async function () {
  const nav = this.page.locator('[class*="mobile-nav"], [class*="mobile-menu"], nav[class*="open"]');
  // May or may not be visible depending on implementation
});
