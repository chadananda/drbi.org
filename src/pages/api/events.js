export const prerender = false;

import { lucia } from "../../lib/auth";
import {
  getVisibleEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  toggleEventVisibility,
} from "../../lib/queries";

// GET - Retrieve all visible events from Turso, sorted by start date
export const GET = async ({ request }) => {
  try {
    const events = await getVisibleEvents();
    return new Response(JSON.stringify(events), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      }
    });
  } catch (error) {
    console.error('Error retrieving events:', error);
    return new Response('Error retrieving events', { status: 500 });
  }
};

// POST - Event operations (create, update, delete, sync)
export const POST = async ({ request }) => {
  try {
    const { action, eventData, sessionid } = await request.json();

    // Auth required for all write operations except sync-external
    if (action !== 'sync-external') {
      if (!sessionid) {
        return new Response('Session ID required', { status: 401 });
      }
      const { user } = await lucia.validateSession(sessionid);
      if (!user) return new Response('Invalid session', { status: 401 });
      if (!['superadmin', 'admin', 'editor'].includes(user.role)) {
        return new Response(`Access denied`, { status: 403 });
      }
    }

    switch (action) {
      case 'sync-external':
        return await handleExternalSync();
      case 'create':
        return await handleCreateEvent(eventData);
      case 'update':
        return await handleUpdateEvent(eventData);
      case 'delete':
        return await handleDeleteEvent(eventData);
      case 'toggle-visibility':
        return await handleToggleVisibility(eventData);
      case 'force-refresh':
        return await handleForceRefresh(eventData);
      default:
        return new Response('Invalid action', { status: 400 });
    }
  } catch (error) {
    console.error('Error in events API:', error);
    return new Response('Server error', { status: 500 });
  }
};

async function handleExternalSync() {
  try {
    const { updateEvents } = await import('../../utils/eventbrite-scraper.js');
    const hasChanges = await updateEvents();

    if (hasChanges) {
      // Re-seed updated events from filesystem into Turso
      const { seedEventsToTurso } = await import('../../lib/seed-events.js');
      await seedEventsToTurso();
    }

    return new Response(JSON.stringify({ success: true, hasChanges }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error syncing external events:', error);
    return new Response('Error syncing external events', { status: 500 });
  }
}

async function handleCreateEvent(eventData) {
  if (!eventData?.title || !eventData?.startDate) {
    return new Response('Title and start date are required', { status: 400 });
  }

  try {
    const result = await createEvent({
      title: eventData.title,
      short_description: eventData.shortDescription ?? '',
      full_description: eventData.fullDescription ?? '',
      start_date: eventData.startDate,
      end_date: eventData.endDate ?? eventData.startDate,
      location: eventData.location ?? {},
      price: eventData.price ?? null,
      registration_url: eventData.registrationUrl ?? null,
      main_image: eventData.mainImage ?? '',
      teacher_image: eventData.teacherImage ?? '',
      highlights: eventData.highlights ?? [],
      event_schedule: eventData.eventSchedule ?? [],
      organizer: eventData.organizer ?? 'DRBI',
      categories: eventData.categories ?? [],
      source: 'manual',
      visible: 1,
    });

    return new Response(JSON.stringify({ success: true, eventId: result.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return new Response('Error creating event', { status: 500 });
  }
}

async function handleUpdateEvent(eventData) {
  if (!eventData?.id) return new Response('Event ID required', { status: 400 });

  const existing = await getEventById(eventData.id);
  if (!existing) return new Response('Event not found', { status: 404 });

  try {
    await updateEvent(eventData.id, {
      title: eventData.title,
      short_description: eventData.shortDescription,
      full_description: eventData.fullDescription,
      start_date: eventData.startDate,
      end_date: eventData.endDate,
      location: eventData.location,
      price: eventData.price,
      registration_url: eventData.registrationUrl,
      sponsorPageUrl: eventData.sponsorPageUrl,
      main_image: eventData.mainImage,
      teacher_image: eventData.teacherImage,
      highlights: eventData.highlights,
      event_schedule: eventData.eventSchedule,
      organizer: eventData.organizer,
      categories: eventData.categories,
      manually_edited: 1,
      last_manual_edit: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return new Response('Error updating event', { status: 500 });
  }
}

async function handleDeleteEvent(eventData) {
  if (!eventData?.id) return new Response('Event ID required', { status: 400 });

  try {
    await deleteEvent(eventData.id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return new Response('Error deleting event', { status: 500 });
  }
}

async function handleToggleVisibility(eventData) {
  if (!eventData?.id) return new Response('Event ID required', { status: 400 });

  try {
    const result = await toggleEventVisibility(eventData.id);
    return new Response(JSON.stringify({ success: true, visible: result.visible }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error toggling visibility:', error);
    return new Response('Error toggling visibility', { status: 500 });
  }
}

async function handleForceRefresh(eventData) {
  if (!eventData?.id) return new Response('Event ID required', { status: 400 });

  try {
    const { refreshSingleEvent } = await import('../../utils/eventbrite-scraper.js');
    const refreshed = await refreshSingleEvent(eventData.id, eventData.redownloadImages ?? false);

    if (refreshed) {
      // Re-seed this event from filesystem into Turso
      const { seedEventsToTurso } = await import('../../lib/seed-events.js');
      await seedEventsToTurso();

      return new Response(JSON.stringify({ success: true, message: 'Event refreshed.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('Failed to refresh event', { status: 500 });
  } catch (error) {
    console.error('Error force refreshing event:', error);
    return new Response('Error force refreshing event', { status: 500 });
  }
}
