import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import selectors from '../support/selectors.js';
import { testCredentials } from '../support/test-data.js';

Then('I should be redirected to the login page', async function () {
  await this.page.waitForURL(/login/, { timeout: 5000 });
  const url = this.page.url();
  expect(url).toContain('/login');
});

Then('I should see a login form', async function () {
  const form = this.page.locator(selectors.loginForm);
  await expect(form.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see the login form', async function () {
  const form = this.page.locator(selectors.loginForm);
  await expect(form.first()).toBeVisible({ timeout: 5000 });
});

Then('the form should be functional', async function () {
  const usernameField = this.page.locator(selectors.usernameField);
  const passwordField = this.page.locator(selectors.passwordField);
  const submitButton = this.page.locator(selectors.submitButton);

  await expect(usernameField.first()).toBeVisible({ timeout: 5000 });
  await expect(passwordField.first()).toBeVisible({ timeout: 5000 });
  await expect(submitButton.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see username and password fields', async function () {
  const usernameField = this.page.locator(selectors.usernameField);
  const passwordField = this.page.locator(selectors.passwordField);

  await expect(usernameField.first()).toBeVisible({ timeout: 5000 });
  await expect(passwordField.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see a login button', async function () {
  const button = this.page.locator(selectors.submitButton);
  await expect(button.first()).toBeVisible({ timeout: 5000 });
});

When('I enter invalid credentials', async function () {
  const usernameField = this.page.locator(selectors.usernameField).first();
  const passwordField = this.page.locator(selectors.passwordField).first();

  await usernameField.fill(testCredentials.invalid.username);
  await passwordField.fill(testCredentials.invalid.password);
});

When('I submit the login form', async function () {
  const button = this.page.locator(selectors.submitButton).first();
  await button.click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should remain on the login page', async function () {
  const url = this.page.url();
  expect(url).toContain('/login');
});

Given('I am logged in as an admin', async function () {
  const { username, password } = testCredentials.valid;

  if (!username || !password) {
    return 'pending'; // Skip if no test credentials configured
  }

  await this.page.goto(`${this.baseURL}/login`);

  const usernameField = this.page.locator(selectors.usernameField).first();
  const passwordField = this.page.locator(selectors.passwordField).first();

  await usernameField.fill(username);
  await passwordField.fill(password);

  const button = this.page.locator(selectors.submitButton).first();
  await button.click();

  await this.page.waitForURL(/admin/, { timeout: 10000 });
});

When('I click the logout button', async function () {
  const logoutButton = this.page.locator(selectors.logoutButton);
  await logoutButton.first().click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should be logged out', async function () {
  // Should be redirected to login page
  await this.page.waitForURL(/login/, { timeout: 5000 });
  const url = this.page.url();
  expect(url).toContain('/login');

  // Login form should be visible
  const form = this.page.locator(selectors.loginForm);
  await expect(form.first()).toBeVisible({ timeout: 5000 });
});
