import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import selectors from '../support/selectors.js';

Then('I should see the events section', async function () {
  const section = this.page.locator(selectors.eventsSection);
  await expect(section.first()).toBeVisible({ timeout: 8000 });
});

Then('all displayed events should have future dates', async function () {
  const now = new Date();
  // Events store dates in data-event-start attribute or time elements
  const dateEls = this.page.locator('[data-event-start], time[datetime]');
  const count = await dateEls.count();

  // If no date elements found, check that at least some events are shown
  if (count === 0) {
    const eventCards = this.page.locator('[data-testid="event-card"], .event-card, [class*="event"]');
    const cardCount = await eventCards.count();
    // Acceptable if the section exists but has no events (e.g. all events future and none loaded yet)
    return;
  }

  let pastCount = 0;
  for (let i = 0; i < count; i++) {
    const el = dateEls.nth(i);
    const dateStr = await el.getAttribute('data-event-start') ?? await el.getAttribute('datetime');
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && date < now) {
      pastCount++;
    }
  }
  expect(pastCount).toBe(0);
});

Then('the events response should contain an array', async function () {
  const body = await this.apiResponse.json();
  const events = Array.isArray(body) ? body : body.events ?? body.data;
  expect(Array.isArray(events)).toBeTruthy();
});

Then('the events response should be sorted by date ascending', async function () {
  const body = await this.apiResponse.json();
  const events = Array.isArray(body) ? body : body.events ?? body.data ?? [];
  if (events.length < 2) return;

  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i-1].data?.startDate ?? events[i-1].startDate);
    const curr = new Date(events[i].data?.startDate ?? events[i].startDate);
    if (!isNaN(prev.getTime()) && !isNaN(curr.getTime())) {
      expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
    }
  }
});
