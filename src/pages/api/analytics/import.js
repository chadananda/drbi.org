export const prerender = false;

import { lucia } from "../../../lib/auth";

export const POST = async ({ request, cookies }) => {
  try {
    // Get form data
    const formData = await request.formData();
    const csvFile = formData.get('csvFile');
    const dataSource = formData.get('dataSource');
    const dateRange = formData.get('dateRange');
    
    // Get session from cookies
    const sessionid = cookies.get(lucia.sessionCookieName)?.value ?? null;

    // Authentication check
    if (!sessionid) {
      return redirectWithError('Authentication required');
    }
    
    const { user } = await lucia.validateSession(sessionid);
    if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
      return redirectWithError('Unauthorized access');
    }

    // Validate file upload
    if (!csvFile || csvFile.size === 0) {
      return redirectWithError('Please select a CSV file to upload');
    }

    // Validate file type
    if (!csvFile.name.toLowerCase().endsWith('.csv') && csvFile.type !== 'text/csv') {
      return redirectWithError('Please upload a CSV file');
    }

    // Check file size (limit to 10MB)
    if (csvFile.size > 10 * 1024 * 1024) {
      return redirectWithError('File size must be less than 10MB');
    }

    // Read and parse CSV content
    const csvContent = await csvFile.text();
    const parsedData = await parseVercelCSV(csvContent, dataSource, dateRange);

    if (!parsedData.success) {
      return redirectWithError(parsedData.error);
    }

    // Store the imported data
    await storeImportedData(parsedData.data, {
      source: dataSource,
      dateRange: dateRange,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
      fileName: csvFile.name,
      recordCount: parsedData.data.records.length
    });

    // Generate static summary for fast loading
    try {
      const { generateStaticAnalyticsSummary, clearAnalyticsCache } = await import('../../../utils/analytics-cache.js');
      clearAnalyticsCache(); // Clear any existing cache
      await generateStaticAnalyticsSummary();
      console.log('📊 Analytics summary generated successfully');
    } catch (summaryError) {
      console.warn('Failed to generate analytics summary:', summaryError);
      // Don't fail the import if summary generation fails
    }

    // Redirect with success
    const successMessage = `Successfully imported ${parsedData.data.records.length} records from ${csvFile.name}`;
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/admin/analytics/import?result=success&message=${encodeURIComponent(successMessage)}`
      }
    });

  } catch (error) {
    console.error('Analytics import error:', error);
    return redirectWithError(`Import failed: ${error.message}`);
  }
};

// Helper function to redirect with error
function redirectWithError(errorMessage) {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `/admin/analytics/import?error=${encodeURIComponent(errorMessage)}`
    }
  });
}

// Parse Vercel CSV data
async function parseVercelCSV(csvContent, dataSource, dateRangeDescription) {
  try {
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { success: false, error: 'CSV file is empty' };
    }

    // Parse header row
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Expected Vercel CSV columns (may vary)
    const expectedColumns = ['date', 'page', 'visitors', 'views', 'referrer', 'country'];
    
    console.log('CSV Headers detected:', headers);
    console.log('Expected columns:', expectedColumns);

    // Parse data rows
    const records = [];
    const pageViews = new Map();
    const referrers = new Map();
    const dailyStats = new Map();
    
    let startDate = null;
    let endDate = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted fields)
      const values = parseCSVLine(line);
      
      if (values.length < headers.length) {
        console.warn(`Skipping row ${i + 1}: insufficient columns`);
        continue;
      }

      const record = {};
      headers.forEach((header, index) => {
        record[header.toLowerCase()] = values[index] || '';
      });

      // Process the record based on detected structure
      const processedRecord = processCSVRecord(record);
      if (processedRecord) {
        records.push(processedRecord);

        // Aggregate data for analytics
        aggregateAnalyticsData(processedRecord, pageViews, referrers, dailyStats);

        // Track date range
        if (processedRecord.date) {
          const recordDate = new Date(processedRecord.date);
          if (!startDate || recordDate < startDate) startDate = recordDate;
          if (!endDate || recordDate > endDate) endDate = recordDate;
        }
      }
    }

    if (records.length === 0) {
      return { success: false, error: 'No valid data rows found in CSV' };
    }

    // Create summary analytics data
    const analyticsData = {
      records: records,
      summary: {
        totalRecords: records.length,
        dateRange: {
          start: startDate?.toISOString().split('T')[0],
          end: endDate?.toISOString().split('T')[0],
          description: dateRangeDescription
        },
        topPages: Array.from(pageViews.entries())
          .map(([page, stats]) => ({
            breakdown_value: page,
            count: stats.views,
            visitors: stats.visitors,
            label: getPageLabel(page)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        referrers: Array.from(referrers.entries())
          .map(([referrer, count]) => ({
            breakdown_value: referrer,
            count: count,
            label: getReferrerLabel(referrer)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        dailyStats: Array.from(dailyStats.entries())
          .map(([date, stats]) => ({
            date: date,
            pageViews: stats.views,
            uniqueVisitors: stats.visitors
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        totalPageViews: Array.from(pageViews.values()).reduce((sum, stats) => sum + stats.views, 0),
        totalUniqueVisitors: Array.from(dailyStats.values()).reduce((sum, stats) => sum + stats.visitors, 0)
      }
    };

    return { success: true, data: analyticsData };

  } catch (error) {
    console.error('CSV parsing error:', error);
    return { success: false, error: `Failed to parse CSV: ${error.message}` };
  }
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] === ',')) {
      inQuotes = true;
    } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
      inQuotes = false;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Process individual CSV record
function processCSVRecord(record) {
  try {
    // Try to extract common fields regardless of exact column names
    const date = record.date || record.day || record.time || record.timestamp;
    const page = record.page || record.path || record.url || record.pathname;
    const views = parseInt(record.views || record.pageviews || record['page views'] || record.visits || '1');
    const visitors = parseInt(record.visitors || record['unique visitors'] || record.users || views);
    const referrer = record.referrer || record.source || record['traffic source'] || 'direct';
    const country = record.country || record.location || '';

    if (!date) {
      return null; // Skip records without dates
    }

    return {
      date: normalizeDate(date),
      page: page || '/',
      views: isNaN(views) ? 1 : views,
      visitors: isNaN(visitors) ? 1 : visitors,
      referrer: referrer || 'direct',
      country: country || '',
      original: record // Keep original data for debugging
    };
  } catch (error) {
    console.warn('Error processing record:', error, record);
    return null;
  }
}

// Normalize date formats
function normalizeDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Try parsing common formats
      const formats = [
        /(\d{4})-(\d{2})-(\d{2})/,  // YYYY-MM-DD
        /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
        /(\d{2})-(\d{2})-(\d{4})/   // MM-DD-YYYY
      ];
      
      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          return new Date(match[0]).toISOString().split('T')[0];
        }
      }
      
      return new Date().toISOString().split('T')[0]; // Fallback to today
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    return new Date().toISOString().split('T')[0];
  }
}

// Aggregate data for analytics
function aggregateAnalyticsData(record, pageViews, referrers, dailyStats) {
  // Page views
  if (!pageViews.has(record.page)) {
    pageViews.set(record.page, { views: 0, visitors: 0 });
  }
  const pageStats = pageViews.get(record.page);
  pageStats.views += record.views;
  pageStats.visitors += record.visitors;

  // Referrers
  const ref = record.referrer || 'direct';
  referrers.set(ref, (referrers.get(ref) || 0) + record.views);

  // Daily stats
  if (!dailyStats.has(record.date)) {
    dailyStats.set(record.date, { views: 0, visitors: 0 });
  }
  const dailyData = dailyStats.get(record.date);
  dailyData.views += record.views;
  dailyData.visitors += record.visitors;
}

// Get friendly page labels
function getPageLabel(page) {
  if (page === '/') return 'Home Page';
  if (page === '/events') return 'Events';
  if (page === '/articles') return 'Articles';
  if (page === '/about') return 'About Us';
  if (page === '/contact') return 'Contact';
  if (page === '/team') return 'Team';
  if (page === '/news') return 'News';
  if (page === '/memorial') return 'Memorial';
  return page.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Get friendly referrer labels
function getReferrerLabel(referrer) {
  if (referrer === 'direct' || !referrer) return 'Direct Traffic';
  if (referrer.includes('google')) return 'Google Search';
  if (referrer.includes('facebook')) return 'Facebook';
  if (referrer.includes('twitter')) return 'Twitter';
  if (referrer.includes('linkedin')) return 'LinkedIn';
  if (referrer.includes('instagram')) return 'Instagram';
  return referrer.replace('https://', '').replace('http://', '');
}

// Store imported data to filesystem
async function storeImportedData(analyticsData, metadata) {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Create analytics imports directory
  const importsDir = path.join(process.cwd(), 'src/data/analytics-imports');
  await fs.mkdir(importsDir, { recursive: true });
  
  // Generate unique filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `import-${timestamp}.json`;
  const filePath = path.join(importsDir, filename);
  
  // Prepare data for storage
  const importData = {
    metadata: {
      ...metadata,
      importId: timestamp,
      version: '1.0'
    },
    data: analyticsData
  };
  
  // Write to file
  await fs.writeFile(filePath, JSON.stringify(importData, null, 2));
  
  console.log(`Analytics data imported: ${filePath}`);
  console.log(`Records: ${analyticsData.records.length}`);
  console.log(`Date range: ${analyticsData.summary.dateRange.start} to ${analyticsData.summary.dateRange.end}`);
  
  return {
    success: true,
    importId: timestamp,
    filePath: filename,
    recordCount: analyticsData.records.length
  };
}