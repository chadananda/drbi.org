import 'dotenv/config';
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import selectors from '../support/selectors.js';
import { testCredentials } from '../support/test-data.js';
import { openAccountMenu, openBreakGlass } from '../support/auth-helpers.js';

Then('I should be redirected to the login page', async function () {
  // /admin now redirects to /?signin=1 (homepage popover), not /login
  const url = this.page.url();
  expect(url).not.toContain('/admin');
  expect(url.includes('signin') || new URL(url).pathname === '/').toBeTruthy();
  // Sign-in popover must be available
  await openAccountMenu(this.page);
  await expect(this.page.locator('#nav-magic-form').first()).toBeVisible({ timeout: 5000 });
});

Then('I should see a login form', async function () {
  await openAccountMenu(this.page);
  const form = this.page.locator(selectors.loginForm);
  await expect(form.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see the login form', async function () {
  await openAccountMenu(this.page);
  const form = this.page.locator(selectors.loginForm);
  await expect(form.first()).toBeVisible({ timeout: 5000 });
});

Then('the form should be functional', async function () {
  await openAccountMenu(this.page);
  // Email field (magic-link form) is visible once popover is open
  const usernameField = this.page.locator(selectors.usernameField);
  await expect(usernameField.first()).toBeVisible({ timeout: 5000 });
  // Open break-glass <details> to check password + submit
  await openBreakGlass(this.page);
  const passwordField = this.page.locator(selectors.passwordField);
  const submitButton = this.page.locator(selectors.submitButton);
  await expect(passwordField.first()).toBeVisible({ timeout: 5000 });
  await expect(submitButton.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see username and password fields', async function () {
  await openAccountMenu(this.page);
  // Email field in the magic-link form is visible once popover is open
  const usernameField = this.page.locator(selectors.usernameField);
  await expect(usernameField.first()).toBeVisible({ timeout: 5000 });
  // Password field lives inside the break-glass <details> — open it first
  await openBreakGlass(this.page);
  const passwordField = this.page.locator(selectors.passwordField);
  await expect(passwordField.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see a login button', async function () {
  await openAccountMenu(this.page);
  const button = this.page.locator(selectors.submitButton);
  await expect(button.first()).toBeVisible({ timeout: 5000 });
});

When('I enter invalid credentials', async function () {
  await openAccountMenu(this.page);
  await openBreakGlass(this.page);
  // Fill the break-glass form (has both email + password)
  await this.page.locator(selectors.breakGlassEmailField).first().fill(testCredentials.invalid.username);
  await this.page.locator(selectors.breakGlassPasswordField).first().fill(testCredentials.invalid.password);
});

When('I submit the login form', async function () {
  const button = this.page.locator(selectors.breakGlassSubmit).first();
  await button.click();
  // Break-glass POSTs JSON; wait for the client to process (error message or navigation)
  await this.page.waitForTimeout(2000);
});

Then('I should remain on the login page', async function () {
  // Invalid-credential flow stays put with an error, not navigated to /admin
  const url = this.page.url();
  expect(url).not.toContain('/admin');
  const errorArea = this.page.locator(selectors.errorMessage);
  await expect(errorArea.first()).toBeVisible({ timeout: 5000 });
});

Given('I am logged in as an admin', async function () {
  const email = process.env.SITE_ADMIN_EMAIL || testCredentials.valid.username;
  const pass = process.env.SITE_ADMIN_PASS || testCredentials.valid.password;
  if (!email || !pass) return 'pending';
  await this.page.goto(`${this.baseURL}/`);
  await openAccountMenu(this.page);
  await openBreakGlass(this.page);
  // Fill credentials in the break-glass form
  await this.page.locator(selectors.breakGlassEmailField).first().fill(email);
  await this.page.locator(selectors.breakGlassPasswordField).first().fill(pass);
  // Submit — client sets location.href='/admin' on success
  await Promise.all([
    this.page.waitForURL(/\/admin/, { timeout: 15000 }),
    this.page.locator(selectors.breakGlassSubmit).first().click()
  ]);
  const url = this.page.url();
  if (!url.includes('/admin')) throw new Error(`Admin login failed — ended up at ${url}`);
});

When('I click the logout button', async function () {
  // Admin panel exposes a plain logout link; other pages use the navbar popover.
  const directLogout = this.page.locator('a[href*="logout"], #signout-btn');
  if (await directLogout.count() === 0 || !(await directLogout.first().isVisible().catch(() => false))) {
    await openAccountMenu(this.page);
  }
  const logoutButton = this.page.locator(selectors.logoutButton);
  await logoutButton.first().click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should be logged out', async function () {
  // After logout the page reloads anonymous — account button present, shows sign-in form again
  await openAccountMenu(this.page);
  await expect(this.page.locator('#nav-magic-form').first()).toBeVisible({ timeout: 5000 });
  // Should NOT show the signed-in state
  await expect(this.page.locator('#signout-btn')).toHaveCount(0);
});
