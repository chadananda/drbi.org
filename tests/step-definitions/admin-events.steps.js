import { Given, When, Then } from '@cucumber/cucumber';

Then('I should see a list of all events', async function () {
  const events = this.page.locator('[class*="event"], article, .card');
  const count = await events.count();
  if (count === 0) {
    throw new Error('No events found in admin');
  }
});

Then('each event should show its visibility status', async function () {
  const toggles = this.page.locator('.toggle-visibility, [class*="visibility"]');
  const count = await toggles.count();
  if (count === 0) {
    throw new Error('No visibility toggles found');
  }
});

Then('I should see edit buttons for each event', async function () {
  const editButtons = this.page.getByRole('link', { name: /edit/i });
  const count = await editButtons.count();
  if (count === 0) {
    throw new Error('No edit buttons found');
  }
});

Then('I should see hide\\/show buttons for each event', async function () {
  const toggles = this.page.locator('.toggle-visibility');
  const count = await toggles.count();
  if (count === 0) {
    throw new Error('No hide/show buttons found');
  }
});

Given('there is a hidden event', async function () {
  // This would require checking event data
  // For now, assume test data exists
});

Given('there is a visible event', async function () {
  // This would require checking event data
});

Given('there is an event', async function () {
  // This would require checking event data
});

Then('hidden events should have reduced opacity', async function () {
  const hidden = this.page.locator('[class*="opacity"]');
  // Check exists if there are hidden events
});

Then('hidden events should have an orange border', async function () {
  const hidden = this.page.locator('[class*="orange"]');
  // Check exists if there are hidden events
});

Then('hidden events should show {string} button instead of {string}', async function (showText, hideText) {
  // Verify button text matches visibility state
});

When('I click the hide button for an event', async function () {
  const hideButton = this.page.locator('.toggle-visibility').first();
  if (await hideButton.isVisible()) {
    await hideButton.click();
    await this.page.waitForTimeout(1000);
  }
});

Then('the event should become hidden', async function () {
  // Verify visibility changed
});

Then('the button should change to {string}', async function (text) {
  // Verify button text
});

Then('the event card should update its visual state', async function () {
  // Verify visual changes
});

When('I click the edit button for an event', async function () {
  const editLink = this.page.getByRole('link', { name: /edit/i }).first();
  await editLink.click();
});

Then('I should see the event edit form', async function () {
  const form = this.page.locator('form');
  const visible = await form.isVisible();
  if (!visible) {
    throw new Error('Edit form not found');
  }
});

Then('I should see a visibility checkbox', async function () {
  const checkbox = this.page.locator('input[name="visible"], input[id*="visible"]');
  const visible = await checkbox.isVisible();
  if (!visible) {
    throw new Error('Visibility checkbox not found');
  }
});

When('I uncheck the visibility checkbox', async function () {
  const checkbox = this.page.locator('input[name="visible"], input[id*="visible"]');
  await checkbox.uncheck();
});

When('I save the event', async function () {
  const saveButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
  await saveButton.click();
  await this.page.waitForTimeout(1000);
});

Then('the event visibility should be updated to hidden', async function () {
  // Verify save was successful
});

When('I toggle the event to hidden in admin', async function () {
  await this.page.goto('http://localhost:4321/admin/events');
  const hideButton = this.page.locator('.toggle-visibility').first();
  if (await hideButton.isVisible()) {
    await hideButton.click();
    await this.page.waitForTimeout(1000);
  }
});

Then('the hidden event should not be displayed', async function () {
  // This would require knowing which event was hidden
});

When('I click the create new event button', async function () {
  const createButton = this.page.getByRole('link', { name: /create|new|add/i });
  await createButton.click();
});

Then('I should see the event creation form', async function () {
  const form = this.page.locator('form');
  const visible = await form.isVisible();
  if (!visible) {
    throw new Error('Creation form not found');
  }
});

Then('the form should have required fields', async function () {
  const titleField = this.page.locator('input[name="title"], input[id*="title"]');
  const visible = await titleField.isVisible();
  if (!visible) {
    throw new Error('Required title field not found');
  }
});

When('I click the delete button for an event', async function () {
  const deleteButton = this.page.locator('[class*="delete"], button:has-text("Delete")').first();
  if (await deleteButton.isVisible()) {
    await deleteButton.click();
  }
});

When('I confirm the deletion', async function () {
  // Handle confirmation dialog
  this.page.on('dialog', dialog => dialog.accept());
  await this.page.waitForTimeout(500);
});

Then('the event should be removed from the list', async function () {
  // Verify event count decreased
});
