# 🎪 Eventbrite Events System - Testing Guide

## 🚀 Quick Test Commands

```bash
# Test just the scraper (no cron throttling)
npm run test:scraper

# Test the full cron system (clears throttle first)
npm run test:cron
```

## 🔄 How It Works

### Automatic Execution
- **Triggers**: Every page load on home, articles, news pages
- **Throttling**: Max once every 5 minutes
- **Smart Detection**: Only re-scrapes when event data actually changes

### Environment Behavior
- **🏠 Localhost**: Updates local files only (no GitHub commits)
- **🚀 Production**: Updates files AND auto-commits to GitHub

## 🧪 Testing the System

### 1. Test Individual Scraper
```bash
npm run test:scraper
```
- Tests Eventbrite scraping directly
- Shows what events are found
- No throttling, runs immediately

### 2. Test Full Cron System  
```bash
npm run test:cron
```
- Clears the 5-minute throttle
- Calls the actual API endpoint
- Shows full development vs production behavior

### 3. Test via Browser
1. Start dev server: `npm run dev`
2. Visit: http://localhost:4322
3. Check dev server logs for cron execution
4. Look for: "poorMansCron: Running scheduled tasks..."

## 📁 File Locations

- **Events Data**: `src/content/events/event-*.json`
- **Component**: `src/components/EventbriteCalendar.astro` 
- **Scraper**: `src/utils/eventbrite-scraper.js`
- **Cron Logic**: `src/utils/utils.js` (crontasks function)
- **API Endpoint**: `src/pages/api/crontasks.js`

## 🔍 What to Look For

### Successful Scraping Logs:
```
🔄 Starting Eventbrite event update...
Found 3 events from organization page
✅ Event 123 (Event Name) unchanged - skipping detail scrape
✅ No changes detected in Eventbrite events
```

### Development vs Production:
```
Environment: Development (localhost)
🏠 Development mode: Events updated locally only (no GitHub commit)

Environment: Production  
🚀 Production mode: Events changed - committing to GitHub...
```

### Event Data Structure:
```json
{
  "id": "915030429647",
  "name": "Event Title",
  "startDate": "2024-12-27T18:00:00-0800",
  "location": { "city": "Eloy", "state": "AZ" },
  "price": null,
  "lastModified": "hash123",
  "scraped": {
    "orgPageDate": "2025-08-30T22:43:26.481Z",
    "detailPageDate": "2025-08-30T22:33:15.554Z"
  }
}
```

## 🐛 Troubleshooting

### No Events Showing?
1. Check `src/content/events/` directory has JSON files
2. Verify dev server restarted after schema changes
3. Check console for validation errors

### Cron Not Running?
1. Verify layout includes: `<script type="module" src="/api/crontasks" client:idle></script>`
2. Check 5-minute throttle: Look for "Skipping (Xs remaining)"
3. Force run: `npm run test:cron`

### Events Not Updating?
1. Check source URL in `src/data/site.json`
2. Test scraper: `npm run test:scraper`  
3. Look for "lastModified" hash changes

## 📈 Monitoring

Watch dev server logs for:
- ✅ Successful scrapes
- 🔄 Change detection
- 🏠/🚀 Environment mode
- ⏱️ Throttling status