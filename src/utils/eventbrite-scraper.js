// eventbrite-scraper.js - Two-level intelligent scraping system for Eventbrite events
import siteConfig from '../data/site.json' with { type: 'json' };
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Helper function to extract event ID from URL
const extractEventId = (url) => {
  // Handle both "registration-" and "tickets-" URL patterns
  const match = url.match(/(?:registration|tickets)-(\d+)/);
  return match ? match[1] : null;
};

// Helper function to parse location from JSON-LD data
const parseLocation = (locationData) => {
  if (typeof locationData === 'string') {
    // Simple text location
    return {
      name: locationData,
      address: '',
      city: '',
      state: '',
      zip: ''
    };
  }
  
  if (locationData && locationData.address) {
    const address = locationData.address;
    return {
      name: locationData.name || '',
      address: address.streetAddress || '',
      city: address.addressLocality || '',
      state: address.addressRegion || '',
      zip: address.postalCode || '',
      latitude: locationData.geo?.latitude,
      longitude: locationData.geo?.longitude
    };
  }
  
  return {
    name: locationData?.name || '',
    address: '',
    city: '',
    state: '',
    zip: ''
  };
};

// Helper function to parse price data
const parsePrice = (offers) => {
  if (!offers || !Array.isArray(offers) || offers.length === 0) {
    return null;
  }
  
  const prices = offers
    .map(offer => parseFloat(offer.price))
    .filter(price => !isNaN(price));
    
  if (prices.length === 0) return null;
  
  return {
    low: Math.min(...prices),
    high: Math.max(...prices),
    currency: offers[0].priceCurrency || 'USD'
  };
};

// Helper function to create a hash for change detection
const createHash = (data) => {
  const hashString = JSON.stringify(data);
  return crypto.createHash('md5').update(hashString).digest('hex');
};

