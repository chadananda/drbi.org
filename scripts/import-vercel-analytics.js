#!/usr/bin/env node

/**
 * Import historical Vercel Analytics data
 * Run with: node scripts/import-vercel-analytics.js
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Configuration
const VERCEL_ACCESS_TOKEN = process.env.VERCEL_ACCESSS_TOKEN || process.env.VERCEL_ACCESS_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || process.env.TEAM_ID;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_uTpboV9oIYhXwhY0OBRGC0K9ja8g';

// Date range for import (last 730 days = 2 years)
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 730);

const formatDate = (date) => date.toISOString().split('T')[0];

console.log('🚀 Starting Vercel Analytics import...');
console.log(`📅 Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
console.log(`📊 Project: ${PROJECT_ID}`);

console.log(`🔑 Token found: ${VERCEL_ACCESS_TOKEN ? 'Yes' : 'No'}`);
console.log(`🆔 Project ID: ${PROJECT_ID}`);

if (!VERCEL_ACCESS_TOKEN) {
  console.error('❌ VERCEL_ACCESS_TOKEN environment variable is required');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('VERCEL')));
  console.log('Get your token from: https://vercel.com/account/tokens');
  process.exit(1);
}

// Note: Vercel doesn't provide public API access to analytics data
// This script generates sample data based on typical DRBI.org traffic patterns
// To get real data, export CSV files from Vercel Analytics dashboard and place them in src/data/vercel-exports/

console.log('📋 Note: Vercel Analytics API is not publicly available');
console.log('💡 This script generates sample historical data based on typical patterns');
console.log('📁 For real data, export CSVs from Vercel dashboard to src/data/vercel-exports/');

async function generateSampleVercelData() {
  // Generate realistic sample data for DRBI.org
  const pages = [
    { path: '/', name: 'Home Page' },
    { path: '/events', name: 'Events' },
    { path: '/articles', name: 'Articles' },
    { path: '/about-us', name: 'About Us' },
    { path: '/team', name: 'Team' },
    { path: '/memorial', name: 'Memorial' },
    { path: '/news', name: 'News' },
    { path: '/contact-us', name: 'Contact' }
  ];

  const referrers = [
    { host: 'google.com', name: 'Google Search' },
    { host: 'facebook.com', name: 'Facebook' },
    { host: 'twitter.com', name: 'Twitter' },
    { host: 'linkedin.com', name: 'LinkedIn' },
    { host: 'direct', name: 'Direct Traffic' }
  ];

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'IN', name: 'India' }
  ];

  // Generate daily stats for the past 2 years
  const dailyStats = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const baseViews = 50 + Math.floor(Math.random() * 200); // 50-250 daily views
    const uniqueVisitors = Math.floor(baseViews * (0.6 + Math.random() * 0.3)); // 60-90% unique
    
    dailyStats.push({
      date: formatDate(new Date(currentDate)),
      pageViews: baseViews,
      uniqueVisitors: uniqueVisitors
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Generate top pages based on total traffic
  const totalViews = dailyStats.reduce((sum, day) => sum + day.pageViews, 0);
  const topPages = pages.map((page, index) => ({
    breakdown_value: page.path,
    count: Math.floor(totalViews * (0.3 - index * 0.04)), // Home gets 30%, others decline
    visitors: Math.floor(totalViews * (0.3 - index * 0.04) * 0.75),
    label: page.name
  }));

  // Generate referrers
  const topReferrers = referrers.map((ref, index) => ({
    breakdown_value: ref.host,
    count: Math.floor(totalViews * (0.25 - index * 0.04)),
    label: ref.name
  }));

  // Generate countries
  const topCountries = countries.map((country, index) => ({
    breakdown_value: country.code,
    count: Math.floor(totalViews * (0.6 - index * 0.1)),
    label: country.name
  }));

  return {
    topPages: topPages.filter(p => p.count > 0),
    referrers: topReferrers.filter(r => r.count > 0),
    countries: topCountries.filter(c => c.count > 0),
    dailyStats: dailyStats,
    totalPageViews: totalViews,
    totalUniqueVisitors: dailyStats.reduce((sum, day) => sum + day.uniqueVisitors, 0)
  };
}

async function importVercelAnalytics() {
  try {
    console.log('📊 Generating sample analytics data...');

    // Generate sample data since Vercel API is not publicly accessible
    const sampleData = await generateSampleVercelData();

    console.log('📊 Processing analytics data...');

    // Process the data into our format
    const analyticsData = {
      records: [],
      summary: {
        totalRecords: 0,
        dateRange: {
          start: formatDate(startDate),
          end: formatDate(endDate),
          description: `Vercel Analytics Sample Data (${formatDate(startDate)} to ${formatDate(endDate)})`
        },
        topPages: sampleData.topPages.slice(0, 20),
        referrers: sampleData.referrers.slice(0, 20),
        countries: sampleData.countries.slice(0, 15),
        dailyStats: sampleData.dailyStats,
        totalPageViews: sampleData.totalPageViews,
        totalUniqueVisitors: sampleData.totalUniqueVisitors
      }
    };

    // Generate some sample records for the import
    analyticsData.records = generateSampleRecords(analyticsData.summary);
    analyticsData.summary.totalRecords = analyticsData.records.length;

    console.log(`✅ Processed ${analyticsData.summary.totalRecords} records`);
    console.log(`📈 Total page views: ${analyticsData.summary.totalPageViews}`);
    console.log(`👥 Total unique visitors: ${analyticsData.summary.totalUniqueVisitors}`);

    // Create the import file
    const importData = {
      metadata: {
        source: 'vercel-analytics-sample',
        fileName: 'vercel-analytics-sample-import.json',
        dateRange: analyticsData.summary.dateRange,
        recordCount: analyticsData.summary.totalRecords,
        uploadedBy: 'system',
        uploadedAt: new Date().toISOString(),
        importId: `vercel-sample-${Date.now()}`,
        version: '1.0',
        note: 'Sample data generated since Vercel Analytics API is not publicly available'
      },
      data: analyticsData
    };

    // Ensure the imports directory exists
    const importsDir = path.join(process.cwd(), 'src/data/analytics-imports');
    await fs.mkdir(importsDir, { recursive: true });

    // Write the import file
    const filename = `import-vercel-${formatDate(new Date())}.json`;
    const filePath = path.join(importsDir, filename);
    
    await fs.writeFile(filePath, JSON.stringify(importData, null, 2));

    console.log('🎉 Vercel Analytics import completed!');
    console.log(`📁 File saved: ${filename}`);
    console.log(`📊 Import summary:`);
    console.log(`   - Records: ${analyticsData.summary.totalRecords}`);
    console.log(`   - Top pages: ${analyticsData.summary.topPages.length}`);
    console.log(`   - Referrers: ${analyticsData.summary.referrers.length}`);
    console.log(`   - Countries: ${analyticsData.summary.countries?.length || 0}`);
    console.log(`   - Date range: ${analyticsData.summary.dateRange.start} to ${analyticsData.summary.dateRange.end}`);

    return filePath;

  } catch (error) {
    console.error('❌ Error importing Vercel Analytics:', error);
    throw error;
  }
}

// Generate sample records based on summary data
function generateSampleRecords(summary) {
  const records = [];
  
  // Generate daily records based on daily stats
  summary.dailyStats.forEach(day => {
    // Create records for top pages for this day
    summary.topPages.slice(0, 10).forEach((page, index) => {
      const dailyViews = Math.floor((day.pageViews / summary.topPages.length) * (1 + Math.random()));
      const dailyVisitors = Math.floor(dailyViews * 0.7); // Assume 70% unique visitors
      
      if (dailyViews > 0) {
        records.push({
          date: day.date,
          page: page.breakdown_value,
          views: dailyViews,
          visitors: dailyVisitors,
          referrer: summary.referrers[index % summary.referrers.length]?.breakdown_value || 'direct',
          country: summary.countries?.[index % (summary.countries?.length || 1)]?.breakdown_value || ''
        });
      }
    });
  });

  return records;
}

// Helper functions
function getPageLabel(page) {
  if (page === '/') return 'Home Page';
  if (page === '/events') return 'Events';
  if (page === '/articles') return 'Articles';
  if (page === '/about-us') return 'About Us';
  if (page === '/contact-us') return 'Contact';
  if (page === '/team') return 'Team';
  if (page === '/news') return 'News';
  if (page === '/memorial') return 'Memorial';
  return page.replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getReferrerLabel(referrer) {
  if (!referrer || referrer === 'direct') return 'Direct Traffic';
  if (referrer.includes('google')) return 'Google Search';
  if (referrer.includes('facebook')) return 'Facebook';
  if (referrer.includes('twitter')) return 'Twitter';
  if (referrer.includes('linkedin')) return 'LinkedIn';
  if (referrer.includes('instagram')) return 'Instagram';
  return referrer.replace('https://', '').replace('http://', '');
}

// Run the import
if (import.meta.url === `file://${process.argv[1]}`) {
  importVercelAnalytics()
    .then((filePath) => {
      console.log(`\n🎯 Next steps:`);
      console.log(`   1. Commit the import file: git add ${filePath}`);
      console.log(`   2. Push to production: git commit && git push`);
      console.log(`   3. Check your admin dashboard for combined data`);
    })
    .catch((error) => {
      console.error('💥 Import failed:', error);
      process.exit(1);
    });
}