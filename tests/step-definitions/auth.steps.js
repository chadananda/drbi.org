import 'dotenv/config';
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
  // Email field (magic-link form) is always visible
  const usernameField = this.page.locator(selectors.usernameField);
  await expect(usernameField.first()).toBeVisible({ timeout: 5000 });
  // Open break-glass <details> to check password + submit
  const summary = this.page.locator(selectors.breakGlassSummary);
  if (await summary.count() > 0) await summary.first().click();
  const passwordField = this.page.locator(selectors.passwordField);
  const submitButton = this.page.locator(selectors.submitButton);
  await expect(passwordField.first()).toBeVisible({ timeout: 5000 });
  await expect(submitButton.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see username and password fields', async function () {
  // Email field in the magic-link form is always visible
  const usernameField = this.page.locator(selectors.usernameField);
  await expect(usernameField.first()).toBeVisible({ timeout: 5000 });
  // Password field lives inside the break-glass <details> — open it first
  const summary = this.page.locator(selectors.breakGlassSummary);
  if (await summary.count() > 0) await summary.first().click();
  const passwordField = this.page.locator(selectors.passwordField);
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
  const email = process.env.SITE_ADMIN_EMAIL || testCredentials.valid.username;
  const pass = process.env.SITE_ADMIN_PASS || testCredentials.valid.password;
  if (!email || !pass) return 'pending';
  await this.page.goto(`${this.baseURL}/login`);
  // Open the break-glass <details> form (contains email + password fields)
  const summary = this.page.locator(selectors.breakGlassSummary).first();
  await summary.waitFor({ timeout: 5000 });
  await summary.click();
  // Fill credentials in the break-glass form
  await this.page.locator(selectors.breakGlassEmailField).fill(email);
  await this.page.locator(selectors.breakGlassPasswordField).fill(pass);
  // Submit and wait for redirect to /admin
  await Promise.all([
    this.page.waitForNavigation({ timeout: 15000 }),
    this.page.locator(selectors.breakGlassSubmit).first().click()
  ]);
  // Verify session is valid — not redirected back to /login
  const url = this.page.url();
  if (url.includes('/login')) throw new Error(`Admin login failed — ended up at ${url}`);
  if (!url.includes('/admin')) throw new Error(`Login redirected to unexpected URL: ${url}`);
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
