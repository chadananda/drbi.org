import fs from 'fs/promises';
import path from 'path';

const eventsDir = path.join(process.cwd(), 'src/content/events');

/**
 * Get all visible (not hidden) events sorted by start date
 */
export async function getVisibleEvents() {
  try {
    const files = await fs.readdir(eventsDir);
    const events = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(eventsDir, file), 'utf-8');
        const event = JSON.parse(content);
        if (event.visible !== false) {
          events.push({ id: file.replace('.json', ''), ...event });
        }
      }
    }

    return events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  } catch (error) {
    console.warn('Could not read events directory:', error.message);
    return [];
  }
}

/**
 * Get all hidden events
 */
export async function getHiddenEvents() {
  try {
    const files = await fs.readdir(eventsDir);
    const events = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(eventsDir, file), 'utf-8');
        const event = JSON.parse(content);
        if (event.visible === false) {
          events.push({ id: file.replace('.json', ''), ...event });
        }
      }
    }

    return events;
  } catch (error) {
    console.warn('Could not read events directory:', error.message);
    return [];
  }
}

/**
 * Get the first upcoming visible event
 */
export async function getFirstUpcomingEvent() {
  const events = await getVisibleEvents();
  const now = new Date();
  return events.find(e => new Date(e.startDate) > now);
}

/**
 * Get all events (both visible and hidden)
 */
export async function getAllEvents() {
  const visible = await getVisibleEvents();
  const hidden = await getHiddenEvents();
  return [...visible, ...hidden];
}

/**
 * Test credentials from environment variables
 */
export const testCredentials = {
  invalid: {
    username: 'invalid@test.com',
    password: 'wrongpassword123'
  },
  valid: {
    username: process.env.TEST_ADMIN_USER || null,
    password: process.env.TEST_ADMIN_PASS || null
  }
};

export default {
  getVisibleEvents,
  getHiddenEvents,
  getFirstUpcomingEvent,
  getAllEvents,
  testCredentials
};
