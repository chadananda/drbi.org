import { Given, When, Then } from '@cucumber/cucumber';

// Browser lifecycle hooks are in tests/support/hooks.js

Given('the website is running', async function () {
  const response = await this.page.goto(this.baseURL);
  if (!response || response.status() >= 400) {
    throw new Error('Website is not running');
  }
});

When('I visit the homepage', async function () {
  await this.page.goto(`${this.baseURL}/`);
});

When('I visit the events page', async function () {
  await this.page.goto(`${this.baseURL}/events`);
});

When('I visit the login page', async function () {
  await this.page.goto(`${this.baseURL}/login`);
});

When('I visit the login page directly', async function () {
  await this.page.goto(`${this.baseURL}/login`);
});

When('I visit the admin page', async function () {
  await this.page.goto(`${this.baseURL}/admin`);
});

When('I visit the admin events page', async function () {
  await this.page.goto(`${this.baseURL}/admin/events`);
});

Then('I should see the page title {string}', async function (title) {
  const pageTitle = await this.page.title();
  // Normalize unicode characters for comparison
  const normalizedTitle = pageTitle.normalize('NFC').toLowerCase();
  const normalizedExpected = title.normalize('NFC').toLowerCase();
  if (!normalizedTitle.includes(normalizedExpected)) {
    throw new Error(`Expected title to contain "${title}" but got "${pageTitle}"`);
  }
});

Then('I should see the page title containing {string}', async function (text) {
  const pageTitle = await this.page.title();
  if (!pageTitle.toLowerCase().includes(text.toLowerCase())) {
    throw new Error(`Expected title to contain "${text}" but got "${pageTitle}"`);
  }
});

Then('I should see the {string} section', async function (sectionName) {
  const heading = this.page.getByRole('heading', { name: new RegExp(sectionName, 'i') });
  const visible = await heading.isVisible();
  if (!visible) {
    throw new Error(`Section "${sectionName}" not found`);
  }
});

Then('I should see an error message', async function () {
  const error = this.page.locator('[class*="error"], [role="alert"]');
  const count = await error.count();
  if (count === 0) {
    throw new Error('No error message found');
  }
});
