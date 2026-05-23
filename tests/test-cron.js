// test-cron.js - Manually trigger eventbrite scraper for testing
import { updateEvents } from './src/utils/eventbrite-scraper.js';

async function testCron() {
  console.log('🧪 Testing Eventbrite scraper manually...\n');
  
  try {
    const hasChanges = await updateEvents();
    console.log(`\n✅ Scraper test completed! Changes detected: ${hasChanges}`);
    
    if (hasChanges) {
      console.log('📝 Events were updated - check src/content/events/ directory');
    }
  } catch (error) {
    console.error('❌ Scraper test failed:', error);
  }
}

testCron();