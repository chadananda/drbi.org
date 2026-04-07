import { Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Given('I am using a tablet viewport', async function () {
  await this.page.setViewportSize({ width: 768, height: 1024 });
});

Then('the page content should not overflow horizontally', async function () {
  const overflows = await this.page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflows).toBeFalsy();
});

Then('the contact form should be usable', async function () {
  const form = this.page.locator('form');
  await expect(form.first()).toBeVisible();
});

Then('inputs should be full width', async function () {
  const input = this.page.locator('input[type="text"], input[type="email"], input[placeholder]').first();
  const box = await input.boundingBox();
  if (box) {
    expect(box.width).toBeGreaterThan(200);
  }
});

Then('the layout should adapt to tablet width', async function () {
  const overflows = await this.page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflows).toBeFalsy();
});
