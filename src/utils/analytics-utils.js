/**
 * Analytics utilities for combining imported and live data
 */

/**
 * Normalize a page URL to a consistent path format
 * Converts "https://drbi.org/events" -> "/events"
 * Converts "/" -> "/"
 * Strips trailing slashes and query strings
 */
function normalizePageUrl(url) {
  if (!url) return '/';

  let path = url;

  // Remove protocol and domain
  try {
    const urlObj = new URL(url, 'https://drbi.org');
    path = urlObj.pathname;
  } catch {
    // If not a valid URL, treat as path
    path = url;
  }

  // Remove trailing slash (except for root)
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Ensure leading slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return path;
}

/**
 * Normalize a referrer to a consistent domain format
 * Converts "https://www.google.com/search?q=..." -> "google.com"
 * Converts "google.com" -> "google.com"
 * Handles special cases like $direct, com.google.android.gm
 */
function normalizeReferrer(referrer) {
  if (!referrer) return 'direct';

  // Handle direct traffic markers (including $direct from imported data)
  if (referrer === '$direct' || referrer === 'direct' || referrer === '') {
    return '$direct';
  }

  // Handle Android app referrers (e.g., com.google.android.gm -> google.com)
  if (referrer.startsWith('com.google.')) {
    return 'google.com';
  }
  if (referrer.startsWith('com.') || referrer.startsWith('org.')) {
    // Generic app referrer - extract middle part
    const parts = referrer.split('.');
    if (parts.length >= 2) {
      return parts[1] + '.com';
    }
  }

  let domain = referrer;

  // Extract domain from full URL
  try {
    const urlObj = new URL(referrer.startsWith('http') ? referrer : 'https://' + referrer);
    domain = urlObj.hostname;
  } catch {
    // If not a valid URL, use as-is
    domain = referrer;
  }

  // Remove www. prefix
  if (domain.startsWith('www.')) {
    domain = domain.slice(4);
  }

  return domain;
}

/**
 * Get a display label for a referrer domain
 */
function getReferrerLabel(domain) {
  const labels = {
    '$direct': 'Direct Traffic',
    'google.com': 'Google Search',
    'bing.com': 'Bing Search',
    'yahoo.com': 'Yahoo Search',
    'search.yahoo.com': 'Yahoo Search',
    'duckduckgo.com': 'DuckDuckGo',
    'facebook.com': 'Facebook',
    'twitter.com': 'Twitter',
    'x.com': 'X (Twitter)',
    'linkedin.com': 'LinkedIn',
    'instagram.com': 'Instagram',
    'youtube.com': 'YouTube',
    'pinterest.com': 'Pinterest',
    'reddit.com': 'Reddit',
    'tiktok.com': 'TikTok',
    'ecosia.org': 'Ecosia',
  };

  return labels[domain] || domain;
}

/**
 * Get a display label for a page path
 */
function getPageLabel(path) {
  if (path === '/') return 'Home Page';

  // Convert path to title case
  const name = path
    .replace(/^\//, '')
    .replace(/-/g, ' ')
    .replace(/\//g, ' > ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return name;
}

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
 * Combine top pages from different sources with URL normalization
 */
function combineTopPages(imported, live) {
  const combined = new Map();

  // Add imported data with normalized paths
  if (Array.isArray(imported)) {
    for (const page of imported) {
      if (!page || !page.breakdown_value) continue;
      const normalizedPath = normalizePageUrl(page.breakdown_value);
      const existing = combined.get(normalizedPath);
      if (existing) {
        existing.count += page.count || 0;
        existing.visitors += (page.visitors || 0);
      } else {
        combined.set(normalizedPath, {
          breakdown_value: normalizedPath,
          count: page.count || 0,
          visitors: page.visitors || 0,
          label: page.label || getPageLabel(normalizedPath)
        });
      }
    }
  }

  // Add live data with normalized paths
  if (Array.isArray(live)) {
    for (const page of live) {
      if (!page || !page.breakdown_value) continue;
      const normalizedPath = normalizePageUrl(page.breakdown_value);
      const existing = combined.get(normalizedPath);
      if (existing) {
        existing.count += page.count || 0;
        existing.visitors += (page.visitors || 0);
      } else {
        combined.set(normalizedPath, {
          breakdown_value: normalizedPath,
          count: page.count || 0,
          visitors: page.visitors || 0,
          label: page.label || getPageLabel(normalizedPath)
        });
      }
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

/**
 * Combine referrers from different sources with domain normalization
 */
function combineReferrers(imported, live) {
  const combined = new Map();

  // Add imported data with normalized domains
  if (Array.isArray(imported)) {
    for (const referrer of imported) {
      if (!referrer || !referrer.breakdown_value) continue;
      const normalizedDomain = normalizeReferrer(referrer.breakdown_value);
      const existing = combined.get(normalizedDomain);
      if (existing) {
        existing.count += referrer.count || 0;
      } else {
        combined.set(normalizedDomain, {
          breakdown_value: normalizedDomain,
          count: referrer.count || 0,
          label: getReferrerLabel(normalizedDomain)
        });
      }
    }
  }

  // Add live data with normalized domains
  if (Array.isArray(live)) {
    for (const referrer of live) {
      if (!referrer || !referrer.breakdown_value) continue;
      const normalizedDomain = normalizeReferrer(referrer.breakdown_value);
      const existing = combined.get(normalizedDomain);
      if (existing) {
        existing.count += referrer.count || 0;
      } else {
        combined.set(normalizedDomain, {
          breakdown_value: normalizedDomain,
          count: referrer.count || 0,
          label: getReferrerLabel(normalizedDomain)
        });
      }
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

