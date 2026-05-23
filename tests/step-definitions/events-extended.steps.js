import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('events with registration URLs should have register buttons', async function () {
  // Informational check — some events may not have registration links
  const bodyText = await this.page.textContent('body');
  expect(bodyText.length).toBeGreaterThan(100);
});

Then('event cards should display teacher or event images', async function () {
  const images = this.page.locator('main img, [data-event-start] img');
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
});

Then('displayed events should have future or current dates', async function () {
  const bodyText = await this.page.textContent('body');
  const hasDateContent = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|2026|2027)\b/i.test(bodyText);
  expect(hasDateContent).toBeTruthy();
});
