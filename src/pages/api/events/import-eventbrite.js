// API endpoint for importing event data from Eventbrite
export const prerender = false;

import eventbriteScraper from '../../../utils/eventbrite-scraper.js';

export async function POST({ request }) {
  try {
    const { eventbriteId } = await request.json();
    
    if (!eventbriteId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Eventbrite ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Construct Eventbrite URL from ID
    const eventbriteUrl = `https://www.eventbrite.com/e/${eventbriteId}`;
    
    console.log(`📥 Importing event data from: ${eventbriteUrl}`);

    // Use the existing scraper to get event details
    const eventData = await eventbriteScraper.scrapeEventDetails(eventbriteUrl);

    if (!eventData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to scrape event data from Eventbrite. Please check the ID and try again.'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Format the data for the frontend form
    const formattedData = {
      title: eventData.title,
      shortDescription: eventData.shortDescription || eventData.description,
      fullDescription: eventData.description,
      startDate: eventData.startDate,
      startTime: eventData.startTime,
      endDate: eventData.endDate,
      endTime: eventData.endTime,
      organizer: eventData.organizer || 'DRBI',
      price: eventData.price,
      highlights: eventData.highlights || [],
      location: eventData.location,
      mainImage: eventData.mainImage,
      registrationUrl: eventbriteUrl,
      eventbriteId: eventbriteId
    };

    console.log(`✅ Successfully imported event: ${eventData.title}`);

    return new Response(JSON.stringify({
      success: true,
      eventData: formattedData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error importing from Eventbrite:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: `Import failed: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}