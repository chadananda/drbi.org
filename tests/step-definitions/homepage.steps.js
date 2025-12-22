import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import selectors from '../support/selectors.js';
import { getVisibleEvents, getHiddenEvents } from '../support/test-data.js';

Then('I should see the hero section', async function () {
  const hero = this.page.locator(selectors.heroSection);
  await expect(hero.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see the categories section', async function () {
  const categories = this.page.locator(selectors.categoriesSection);
  await expect(categories.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see the video player', async function () {
  const video = this.page.locator(selectors.videoPlayer);
  await expect(video.first()).toBeVisible({ timeout: 5000 });
});

Then('I should see the events calendar', async function () {
  const events = this.page.locator(selectors.eventsCalendar);
  await expect(events.first()).toBeVisible({ timeout: 5000 });
});

Then('visible events should be displayed', async function () {
  // Get visible events from data
  const visibleEvents = await getVisibleEvents();
  const now = new Date();
  const upcomingEvents = visibleEvents.filter(e => new Date(e.startDate) > now);

  if (upcomingEvents.length > 0) {
    // Verify at least one event card is visible
    const eventCards = this.page.locator(selectors.eventCard);
    const count = await eventCards.count();
    expect(count).toBeGreaterThan(0);
  }
  // If no upcoming events, test passes (empty state is valid)
});

Then('hidden events should not be displayed', async function () {
  // Get hidden events from data
  const hiddenEvents = await getHiddenEvents();

  // Verify none of the hidden event names appear on the page
  for (const event of hiddenEvents) {
    if (event.name) {
      const eventName = this.page.locator(`text="${event.name}"`);
      await expect(eventName).not.toBeVisible();
    }
  }
});

Then('I should see a newsletter signup link', async function () {
  const link = this.page.locator(selectors.newsletterLink);
  await expect(link.first()).toBeVisible({ timeout: 5000 });
});

Then('the newsletter link should open in a new tab', async function () {
  const link = this.page.locator(selectors.newsletterLink).first();
  const target = await link.getAttribute('target');
  expect(target).toBe('_blank');
});
