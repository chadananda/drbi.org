// Admin smoke steps — generic page-load verification for all admin routes
import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('the admin page loads without error', async function () {
  const url = this.page.url();
  // Must not be redirected to login
  if (url.includes('/login')) throw new Error(`Admin page redirected to login — session lost or route unprotected: ${url}`);
  const bodyText = await this.page.textContent('body');
  expect(bodyText.trim().length).toBeGreaterThan(50);
});

Then('the admin page body contains {string}', async function (text) {
  const bodyText = await this.page.textContent('body');
  const lower = text.toLowerCase();
  if (!bodyText.toLowerCase().includes(lower)) {
    throw new Error(`Expected admin page to contain "${text}" but it was not found`);
  }
});
