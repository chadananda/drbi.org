# Analytics Migration System

This system provides a seamless migration from Vercel Analytics to PostHog with historical data preservation.

## 🎯 Overview

**Problem**: Migrating from Vercel Analytics to PostHog means losing historical data and analytics visibility during transition.

**Solution**: CSV import system that combines historical Vercel data with live PostHog data for seamless analytics continuity.

## 🏗️ Architecture

### Development Mode
- Always shows demo data
- No API calls to prevent test data pollution
- Fast development experience

### Production Mode
- **Phase 1**: Imported Vercel data only (immediate after migration)
- **Phase 2**: Hybrid data (imported Vercel + live PostHog) 
- **Phase 3**: Pure PostHog data (after sufficient accumulation)

### Performance Optimization
- **Raw imports**: Stored in `src/data/analytics-imports/` (gitignored)
- **Processed summary**: `src/data/analytics-summary.json` (committed to git)
- **Build-time processing**: Data parsed once during deployment
- **Runtime caching**: 5-minute cache for dashboard requests

## 📊 Migration Workflow

### Step 1: Export from Vercel
1. Go to your Vercel project dashboard
2. Navigate to Analytics section
3. Export CSV data
4. Download the file

### Step 2: Import to DRBI
1. Visit `/admin/analytics/import`
2. Upload your CSV file
3. System automatically processes and caches data
4. Analytics appear immediately in dashboard

### Step 3: Configure PostHog (Optional)
1. Set `POSTHOG_API_KEY` environment variable
2. System will automatically combine data sources
3. Gradual transition as PostHog accumulates data

### Step 4: Production Deployment
1. Build script runs automatically: `npm run build:analytics`
2. Generates optimized summary for fast loading
3. Only summary file is deployed (not raw imports)

## 🔧 Technical Implementation

### File Structure
```
src/
├── data/
│   ├── analytics-imports/     # Raw CSV imports (gitignored)
│   └── analytics-summary.json # Processed summary (committed)
├── pages/
│   └── admin/
│       └── analytics/
│           └── import.astro   # Upload interface
├── utils/
│   ├── analytics-utils.js     # Data processing
│   └── analytics-cache.js     # Caching & optimization
└── scripts/
    └── build-analytics.js     # Build-time processing
```

### Data Flow
```
CSV Upload → Parse & Validate → Store Raw Data → Generate Summary → Cache → Display
     ↓              ↓               ↓             ↓           ↓        ↓
  Validation   Field Mapping   File Storage   Optimization  Cache   Dashboard
```

### CSV Format Support
The system handles various CSV formats with intelligent column detection:

**Standard Format:**
```csv
date,page,views,visitors,referrer,country
2024-01-01,/,125,89,direct,US
```

**Alternative Formats:**
- Different column names: `pageviews`, `unique_visitors`, `source`
- Various date formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `DD-MM-YYYY`
- Optional fields: `country`, `device`, `browser`

## 🚀 Scripts & Commands

### Development
```bash
npm run dev                    # Start dev server (demo data)
```

### Build & Deploy
```bash
npm run build:analytics       # Generate analytics summary
npm run build                 # Full build (includes analytics)
```

### Testing
```bash
# Test with sample data
curl -X POST http://localhost:4321/admin/analytics/import \
  -F "csvFile=@sample-vercel-data.csv" \
  -F "dataSource=vercel" \
  -F "dateRange=January 2024"
```

## 📈 Dashboard Features

### Visual Indicators
- 🟡 **Demo Data - Development**: Local development
- 🟢 **Live Data**: Pure PostHog 
- 🟣 **Imported Data - Vercel**: CSV imports only
- 🟣 **Hybrid Data - Imported + Live**: Combined sources

### Data Source Panel
Shows details about imported data:
- Source platform (Vercel, etc.)
- Record count and date range
- Upload timestamp
- Combined vs single source indicators

### Analytics Charts
- 30-day traffic overview
- Top 20 pages with visitor counts
- Top 20 referrer sources
- Daily page views and unique visitors

## 🔒 Security

### Authentication
- Admin, Editor, or Superadmin role required
- Session-based authentication via Lucia
- CSRF protection via origin verification

### File Validation
- CSV files only (10MB limit)
- Secure upload handling
- Input sanitization and validation

### Data Privacy
- Raw imports stored locally (not committed)
- Only processed summaries in version control
- No sensitive user data in analytics

## 🐛 Troubleshooting

### Common Issues

**"No data showing"**
- Check if `analytics-summary.json` exists
- Verify build script ran successfully
- Check browser console for errors

**"Import failed"**  
- Verify CSV format and encoding
- Check file size (must be < 10MB)
- Ensure proper authentication

**"Analytics not updating"**
- Clear cache: restart server in development
- Check summary file timestamp
- Verify build script execution

### Debug Commands
```bash
# Check summary file
cat src/data/analytics-summary.json

# Rebuild analytics
npm run build:analytics

# Test API endpoints
curl http://localhost:4321/api/analytics/status
```

## 🔄 Migration Timeline

### Week 1: Setup & Import
- Export historical Vercel data
- Import via admin interface
- Verify analytics display

### Week 2-4: Hybrid Mode
- Configure PostHog API key
- Monitor combined data sources
- Validate data accuracy

### Month 2+: PostHog Native
- Sufficient PostHog data accumulated
- Can disable Vercel imports
- Pure PostHog analytics

## 📝 Notes

- **Build Performance**: Analytics processing adds ~2-5 seconds to build time
- **Storage**: Raw imports can be large but are gitignored
- **Caching**: 5-minute cache balances performance with freshness
- **Compatibility**: Works with any analytics platform that exports CSV
- **Scalability**: Handles files up to 10MB (~100k+ records)

---

*This system ensures zero analytics downtime during your migration from Vercel to PostHog!*