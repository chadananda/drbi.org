import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('the page should load without errors', async function () {
  const title = await this.page.title();
  expect(title.length).toBeGreaterThan(0);
  expect(title).not.toContain('undefined');
  const bodyText = await this.page.textContent('body');
  expect(bodyText.toLowerCase()).not.toContain('internal server error');
});
