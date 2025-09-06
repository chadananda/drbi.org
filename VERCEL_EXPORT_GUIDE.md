# Vercel Analytics CSV Export Guide

Since the automated Puppeteer script is having compatibility issues with the older version installed, here's a simple manual process to export your Vercel Analytics data:

## Manual Export Process

### 1. Login to Vercel
- Go to [vercel.com/login](https://vercel.com/login)
- Login with `info@drbi.org`

### 2. Navigate to Analytics
- Go to your project dashboard
- Click on the "Analytics" tab
- Or directly visit: `https://vercel.com/drbi-org/analytics`

### 3. Export CSV Data

For each panel, click the three dots (⋯) menu and select "Export as CSV":

**Required exports:**
1. **Top Pages** → Save as `vercel-pages.csv`
2. **Referrers** → Save as `vercel-referrers.csv` 
3. **Countries** → Save as `vercel-countries.csv`
4. **Page Views** (time series) → Save as `vercel-pageviews.csv`
5. **Visitors** (time series) → Save as `vercel-visitors.csv`

### 4. Place CSV Files
Move all downloaded CSV files to:
```
src/data/vercel-exports/
```

### 5. Process the Data
Run the import script with CSV processing:
```bash
node scripts/import-vercel-analytics.js --use-csv
```

### 6. Update Analytics Summary
Generate the summary for fast loading:
```bash
node -e "import('./src/utils/analytics-cache.js').then(m => m.generateStaticAnalyticsSummary())"
```

## What Each Export Contains

- **Pages**: URL paths with page views and unique visitors
- **Referrers**: Traffic sources (Google, Facebook, direct, etc.)
- **Countries**: Geographic breakdown of visitors
- **Page Views**: Daily page view counts over time
- **Visitors**: Daily unique visitor counts over time

## Expected Result

After processing, you'll have:
- Real historical data from Vercel Analytics (not sample data)
- Combined with live PostHog data for recent activity
- Geographic heat maps showing actual traffic patterns
- Proper trend data for smooth migration

The CSV processing script will automatically:
- Parse your real CSV files
- Convert to the analytics import format
- Generate proper geographic data for the world map
- Create daily statistics for trend charts
- Combine everything into a comprehensive dataset

Ready when you are!