// Auth coverage steps — verifies auth boundaries and API contracts
import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { openAccountMenu } from '../support/auth-helpers.js';

Then('the magic-link email form is visible', async function () {
  await openAccountMenu(this.page);
  const emailField = this.page.locator('#nav-magic-form input[type="email"], #nav-magic-form input[name="email"]');
  await expect(emailField.first()).toBeVisible({ timeout: 5000 });
});

Then('the Google sign-in widget or button is present', async function () {
  await openAccountMenu(this.page);
  // Google One Tap markup lives in the popover: #g_id_onload / [data-client_id]
  const googleEl = this.page.locator('#g_id_onload, [data-client_id], .g_id_signin, iframe[src*="accounts.google.com"], script[src*="accounts.google.com"]');
  const count = await googleEl.count();
  if (count === 0) {
    const bodyText = await this.page.textContent('body');
    const hasGoogle = bodyText.toLowerCase().includes('google') || bodyText.toLowerCase().includes('sign in with');
    expect(hasGoogle, 'Expected Google sign-in option in the sign-in popover').toBeTruthy();
  }
});

When('I POST to {string} with email {string}', async function (path, email) {
  const response = await this.page.request.post(`${this.baseURL}${path}`, {
    data: { email }
  });
  this.testData.apiResponse = response;
});

Then('the auth API response is ok', async function () {
  const response = this.testData.apiResponse;
  expect(response.status()).toBeLessThan(400);
  const body = await response.json().catch(() => ({}));
  expect(body.ok).toBeTruthy();
});

When('I POST to {string} with a bad credential', async function (path) {
  const response = await this.page.request.post(`${this.baseURL}${path}`, {
    data: { credential: 'invalid_google_token_for_testing' }
  });
  this.testData.apiResponse = response;
});

Then('the auth API response status is {int}', async function (expectedStatus) {
  const response = this.testData.apiResponse;
  expect(response.status()).toBe(expectedStatus);
});