// Helper function to clean HTML content
const cleanHtml = (html) => {
  if (!html) return '';
  
  // Remove HTML tags but preserve line breaks
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

// Extract event schedule from HTML
const extractSchedule = (html) => {
  const scheduleMatch = html.match(/<div[^>]*class="[^"]*schedule[^"]*"[^>]*>(.*?)<\/div>/gsi);
  if (!scheduleMatch) return [];
  
  // This is a simplified extraction - would need refinement based on actual HTML structure
  return [];
};

// Extract event highlights (duration, format, etc.)
const extractHighlights = (html) => {
  const highlights = [];
  
  // Look for common patterns
  if (html.includes('2 days') || html.includes('two days')) {
    highlights.push('2 days');
  }
  if (html.includes('In person') || html.includes('in-person')) {
    highlights.push('In person');
  }
  if (html.includes('Virtual') || html.includes('virtual') || html.includes('online')) {
    highlights.push('Virtual');
  }
  
  return highlights;
};

// Extract additional images from event page
const extractImages = (html) => {
  const images = [];
  
  // Look for image URLs in various formats
  const imagePatterns = [
    /https:\/\/img\.evbuc\.com\/[^"'\s]+/g,
    /https:\/\/cdn\.evbuc\.com\/[^"'\s]+/g
  ];
  
  imagePatterns.forEach(pattern => {
    const matches = html.match(pattern);
    if (matches) {
      matches.forEach(url => {
        // Clean up URL and avoid duplicates
        const cleanUrl = url.replace(/[?&].*$/, '');
        if (!images.includes(cleanUrl)) {
          images.push(cleanUrl);
        }
      });
    }
  });
  
  return images;
};

// Extract refund policy
const extractRefundPolicy = (html) => {
  const policyMatch = html.match(/refund[^.]*policy[^.]*\./i);
  return policyMatch ? policyMatch[0] : '';
};

// Extract categories/tags
const extractCategories = (html) => {
  // This would need to be refined based on actual Eventbrite HTML structure
  return [];
};

// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Upload images to S3 instead of local storage
const downloadEventImages = async (event, details) => {
  try {
    const { uploadS3 } = await import('./s3-upload.js');
    
    console.log(`📸 Downloading images for event ${event.id}`);
    
    // Find working direct CDN URLs
    let mainImageUrl = null;
    let teacherImageUrl = null;
    
    // Priority 1: Use the main event image from organization page (already optimized to w=2000, h=1000)
    if (event.image && (event.image.includes('cdn.evbuc.com') || event.image.includes('img.evbuc.com'))) {
      if (event.image.includes('img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com')) {
        // Decode proxy URL
        mainImageUrl = decodeURIComponent(event.image.replace('https://img.evbuc.com/', ''));
      } else if (event.image.startsWith('https://cdn.evbuc.com')) {
        // Direct CDN URL
        mainImageUrl = event.image;
      } else {
        // Try the original URL as-is
        mainImageUrl = event.image;
      }
      console.log(`Using main event image: ${mainImageUrl}`);
    }
    
    // Priority 2: Look for teacher image in the images array (skip first if it matches main)
    if (details.images && details.images.length > 0) {
      // Decode all available images
      const decodedUrls = details.images
        .map(url => {
          if (url.includes('img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com')) {
            return decodeURIComponent(url.replace('https://img.evbuc.com/', ''));
          } else if (url.startsWith('https://cdn.evbuc.com')) {
            return url;
          }
          return null;
        })
        .filter(url => url);
      
      // Find a teacher image that's different from the main image
      for (const url of decodedUrls) {
        // Skip if this is the same as main image (check base URL without query params)
        const mainImageBase = mainImageUrl ? mainImageUrl.split('?')[0] : '';
        const urlBase = url.split('?')[0];
        
        if (urlBase !== mainImageBase) {
          teacherImageUrl = url;
          console.log(`Using teacher image: ${teacherImageUrl}`);
          break;
        }
      }
    }
    
    // Fallback: if no main image found, use first available image
    if (!mainImageUrl && details.images && details.images.length > 0) {
      const firstImage = details.images[0];
      if (firstImage.includes('img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com')) {
        mainImageUrl = decodeURIComponent(firstImage.replace('https://img.evbuc.com/', ''));
      } else if (firstImage.startsWith('https://cdn.evbuc.com')) {
        mainImageUrl = firstImage;
      }
      console.log(`Fallback main image: ${mainImageUrl}`);
    }
    
    let mainImageS3Url = null;
    let teacherImageS3Url = null;
    
    // Download and upload main image to S3
    if (mainImageUrl) {
      try {
        console.log(`📥 Downloading main image from: ${mainImageUrl}`);
        const response = await fetch(mainImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const base64Data = Buffer.from(buffer).toString('base64');
          const s3Key = `events/${event.id}-main.jpg`;
          
          mainImageS3Url = await uploadS3(base64Data, s3Key, 'image/jpeg');
          console.log(`✅ Uploaded main image to S3: ${mainImageS3Url} (${buffer.byteLength} bytes)`);
        } else {
          console.log(`⚠️ Failed to download main image: ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️ Error downloading/uploading main image: ${error.message}`);
      }
    }
    
    // Download and upload teacher image to S3
    if (teacherImageUrl) {
      try {
        console.log(`📥 Downloading teacher image from: ${teacherImageUrl}`);
        const response = await fetch(teacherImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const base64Data = Buffer.from(buffer).toString('base64');
          const s3Key = `events/${event.id}-teacher.jpg`;
          
          teacherImageS3Url = await uploadS3(base64Data, s3Key, 'image/jpeg');
          console.log(`✅ Uploaded teacher image to S3: ${teacherImageS3Url} (${buffer.byteLength} bytes)`);
        } else {
          console.log(`⚠️ Failed to download teacher image: ${response.status}`);
        }
      } catch (error) {
        console.log(`⚠️ Error downloading/uploading teacher image: ${error.message}`);
      }
    }
    
    return {
      mainImage: mainImageS3Url || null,
      teacherImage: teacherImageS3Url || null,
      downloadedMain: !!mainImageS3Url,
      downloadedTeacher: !!teacherImageS3Url
    };
  } catch (error) {
    console.error(`❌ Error processing images for event ${event.id}:`, error.message);
    return {
      mainImage: null,
      teacherImage: null,
      downloadedMain: false,
      downloadedTeacher: false
    };
  }
};

// Level 1: Scrape organization page for event list
export const scrapeEventList = async () => {
  console.log(`Fetching organization page: ${siteConfig.eventbrite_org_url}`);
  
  try {
    const response = await fetch(siteConfig.eventbrite_org_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract JSON-LD data
    const jsonLdMatch = html.match(/window\.__SERVER_DATA__\s*=\s*({.*?});/s);
    if (!jsonLdMatch) {
      console.error('Could not find __SERVER_DATA__ in HTML');
      return [];
    }
    
    let serverData;
    try {
      serverData = JSON.parse(jsonLdMatch[1]);
    } catch (error) {
      console.error('Failed to parse server data JSON:', error);
      return [];
    }
    
    // Navigate to the events data
    if (!serverData.jsonld || !Array.isArray(serverData.jsonld) || serverData.jsonld.length < 2) {
      console.error('Unexpected JSON-LD structure');
      return [];
    }
    
    const eventList = serverData.jsonld[1];
    if (!eventList.itemListElement || !Array.isArray(eventList.itemListElement)) {
      console.error('No itemListElement found in JSON-LD');
      return [];
    }
    
    // Parse events from JSON-LD
    const events = eventList.itemListElement.map(element => {
      const item = element.item;
      const eventId = extractEventId(item.url);
      
      // Try to get maximum dimensions to minimize cropping
      let largeImage = item.image || '';
      if (largeImage) {
        // Replace with much larger dimensions to get as much image as possible
        largeImage = largeImage.replace(/w=\d+/g, 'w=2000');
        largeImage = largeImage.replace(/h=\d+/g, 'h=1000');
      }
      
      return {
        id: eventId,
        url: item.url,
        name: item.name,
        shortDescription: item.description || '',
        startDate: item.startDate,
        endDate: item.endDate,
        image: largeImage,
        location: parseLocation(item.location),
        price: parsePrice(item.offers),
        organizer: item.organizer?.name || siteConfig.siteName || 'Unknown'
      };
    }).filter(event => event.id); // Only include events with valid IDs
    
    console.log(`Found ${events.length} events from organization page`);
    return events;
    
  } catch (error) {
    console.error('Error scraping event list:', error);
    return [];
  }
};

// Level 2: Scrape individual event page for full details
export const scrapeEventDetails = async (eventUrl) => {
  console.log(`Fetching event details: ${eventUrl}`);
  
  try {
    const response = await fetch(eventUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch event: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract full description
    const descMatch = html.match(/<div[^>]*class="[^"]*event-description__content[^"]*"[^>]*>(.*?)<\/div>/s);
    const fullDescription = descMatch ? cleanHtml(descMatch[1]) : '';
    
    // Extract other details
    const schedule = extractSchedule(html);
    const highlights = extractHighlights(html);
    const refundPolicy = extractRefundPolicy(html);
    const categories = extractCategories(html);
    const additionalImages = extractImages(html);
    
    return {
      fullDescription,
      eventSchedule: schedule,
      highlights,
      refundPolicy,
      categories,
      images: additionalImages,
      teacherImage: additionalImages[1] ? additionalImages[1].replace(/\?.*$/, '') + '?w=200&auto=format,compress&q=80' : null // Use second image as teacher image with larger size
    };
    
  } catch (error) {
    console.error('Error scraping event details:', error);
    return {
      fullDescription: '',
      eventSchedule: [],
      highlights: [],
      refundPolicy: '',
      categories: [],
      images: [],
      teacherImage: null
    };
  }
};

// Load existing events from filesystem
const loadExistingEvents = (eventsDir) => {
  const existingEvents = {};
  
  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
    return existingEvents;
  }
  
  const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.json'));
  
  for (const file of files) {
    try {
      const filePath = path.join(eventsDir, file);
      const eventData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      existingEvents[eventData.id] = eventData;
    } catch (error) {
      console.error(`Error loading existing event file ${file}:`, error);
    }
  }
  
  return existingEvents;
};

// Save event to filesystem
const saveEvent = (eventsDir, event, forceOverwrite = false) => {
  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
  }
  
  const filename = `event-${event.id}.json`;
  const filePath = path.join(eventsDir, filename);
  
  // Check if event exists and has been manually edited
  if (!forceOverwrite && fs.existsSync(filePath)) {
    try {
      const existingEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (existingEvent.manuallyEdited) {
        console.log(`⚠️  Skipping ${event.name} - manually edited (protected from auto-sync)`);
        return false; // Indicate that save was skipped
      }
    } catch (error) {
      console.error(`Error checking existing event ${event.id}:`, error);
    }
  }
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(event, null, 2));
    console.log(`✅ Saved event: ${event.name}`);
    return true; // Indicate successful save
  } catch (error) {
    console.error(`Error saving event ${event.id}:`, error);
    return false;
  }
};

// Remove event file
const removeEvent = (eventsDir, eventId) => {
  const filename = `event-${eventId}.json`;
  const filePath = path.join(eventsDir, filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Removed event: ${eventId}`);
    }
  } catch (error) {
    console.error(`Error removing event ${eventId}:`, error);
  }
};

// Smart update with change detection
export const updateEvents = async (forceRefresh = false) => {
  const eventsDir = path.join(process.cwd(), 'src/content/events');
  
  console.log('🔄 Starting Eventbrite event update...');
  
  try {
    // Step 1: Get current event list from org page
    const currentEvents = await scrapeEventList();
    if (currentEvents.length === 0) {
      console.log('⚠️ No events found on organization page');
      return false;
    }
    
    // Step 2: Load existing events for comparison
    const existingEvents = loadExistingEvents(eventsDir);
    
    let hasChanges = false;
    
    // Step 3: Process each current event
    for (const event of currentEvents) {
      const existing = existingEvents[event.id];
      
      // Create a hash of basic info for change detection
      const currentHash = createHash({
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        shortDescription: event.shortDescription,
        price: event.price,
        image: event.image // Include primary image URL to detect image changes
      });
      
      // Check if event is new, changed, or force refresh is requested
      if (forceRefresh || !existing || existing.lastModified !== currentHash) {
        // Skip manually edited events unless force refresh is requested
        if (!forceRefresh && existing && existing.manuallyEdited) {
          console.log(`📌 Skipping manually edited event ${event.id} (${event.name}) - protected from auto-sync`);
          // Update just the org page scrape date to show it was checked
          existing.scraped.orgPageDate = new Date().toISOString();
          saveEvent(eventsDir, existing);
          continue;
        }
        
        console.log(`📝 Event ${event.id} (${event.name}) changed or is new - scraping details...`);
        
        // Scrape full details from event page
        const details = await scrapeEventDetails(event.url);
        
        // Download working CDN images directly
        const downloadResult = await downloadEventImages(event, details);
        const localMainImage = downloadResult.mainImage;
        const localTeacherImage = downloadResult.teacherImage;
        
        // Combine basic + detailed info with generic structure
        const fullEvent = {
          ...event,
          ...details,
          // Generic event system fields
          source: 'external',
          externalId: event.id,
          registrationUrl: event.url,
          visible: true,
          featured: false,
          
          // Images (now S3 URLs)
          mainImage: localMainImage,
          teacherImage: localTeacherImage,
          
          // Legacy compatibility
          image: localMainImage,
          originalImage: event.image, // Keep original URL for reference
          
          // Metadata
          lastModified: currentHash,
          lastSynced: new Date().toISOString(),
          scraped: {
            orgPageDate: new Date().toISOString(),
            detailPageDate: new Date().toISOString()
          }
        };
        
        // Save event
        saveEvent(eventsDir, fullEvent);
        hasChanges = true;
        
        // Rate limiting - wait 2 seconds between detailed scrapes
        await sleep(2000);
      } else {
        console.log(`✅ Event ${event.id} (${event.name}) unchanged - skipping detail scrape`);
        
        // Update just the org page scrape date
        existing.scraped.orgPageDate = new Date().toISOString();
        saveEvent(eventsDir, existing);
      }
    }
    
    // Step 4: ULTRA-CONSERVATIVE: Never automatically delete events, just log warnings
    // This preserves all events regardless of source and lets admins manually review
    const currentIds = currentEvents.map(e => e.id);
    for (const existingId in existingEvents) {
      const existingEvent = existingEvents[existingId];
      
      // Just log status for different types of events
      if (existingEvent.source === 'manual' || existingId.startsWith('manual-')) {
        console.log(`📌 Manual event ${existingId} preserved`);
      } else if (existingEvent.manuallyEdited) {
        console.log(`📌 Manually edited event ${existingId} (${existingEvent.name}) preserved`);
      } else if (!currentIds.includes(existingId)) {
        // Don't delete - just warn that it's not on the current org page
        console.log(`⚠️  Event ${existingId} (${existingEvent.name}) not found on org page but preserved - review manually if needed`);
      }
    }
    
    // Note: Automatic deletion has been disabled to prevent accidental data loss
    // Events can only be deleted manually through the admin interface
    
    if (hasChanges) {
      console.log('✅ Eventbrite events updated successfully');
    } else {
      console.log('✅ No changes detected in Eventbrite events');
    }
    
    return hasChanges;
    
  } catch (error) {
    console.error('❌ Error updating Eventbrite events:', error);
    return false;
  }
};

// Refresh a single event from Eventbrite (force override manual edit protection)
const refreshSingleEvent = async (eventId) => {
  try {
    console.log(`🔄 Force refreshing event ${eventId} from Eventbrite...`);
    
    const eventsDir = path.join(process.cwd(), 'src/content/events');
    const filename = `event-${eventId}.json`;
    const filePath = path.join(eventsDir, filename);

    // Check if event exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Event ${eventId} not found`);
      return false;
    }

    // Read existing event to get URL
    const existingEvent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let eventbriteUrl = existingEvent.url || existingEvent.registrationUrl;

    if (!eventbriteUrl || !eventbriteUrl.includes('eventbrite.com')) {
      console.error(`❌ Event ${eventId} is not an Eventbrite event`);
      return false;
    }

    // Scrape fresh data from Eventbrite
    console.log(`📥 Scraping fresh data for event ${eventId}...`);
    const eventDetails = await scrapeEventDetails(eventbriteUrl);

    if (!eventDetails) {
      console.error(`❌ Failed to scrape event details for ${eventId}`);
      return false;
    }

    // Merge existing event with fresh details (preserve id, name, url, dates, etc.)
    const refreshedEvent = {
      ...existingEvent,
      ...eventDetails,
      // Preserve key fields from existing event
      id: existingEvent.id,
      name: existingEvent.name,
      url: existingEvent.url,
      startDate: existingEvent.startDate,
      endDate: existingEvent.endDate,
      location: existingEvent.location,
      organizer: existingEvent.organizer,
      // Update metadata
      lastSynced: new Date().toISOString(),
      manuallyEdited: false, // Clear the manual edit flag since we're refreshing
      scraped: {
        ...existingEvent.scraped,
        detailPageDate: new Date().toISOString()
      }
    };

    // Force save (override manual edit protection)
    const saved = saveEvent(eventsDir, refreshedEvent, true);

    if (saved) {
      console.log(`✅ Successfully refreshed event ${eventId} from Eventbrite`);
      return true;
    } else {
      console.error(`❌ Failed to save refreshed event ${eventId}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error refreshing single event ${eventId}:`, error);
    return false;
  }
};

export default {
  updateEvents,
  scrapeEventList,
  scrapeEventDetails,
  refreshSingleEvent
};