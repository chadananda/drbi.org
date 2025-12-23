export const prerender = false;

import { getCollection } from 'astro:content';
import { lucia } from "../../lib/auth";

// GET - Retrieve all events
export const GET = async ({ request }) => {
  try {
    const events = await getCollection('events');
    
    // Sort by date and filter visible events for public access
    const sortedEvents = events
      .filter(event => event.data.visible !== false) // Show by default unless explicitly hidden
      .sort((a, b) => new Date(a.data.startDate).getTime() - new Date(b.data.startDate).getTime());
    
    return new Response(JSON.stringify(sortedEvents), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
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
    console.log('Events API received sessionid:', sessionid);
    
    // Authentication required for all write operations except sync-external
    if (action !== 'sync-external') {
      if (!sessionid) {
        console.error('Events API: No session ID provided');
        return new Response('Session ID required', { status: 401 });
      }
      
      const { user } = await lucia.validateSession(sessionid);
      if (!user) {
        console.error('Events API: Invalid session or user not found');
        return new Response('Invalid session', { status: 401 });
      }
      
      if (!['superadmin', 'admin', 'editor'].includes(user.role)) {
        console.error(`Events API: User ${user.name} has role ${user.role}, access denied`);
        return new Response(`Access denied - required role: admin/superadmin/editor, your role: ${user.role}`, { status: 403 });
      }
      
      console.log(`Events API: User ${user.name} (${user.role}) authorized for action: ${action}`);
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

// Handle external sync (currently Eventbrite)
async function handleExternalSync() {
  try {
    const { updateEvents } = await import('../../utils/eventbrite-scraper.js');
    const hasChanges = await updateEvents();
    
    if (hasChanges) {
      // Check if we're in production for GitHub commits
      const isDev = process.env.NODE_ENV === 'development' || 
                    import.meta.env?.DEV || 
                    import.meta.env?.APP_ENV === 'dev';
      
      if (!isDev) {
        console.log('🚀 Production mode: Events changed - committing to GitHub...');
        
        // Import GitHub CMS functions
        const { commitToGitHub } = await import('../../utils/github-cms.js');
        
        try {
          const commitMessage = `Update events from external source\n\n🔄 Automated sync from external events API\n\n🤖 Generated with [Claude Code](https://claude.ai/code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;
          
          await commitToGitHub(
            'src/content/events',
            commitMessage,
            'DRBI Events System',
            'events@drbi.org'
          );
          
          console.log('✅ Events committed to GitHub successfully');
        } catch (commitError) {
          console.error('❌ Failed to commit events to GitHub:', commitError);
          // Don't fail the sync operation if commit fails
        }
      } else {
        console.log('🏠 Development mode: Events updated locally only (no GitHub commit)');
      }
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

// Handle creating new manual event
async function handleCreateEvent(eventData) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!eventData.title || !eventData.startDate) {
      return new Response('Title and start date are required', { status: 400 });
    }
    
    // Generate event ID for manual events
    const eventId = `manual-${Date.now()}`;
    const eventsDir = path.join(process.cwd(), 'src/content/events');
    
    // Ensure events directory exists
    await fs.mkdir(eventsDir, { recursive: true });
    
    // Create event object with schema-compliant structure
    const newEvent = {
      // Required schema fields
      id: eventId,
      url: `/events/${eventId}`, // URL for event page
      lastModified: new Date().toISOString(),
      
      // Basic event fields
      name: eventData.title,
      shortDescription: eventData.shortDescription || '',
      startDate: eventData.startDate,
      endDate: eventData.endDate || eventData.startDate,
      image: eventData.mainImage || '/images/event-placeholder.jpg',
      teacherImage: eventData.teacherImage || '/images/teacher-placeholder.jpg',
      
      // Optional detailed fields
      fullDescription: eventData.fullDescription || '',
      highlights: eventData.highlights || [],
      
      // Location (required structure)
      location: {
        name: eventData.location?.name || 'TBD',
        address: eventData.location?.address || '',
        city: eventData.location?.city || '',
        state: eventData.location?.state || '',
        zip: eventData.location?.zip || '',
        ...eventData.location
      },
      
      // Pricing
      price: eventData.price || null,
      
      // Registration and URLs
      registrationUrl: eventData.registrationUrl || null,
      
      // Metadata
      organizer: eventData.organizer || 'DRBI',
      categories: eventData.categories || [],
      source: 'manual', // Mark as manual event for counting
      visible: true, // Make sure manual events are visible by default
      
      // Required scraped field for manual events
      scraped: {
        orgPageDate: new Date().toISOString(),
        detailPageDate: new Date().toISOString()
      }
    };
    
    // Save event file
    const filename = `event-${eventId}.json`;
    const filePath = path.join(eventsDir, filename);
    await fs.writeFile(filePath, JSON.stringify(newEvent, null, 2));
    
    console.log(`✅ Created manual event: ${newEvent.name} (${eventId})`);
    
    return new Response(JSON.stringify({ success: true, eventId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error creating event:', error);
    return new Response('Error creating event', { status: 500 });
  }
}

// Handle updating existing event
async function handleUpdateEvent(eventData) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!eventData.id) {
      return new Response('Event ID is required', { status: 400 });
    }
    
    const eventsDir = path.join(process.cwd(), 'src/content/events');
    const filename = `event-${eventData.id}.json`;
    const filePath = path.join(eventsDir, filename);
    
    // Check if event exists
    try {
      await fs.access(filePath);
    } catch {
      return new Response('Event not found', { status: 404 });
    }
    
    // Read existing event
    const existingData = JSON.parse(await fs.readFile(filePath, 'utf8'));
    
    // Update event with new data
    const updatedEvent = {
      ...existingData,
      ...eventData,
      lastModified: new Date().toISOString(),
      // Preserve manualOverrides for external events
      manualOverrides: existingData.source === 'external' ? 
        { ...existingData.manualOverrides, ...eventData } : 
        existingData.manualOverrides
    };
    
    // Save updated event
    await fs.writeFile(filePath, JSON.stringify(updatedEvent, null, 2));
    
    console.log(`✅ Updated event: ${updatedEvent.name} (${eventData.id})`);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error updating event:', error);
    return new Response('Error updating event', { status: 500 });
  }
}

// Handle deleting event
async function handleDeleteEvent(eventData) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!eventData.id) {
      return new Response('Event ID is required', { status: 400 });
    }
    
    const eventsDir = path.join(process.cwd(), 'src/content/events');
    const filename = `event-${eventData.id}.json`;
    const filePath = path.join(eventsDir, filename);
    
    // Delete event file
    await fs.unlink(filePath);
    
    console.log(`🗑️ Deleted event: ${eventData.id}`);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error deleting event:', error);
    return new Response('Error deleting event', { status: 500 });
  }
}

// Handle toggling event visibility
async function handleToggleVisibility(eventData) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!eventData.id) {
      return new Response('Event ID is required', { status: 400 });
    }
    
    const eventsDir = path.join(process.cwd(), 'src/content/events');
    const filename = `event-${eventData.id}.json`;
    const filePath = path.join(eventsDir, filename);
    
    // Read existing event
    const existingData = JSON.parse(await fs.readFile(filePath, 'utf8'));
    
    // Toggle visibility
    existingData.visible = !existingData.visible;
    existingData.lastModified = new Date().toISOString();
    
    // Save updated event
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
    
    console.log(`👁️ Toggled visibility for event: ${existingData.name} (${eventData.id}) - now ${existingData.visible ? 'visible' : 'hidden'}`);
    
    return new Response(JSON.stringify({ success: true, visible: existingData.visible }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error toggling event visibility:', error);
    return new Response('Error toggling event visibility', { status: 500 });
  }
}

// Handle force refresh from Eventbrite
async function handleForceRefresh(eventData) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    if (!eventData.id) {
      return new Response('Event ID is required', { status: 400 });
    }

    const eventsDir = path.join(process.cwd(), 'src/content/events');
    const filename = `event-${eventData.id}.json`;
    const filePath = path.join(eventsDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return new Response('Event not found', { status: 404 });
    }

    // Read current event data
    const currentData = JSON.parse(await fs.readFile(filePath, 'utf8'));

    // Force refresh by removing manuallyEdited flag and calling scraper
    const scraperModule = await import('../../utils/eventbrite-scraper.js');
    const { refreshSingleEvent } = scraperModule.default;

    // Call the scraper to refresh this specific event
    const redownloadImages = eventData.redownloadImages || false;
    const refreshed = await refreshSingleEvent(eventData.id, redownloadImages);

    if (refreshed) {
      const message = redownloadImages
        ? 'Event refreshed and images re-downloaded successfully!'
        : 'Event data refreshed successfully!';
      return new Response(JSON.stringify({ success: true, message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response('Failed to refresh event', { status: 500 });
    }

  } catch (error) {
    console.error('Error force refreshing event:', error);
    return new Response('Error force refreshing event', { status: 500 });
  }
}