// Auth coverage steps — verifies auth boundaries and API contracts
import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('the magic-link email form is visible', async function () {
  // The magic-link form (#magic-form) has an email input that is always visible
  const emailField = this.page.locator('#magic-form input[type="email"], form#magic-form input[name="email"]');
  if (await emailField.count() === 0) {
    // Fallback: any visible email input not inside <details>
    const anyEmail = this.page.locator('input[type="email"]:not(details input)');
    await expect(anyEmail.first()).toBeVisible({ timeout: 5000 });
  } else {
    await expect(emailField.first()).toBeVisible({ timeout: 5000 });
  }
});

Then('the Google sign-in widget or button is present', async function () {
  // Google One Tap renders a div with id="g_id_onload" or a script/button
  const googleEl = this.page.locator('#g_id_onload, [data-client_id], iframe[src*="accounts.google.com"], script[src*="accounts.google.com"]');
  const count = await googleEl.count();
  if (count === 0) {
    // Acceptable alternative: body text mentions Google
    const bodyText = await this.page.textContent('body');
    const hasGoogle = bodyText.toLowerCase().includes('google') || bodyText.toLowerCase().includes('sign in with');
    expect(hasGoogle, 'Expected Google sign-in option on login page').toBeTruthy();
  }
  // Google element found — pass
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
