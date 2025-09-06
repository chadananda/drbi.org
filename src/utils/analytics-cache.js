/**
 * Analytics cache utilities for efficient data loading
 */

let cachedAnalyticsData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load imported analytics with caching
 */
export async function getCachedImportedAnalytics() {
  // Check if cache is still valid
  if (cachedAnalyticsData && cacheTimestamp && 
      (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return cachedAnalyticsData;
  }

  // Load fresh data
  const { loadImportedAnalytics } = await import('./analytics-utils.js');
  cachedAnalyticsData = await loadImportedAnalytics();
  cacheTimestamp = Date.now();
  
  return cachedAnalyticsData;
}

/**
 * Clear the analytics cache (call after new imports)
 */
export function clearAnalyticsCache() {
  cachedAnalyticsData = null;
  cacheTimestamp = null;
}

/**
 * Generate a pre-computed analytics summary for static deployment
 */
export async function generateStaticAnalyticsSummary() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const { loadImportedAnalytics } = await import('./analytics-utils.js');
    const analyticsData = await loadImportedAnalytics();
    
    if (!analyticsData) {
      console.log('No imported analytics data found');
      return null;
    }

    // Create a lightweight summary for fast loading
    const summary = {
      totalPageViews: analyticsData.totalPageViews,
      totalUniqueVisitors: analyticsData.totalUniqueVisitors,
      dateRange: analyticsData.dateRange,
      topPages: analyticsData.topPages.slice(0, 10), // Top 10 only
      referrers: analyticsData.referrers.slice(0, 10), // Top 10 only
      dailyStats: analyticsData.dailyStats ? 
        analyticsData.dailyStats.map(day => ({
          date: day.date,
          pageViews: day.pageViews,
          uniqueVisitors: day.uniqueVisitors
        })) : [],
      pageViews: analyticsData.pageViews || [],
      uniqueVisitors: analyticsData.uniqueVisitors || [],
      sources: analyticsData.sources || [],
      isImported: true,
      isHybrid: true,
      dataSource: 'imported',
      generatedAt: new Date().toISOString()
    };

    // Write to a static file
    const summaryPath = path.join(process.cwd(), 'src/data/analytics-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`✅ Generated analytics summary: ${summaryPath}`);
    console.log(`📊 Summary: ${summary.totalPageViews} page views, ${summary.totalUniqueVisitors} visitors`);
    
    return summary;
    
  } catch (error) {
    console.error('Error generating analytics summary:', error);
    return null;
  }
}

/**
 * Load pre-computed analytics summary (fast)
 */
export async function loadAnalyticsSummary() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const summaryPath = path.join(process.cwd(), 'src/data/analytics-summary.json');
    
    try {
      const content = await fs.readFile(summaryPath, 'utf8');
      const summary = JSON.parse(content);
      
      // Check if summary is stale (older than 24 hours)
      const generatedAt = new Date(summary.generatedAt);
      const isStale = (Date.now() - generatedAt.getTime()) > (24 * 60 * 60 * 1000);
      
      if (isStale) {
        console.log('Analytics summary is stale, will regenerate');
      }
      
      return { ...summary, isStale };
      
    } catch (readError) {
      // Summary file doesn't exist
      return null;
    }
    
  } catch (error) {
    console.error('Error loading analytics summary:', error);
    return null;
  }
}