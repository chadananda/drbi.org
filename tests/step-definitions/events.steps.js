import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import selectors from '../support/selectors.js';
import { getVisibleEvents } from '../support/test-data.js';

Then('I should see a list of events', async function () {
  const events = this.page.locator(selectors.eventCard);
  await expect(events.first()).toBeVisible({ timeout: 5000 });
});

Then('each event should have a title', async function () {
  const eventCards = this.page.locator(selectors.eventCard);
  const count = await eventCards.count();
  expect(count).toBeGreaterThan(0);

  // Check first few events have titles
  for (let i = 0; i < Math.min(count, 3); i++) {
    const card = eventCards.nth(i);
    const title = card.locator(selectors.eventTitle);
    await expect(title.first()).toBeVisible();
  }
});

Then('each event should have a date', async function () {
  const eventCards = this.page.locator(selectors.eventCard);
  const count = await eventCards.count();
  expect(count).toBeGreaterThan(0);

  // Check first few events have dates
  for (let i = 0; i < Math.min(count, 3); i++) {
    const card = eventCards.nth(i);
    const date = card.locator(selectors.eventDate);
    await expect(date.first()).toBeVisible();
  }
});

Given('there is at least one visible event', async function () {
  const visibleEvents = await getVisibleEvents();
  const now = new Date();
  const upcomingEvents = visibleEvents.filter(e => new Date(e.startDate) > now);

  if (upcomingEvents.length === 0) {
    return 'skipped'; // Skip test if no events
  }
  this.testData.hasEvents = true;
});

When('I click on the first event', async function () {
  const event = this.page.locator(selectors.eventLink).first();
  await event.click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should see the event details page', async function () {
  const url = this.page.url();
  expect(url).toContain('/events/');
});

Then('I should see the event title', async function () {
  const title = this.page.locator('h1').first();
  await expect(title).toBeVisible({ timeout: 5000 });
});

Then('I should see the event description', async function () {
  const content = this.page.locator('main, article');
  const text = await content.textContent();
  expect(text.length).toBeGreaterThan(10);
});

Then('events should be displayed in chronological order', async function () {
  const eventCards = this.page.locator(selectors.eventCard);
  const count = await eventCards.count();

  if (count > 1) {
    const dates = [];
    for (let i = 0; i < count; i++) {
      const card = eventCards.nth(i);
      // Try to get data-event-start attribute
      const startDate = await card.getAttribute('data-event-start');
      if (startDate) {
        dates.push(new Date(startDate));
      }
    }

    // Verify dates are in ascending order
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i - 1].getTime());
    }
  }
});
