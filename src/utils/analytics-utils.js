/**
 * Analytics utilities for combining imported and live data
 */

/**
 * Load all imported analytics data
 */
export async function loadImportedAnalytics() {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const importsDir = path.join(process.cwd(), 'src/data/analytics-imports');
    
    try {
      await fs.access(importsDir);
    } catch {
      // No imports directory exists
      return null;
    }

    const files = await fs.readdir(importsDir);
    const importFiles = files.filter(f => f.startsWith('import-') && f.endsWith('.json'));
    
    if (importFiles.length === 0) {
      return null;
    }

    // Load and combine all import data
    const allImports = [];
    for (const filename of importFiles) {
      try {
        const filePath = path.join(importsDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const importData = JSON.parse(content);
        allImports.push(importData);
      } catch (error) {
        console.warn(`Error loading import file ${filename}:`, error);
      }
    }

    if (allImports.length === 0) {
      return null;
    }

    // Combine all imported data
    return combineImportedData(allImports);

  } catch (error) {
    console.error('Error loading imported analytics:', error);
    return null;
  }
}

/**
 * Combine multiple imported analytics datasets
 */
function combineImportedData(imports) {
  const combined = {
    pageViews: [],
    topPages: new Map(),
    referrers: new Map(),
    uniqueVisitors: [],
    dailyStats: new Map(),
    totalPageViews: 0,
    totalUniqueVisitors: 0,
    dateRange: { start: null, end: null },
    sources: [],
    isImported: true
  };

  let earliestDate = null;
  let latestDate = null;

  // Process each import
  for (const importData of imports) {
    const summary = importData.data.summary;
    const metadata = importData.metadata;

    // Track sources
    combined.sources.push({
      source: metadata.source,
      fileName: metadata.fileName,
      dateRange: metadata.dateRange,
      recordCount: metadata.recordCount,
      uploadedAt: metadata.uploadedAt
    });

    // Combine top pages
    if (summary.topPages) {
      for (const page of summary.topPages) {
        const existing = combined.topPages.get(page.breakdown_value);
        if (existing) {
          existing.count += page.count;
          existing.visitors = (existing.visitors || 0) + (page.visitors || 0);
        } else {
          combined.topPages.set(page.breakdown_value, {
            breakdown_value: page.breakdown_value,
            count: page.count,
            visitors: page.visitors || 0,
            label: page.label
          });
        }
      }
    }

    // Combine referrers
    if (summary.referrers) {
      for (const referrer of summary.referrers) {
        const existing = combined.referrers.get(referrer.breakdown_value);
        if (existing) {
          existing.count += referrer.count;
        } else {
          combined.referrers.set(referrer.breakdown_value, {
            breakdown_value: referrer.breakdown_value,
            count: referrer.count,
            label: referrer.label
          });
        }
      }
    }

    // Combine daily stats
    if (summary.dailyStats) {
      for (const day of summary.dailyStats) {
        const existing = combined.dailyStats.get(day.date);
        if (existing) {
          existing.pageViews += day.pageViews;
          existing.uniqueVisitors += day.uniqueVisitors;
        } else {
          combined.dailyStats.set(day.date, {
            date: day.date,
            pageViews: day.pageViews,
            uniqueVisitors: day.uniqueVisitors
          });
        }
      }
    }

    // Track totals
    combined.totalPageViews += summary.totalPageViews || 0;
    combined.totalUniqueVisitors += summary.totalUniqueVisitors || 0;

    // Track date range
    if (summary.dateRange.start) {
      const startDate = new Date(summary.dateRange.start);
      if (!earliestDate || startDate < earliestDate) {
        earliestDate = startDate;
      }
    }

    if (summary.dateRange.end) {
      const endDate = new Date(summary.dateRange.end);
      if (!latestDate || endDate > latestDate) {
        latestDate = endDate;
      }
    }
  }

  // Convert maps to arrays and sort
  combined.topPages = Array.from(combined.topPages.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  combined.referrers = Array.from(combined.referrers.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Create arrays for chart data
  const sortedDailyStats = Array.from(combined.dailyStats.values())
    .sort((a, b) => a.date.localeCompare(b.date));

  combined.pageViews = sortedDailyStats.map(day => day.pageViews);
  combined.uniqueVisitors = sortedDailyStats.map(day => day.uniqueVisitors);

  // Set date range
  combined.dateRange = {
    startDate: earliestDate ? earliestDate.toISOString().split('T')[0] : null,
    endDate: latestDate ? latestDate.toISOString().split('T')[0] : null
  };

  return combined;
}

/**
 * Combine imported data with live PostHog data
 */
export function combineAnalyticsData(importedData, posthogData) {
  // If no imported data, return PostHog data as-is
  if (!importedData) {
    return posthogData;
  }

  // If no PostHog data, return imported data as-is
  if (!posthogData || posthogData.isDemo) {
    return {
      ...importedData,
      isHybrid: true,
      dataSource: 'imported'
    };
  }

  // Combine both datasets
  return {
    pageViews: [...importedData.pageViews, ...posthogData.pageViews],
    topPages: combineTopPages(importedData.topPages, posthogData.topPages),
    referrers: combineReferrers(importedData.referrers, posthogData.referrers),
    uniqueVisitors: [...importedData.uniqueVisitors, ...posthogData.uniqueVisitors],
    dateRange: {
      startDate: getEarlierDate(importedData.dateRange.startDate, posthogData.dateRange.startDate),
      endDate: getLaterDate(importedData.dateRange.endDate, posthogData.dateRange.endDate)
    },
    totalPageViews: importedData.totalPageViews + posthogData.totalPageViews,
    totalUniqueVisitors: importedData.totalUniqueVisitors + posthogData.totalUniqueVisitors,
    isHybrid: true,
    dataSource: 'combined',
    sources: importedData.sources,
    isDemo: false
  };
}

/**
 * Combine top pages from different sources
 */
function combineTopPages(imported, live) {
  const combined = new Map();

  // Add imported data
  for (const page of imported) {
    combined.set(page.breakdown_value, {
      breakdown_value: page.breakdown_value,
      count: page.count,
      visitors: page.visitors || 0,
      label: page.label
    });
  }

  // Add live data
  for (const page of live) {
    const existing = combined.get(page.breakdown_value);
    if (existing) {
      existing.count += page.count;
      existing.visitors += (page.visitors || 0);
    } else {
      combined.set(page.breakdown_value, {
        breakdown_value: page.breakdown_value,
        count: page.count,
        visitors: page.visitors || 0,
        label: page.label
      });
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Combine referrers from different sources
 */
function combineReferrers(imported, live) {
  const combined = new Map();

  // Add imported data
  for (const referrer of imported) {
    combined.set(referrer.breakdown_value, {
      breakdown_value: referrer.breakdown_value,
      count: referrer.count,
      label: referrer.label
    });
  }

  // Add live data
  for (const referrer of live) {
    const existing = combined.get(referrer.breakdown_value);
    if (existing) {
      existing.count += referrer.count;
    } else {
      combined.set(referrer.breakdown_value, {
        breakdown_value: referrer.breakdown_value,
        count: referrer.count,
        label: referrer.label
      });
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Get the earlier of two dates
 */
function getEarlierDate(date1, date2) {
  if (!date1) return date2;
  if (!date2) return date1;
  return date1 < date2 ? date1 : date2;
}

/**
 * Get the later of two dates
 */
function getLaterDate(date1, date2) {
  if (!date1) return date2;
  if (!date2) return date1;
  return date1 > date2 ? date1 : date2;
}