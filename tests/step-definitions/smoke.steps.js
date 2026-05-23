import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('the page should have a title', async function () {
  await this.page.waitForLoadState('domcontentloaded');
  const title = await this.page.title();
  expect(title.trim().length).toBeGreaterThan(0);
});

Then('the page should not show an error', async function () {
  const body = await this.page.textContent('body');
  const lowerBody = body.toLowerCase();
  const crashPhrases = ['500 internal server error', 'application error', 'unexpected error'];
  for (const phrase of crashPhrases) {
    expect(lowerBody).not.toContain(phrase);
  }
});

Then('the page should show a 404 message', async function () {
  const statusOrBody = await Promise.race([
    this.page.locator('h1').first().textContent().catch(() => ''),
    this.page.title(),
  ]);
  const text = (statusOrBody || '').toLowerCase();
  expect(text.includes('404') || text.includes('not found') || text.includes('page not found')).toBeTruthy();
});

Then('I should see a heading containing {string}', async function (text) {
  const heading = this.page.getByRole('heading', { name: new RegExp(text, 'i') });
  await expect(heading.first()).toBeVisible({ timeout: 8000 });
});
