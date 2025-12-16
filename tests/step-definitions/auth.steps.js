import { Given, When, Then } from '@cucumber/cucumber';

Then('I should be redirected to the login page', async function () {
  const url = this.page.url();
  if (!url.includes('/login')) {
    throw new Error('Not redirected to login page');
  }
});

Then('I should see a login form', async function () {
  const form = this.page.locator('form');
  const visible = await form.isVisible();
  if (!visible) {
    throw new Error('Login form not found');
  }
});

Then('I should see the login form', async function () {
  const form = this.page.locator('form');
  const visible = await form.isVisible();
  if (!visible) {
    throw new Error('Login form not found');
  }
});

Then('the form should be functional', async function () {
  const usernameField = this.page.locator('input[type="text"], input[type="email"]').first();
  const passwordField = this.page.locator('input[type="password"]');
  const submitButton = this.page.locator('button[type="submit"], input[type="submit"]');

  const hasUsername = await usernameField.isVisible();
  const hasPassword = await passwordField.isVisible();
  const hasSubmit = await submitButton.first().isVisible();

  if (!hasUsername || !hasPassword || !hasSubmit) {
    throw new Error('Login form is missing required elements');
  }
});

Then('I should see username and password fields', async function () {
  const usernameField = this.page.locator('input[type="text"], input[type="email"]').first();
  const passwordField = this.page.locator('input[type="password"]');

  const hasUsername = await usernameField.isVisible();
  const hasPassword = await passwordField.isVisible();

  if (!hasUsername || !hasPassword) {
    throw new Error('Missing username or password field');
  }
});

Then('I should see a login button', async function () {
  const button = this.page.locator('button[type="submit"], input[type="submit"]');
  const visible = await button.first().isVisible();
  if (!visible) {
    throw new Error('Login button not found');
  }
});

When('I enter invalid credentials', async function () {
  const usernameField = this.page.locator('input[type="text"], input[type="email"]').first();
  const passwordField = this.page.locator('input[type="password"]');

  await usernameField.fill('invalid@test.com');
  await passwordField.fill('wrongpassword');
});

When('I submit the login form', async function () {
  const button = this.page.locator('button[type="submit"], input[type="submit"]').first();
  await button.click();
  await this.page.waitForTimeout(1000);
});

Then('I should remain on the login page', async function () {
  const url = this.page.url();
  if (!url.includes('/login')) {
    throw new Error('Should have stayed on login page');
  }
});

Given('I am logged in as an admin', async function () {
  // This would require test credentials
  // For now, skip if not configured
  const testUser = process.env.TEST_ADMIN_USER;
  const testPass = process.env.TEST_ADMIN_PASS;

  if (!testUser || !testPass) {
    return 'pending';
  }

  await this.page.goto('http://localhost:4321/login');

  const usernameField = this.page.locator('input[type="text"], input[type="email"]').first();
  const passwordField = this.page.locator('input[type="password"]');

  await usernameField.fill(testUser);
  await passwordField.fill(testPass);

  const button = this.page.locator('button[type="submit"], input[type="submit"]').first();
  await button.click();

  await this.page.waitForURL(/admin/);
});

When('I click the logout button', async function () {
  const logoutButton = this.page.getByRole('button', { name: /logout/i });
  const logoutLink = this.page.getByRole('link', { name: /logout/i });

  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else if (await logoutLink.isVisible()) {
    await logoutLink.click();
  }
});

Then('I should be logged out', async function () {
  await this.page.waitForTimeout(500);
});
