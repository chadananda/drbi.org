import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';

let browser;
let page;

Before(async function () {
  browser = await chromium.launch();
  const context = await browser.newContext();
  page = await context.newPage();
  this.page = page;
});

After(async function () {
  if (browser) {
    await browser.close();
  }
});

Given('the website is running', async function () {
  // Assumes dev server is running on port 4321
  const response = await this.page.goto('http://localhost:4321');
  if (!response || response.status() >= 400) {
    throw new Error('Website is not running');
  }
});

When('I visit the homepage', async function () {
  await this.page.goto('http://localhost:4321/');
});

When('I visit the events page', async function () {
  await this.page.goto('http://localhost:4321/events');
});

When('I visit the login page', async function () {
  await this.page.goto('http://localhost:4321/login');
});

When('I visit the login page directly', async function () {
  await this.page.goto('http://localhost:4321/login');
});

When('I visit the admin page', async function () {
  await this.page.goto('http://localhost:4321/admin');
});

When('I visit the admin events page', async function () {
  await this.page.goto('http://localhost:4321/admin/events');
});

Then('I should see the page title {string}', async function (title) {
  const pageTitle = await this.page.title();
  if (!pageTitle.includes(title)) {
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
