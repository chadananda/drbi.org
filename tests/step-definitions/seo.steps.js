import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('the page title should not contain {string}', async function (text) {
  const title = await this.page.title();
  expect(title.toLowerCase()).not.toContain(text.toLowerCase());
});

Then('the page title should contain {string}', async function (text) {
  const title = await this.page.title();
  expect(title.toLowerCase()).toContain(text.toLowerCase());
});

Then('the page should have a meta description', async function () {
  const desc = await this.page.locator('meta[name="description"]').getAttribute('content');
  expect(desc).toBeTruthy();
});

Then('the meta description should not be empty', async function () {
  const desc = await this.page.locator('meta[name="description"]').getAttribute('content');
  expect(desc?.trim().length).toBeGreaterThan(0);
});

Then('the page should have a canonical URL', async function () {
  const canonical = await this.page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonical).toBeTruthy();
});
