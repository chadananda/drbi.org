#!/usr/bin/env node

/**
 * Build script to generate analytics summary for production deployment
 * Run this before deploying to production to pre-compute analytics data
 */

import { generateStaticAnalyticsSummary } from '../src/utils/analytics-cache.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAnalytics() {
  console.log('🏗️  Building analytics summary for production...');
  
  try {
    // Check if we have any imported data
    const importsDir = path.join(process.cwd(), 'src/data/analytics-imports');
    
    try {
      const files = await fs.readdir(importsDir);
      const importFiles = files.filter(f => f.startsWith('import-') && f.endsWith('.json'));
      
      if (importFiles.length === 0) {
        console.log('ℹ️  No imported analytics data found');
        
        // Create an empty summary to prevent runtime errors
        const emptySummary = {
          totalPageViews: 0,
          totalUniqueVisitors: 0,
          dateRange: null,
          topPages: [],
          referrers: [],
          dailyStats: [],
          pageViews: [],
          uniqueVisitors: [],
          sources: [],
          isImported: false,
          isHybrid: false,
          dataSource: 'none',
          generatedAt: new Date().toISOString()
        };
        
        const summaryPath = path.join(process.cwd(), 'src/data/analytics-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(emptySummary, null, 2));
        console.log('📝 Created empty analytics summary');
        return;
      }
      
      console.log(`📊 Found ${importFiles.length} import file(s), generating summary...`);
      
    } catch (dirError) {
      console.log('ℹ️  No analytics imports directory found, creating empty summary...');
      
      // Ensure data directory exists
      await fs.mkdir(path.join(process.cwd(), 'src/data'), { recursive: true });
      
      const emptySummary = {
        totalPageViews: 0,
        totalUniqueVisitors: 0,
        dateRange: null,
        topPages: [],
        referrers: [],
        dailyStats: [],
        pageViews: [],
        uniqueVisitors: [],
        sources: [],
        isImported: false,
        isHybrid: false,
        dataSource: 'none',
        generatedAt: new Date().toISOString()
      };
      
      const summaryPath = path.join(process.cwd(), 'src/data/analytics-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(emptySummary, null, 2));
      console.log('📝 Created empty analytics summary');
      return;
    }

    // Generate the summary from imported data
    const summary = await generateStaticAnalyticsSummary();
    
    if (summary) {
      console.log('✅ Analytics summary generated successfully!');
      console.log(`   📈 ${summary.totalPageViews.toLocaleString()} page views`);
      console.log(`   👥 ${summary.totalUniqueVisitors.toLocaleString()} unique visitors`);
      console.log(`   📅 Date range: ${summary.dateRange?.startDate} to ${summary.dateRange?.endDate}`);
      console.log(`   📄 Top pages: ${summary.topPages.length}`);
      console.log(`   🔗 Referrers: ${summary.referrers.length}`);
    } else {
      console.log('ℹ️  No analytics data to summarize');
    }
    
  } catch (error) {
    console.error('❌ Error building analytics summary:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildAnalytics().catch(console.error);
}

export default buildAnalytics;