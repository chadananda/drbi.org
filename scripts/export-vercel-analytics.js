#!/usr/bin/env node

/**
 * Automated Vercel Analytics CSV Export using Puppeteer
 * Run with: node scripts/export-vercel-analytics.js
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const VERCEL_EMAIL = process.env.VERCEL_EMAIL;
const VERCEL_PASSWORD = process.env.VERCEL_PASSWORD;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_uTpboV9oIYhXwhY0OBRGC0K9ja8g';

// Configure export settings
const EXPORT_CONFIG = {
  timeRange: '365d', // Last 365 days, adjust as needed
  projectName: 'drbi-org', // Your project name
  exportDir: path.join(process.cwd(), 'src/data/vercel-exports'),
  waitTime: 3000 // Wait time between actions
};

console.log('🚀 Starting automated Vercel Analytics export...');
console.log(`📊 Project: ${EXPORT_CONFIG.projectName}`);
console.log(`📅 Time range: ${EXPORT_CONFIG.timeRange}`);
console.log(`📁 Export directory: ${EXPORT_CONFIG.exportDir}`);

// Ensure export directory exists
await fs.mkdir(EXPORT_CONFIG.exportDir, { recursive: true });

async function loginToVercel(page) {
  console.log('🔑 Logging into Vercel...');
  
  await page.goto('https://vercel.com/login', { waitUntil: 'networkidle2' });
  
  // Try different email selectors that Vercel might use
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[placeholder*="email" i]',
    'input[aria-label*="email" i]',
    '#email'
  ];
  
  let emailInput = null;
  for (const selector of emailSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      emailInput = await page.$(selector);
      if (emailInput) {
        console.log(`✅ Found email input with selector: ${selector}`);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!emailInput) {
    console.log('❌ Could not find email input field');
    console.log('🖥️  Opening browser in non-headless mode for manual login...');
    console.log('⏳ Please complete login manually. Waiting 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    return;
  }
  
  // Clear and type email
  await emailInput.click({ clickCount: 3 }); // Select all
  await emailInput.type(VERCEL_EMAIL);
  
  // Find and click submit button
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("Continue")',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    '[data-testid="login-button"]'
  ];
  
  let submitted = false;
  for (const selector of submitSelectors) {
    try {
      const submitBtn = await page.$(selector);
      if (submitBtn) {
        console.log(`✅ Found submit button with selector: ${selector}`);
        await submitBtn.click();
        submitted = true;
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!submitted) {
    console.log('❌ Could not find submit button, trying Enter key...');
    await emailInput.press('Enter');
  }
  
  // Wait a bit for the response
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('📧 Login form submitted');
  console.log('⚠️  You may need to:');
  console.log('   1. Check your email for a login link');
  console.log('   2. Complete 2FA if enabled');
  console.log('   3. Accept any security prompts');
  console.log('⏳ Waiting 45 seconds for manual completion...');
  
  await new Promise(resolve => setTimeout(resolve, 45000));
  
  // Check if we're logged in by looking for common dashboard elements
  const dashboardSelectors = [
    '[data-testid="dashboard"]',
    '.dashboard',
    'text=Dashboard',
    'text=Projects',
    '[href="/dashboard"]'
  ];
  
  let loggedIn = false;
  for (const selector of dashboardSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      loggedIn = true;
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (loggedIn) {
    console.log('✅ Successfully logged into Vercel');
  } else {
    console.log('⚠️  Login status unclear, proceeding anyway...');
  }
}

async function navigateToAnalytics(page) {
  console.log('📊 Navigating to Analytics dashboard...');
  
  // Try multiple possible project URLs
  const analyticsUrls = [
    `https://vercel.com/${EXPORT_CONFIG.projectName}/analytics`,
    `https://vercel.com/dashboard/${EXPORT_CONFIG.projectName}/analytics`,
    `https://vercel.com/projects/${EXPORT_CONFIG.projectName}/analytics`,
    // Also try with the project ID
    `https://vercel.com/dashboard/projects/${PROJECT_ID}/analytics`
  ];
  
  let pageLoaded = false;
  
  for (const url of analyticsUrls) {
    try {
      console.log(`🔗 Trying: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Check if analytics content is present
      const analyticsSelectors = [
        '[data-testid="analytics-panel"]',
        '.analytics-panel',
        'text=Analytics',
        'text=Page Views',
        'text=Unique Visitors',
        '[data-testid="chart"]'
      ];
      
      for (const selector of analyticsSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          console.log(`✅ Found analytics content with: ${selector}`);
          pageLoaded = true;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (pageLoaded) break;
      
    } catch (error) {
      console.log(`⚠️  Failed to load ${url}: ${error.message}`);
      continue;
    }
  }
  
  if (!pageLoaded) {
    console.log('❌ Could not find analytics dashboard');
    console.log('🖥️  Please navigate to analytics manually in the browser');
    console.log('⏳ Waiting 30 seconds for manual navigation...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  } else {
    console.log('📈 Analytics dashboard loaded');
  }
}

async function setTimeRange(page) {
  console.log(`📅 Setting time range to ${EXPORT_CONFIG.timeRange}...`);
  
  try {
    // Look for time range selector
    await page.waitForSelector('[data-testid="time-range-selector"]', { timeout: 5000 });
    await page.click('[data-testid="time-range-selector"]');
    
    // Select the desired time range
    await page.waitForSelector(`[data-value="${EXPORT_CONFIG.timeRange}"]`, { timeout: 5000 });
    await page.click(`[data-value="${EXPORT_CONFIG.timeRange}"]`);
    
    console.log('✅ Time range set successfully');
  } catch (e) {
    console.log('⚠️  Could not find time range selector, using default range');
  }
}

async function exportPanel(page, panelName, selector) {
  console.log(`📤 Exporting ${panelName} data...`);
  
  try {
    // Find the panel
    const panel = await page.$(selector);
    if (!panel) {
      console.log(`❌ Could not find ${panelName} panel`);
      return false;
    }
    
    // Scroll to panel to ensure it's visible
    await panel.scrollIntoView();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Look for the three-dot menu within the panel
    const menuButton = await panel.$('.menu-button, [aria-label="More options"], [data-testid="panel-menu"]');
    if (!menuButton) {
      console.log(`❌ Could not find menu button for ${panelName}`);
      return false;
    }
    
    await menuButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click "Export as CSV"
    const exportOption = await page.$('text=Export as CSV, text=Export CSV, [data-testid="export-csv"]');
    if (!exportOption) {
      console.log(`❌ Could not find export option for ${panelName}`);
      return false;
    }
    
    await exportOption.click();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`✅ ${panelName} export initiated`);
    return true;
    
  } catch (error) {
    console.log(`❌ Error exporting ${panelName}:`, error.message);
    return false;
  }
}

async function exportAllPanels(page) {
  console.log('📊 Exporting all analytics panels...');
  
  const panels = [
    { name: 'Top Pages', selector: '[data-testid="pages-panel"], .pages-panel' },
    { name: 'Referrers', selector: '[data-testid="referrers-panel"], .referrers-panel' },
    { name: 'Countries', selector: '[data-testid="countries-panel"], .countries-panel' },
    { name: 'Page Views', selector: '[data-testid="pageviews-panel"], .pageviews-panel' },
    { name: 'Visitors', selector: '[data-testid="visitors-panel"], .visitors-panel' }
  ];
  
  const exportResults = [];
  
  for (const panel of panels) {
    const success = await exportPanel(page, panel.name, panel.selector);
    exportResults.push({ name: panel.name, success });
    
    // Wait between exports
    await new Promise(resolve => setTimeout(resolve, EXPORT_CONFIG.waitTime));
  }
  
  console.log('📋 Export Summary:');
  exportResults.forEach(result => {
    console.log(`   ${result.success ? '✅' : '❌'} ${result.name}`);
  });
  
  return exportResults;
}

async function waitForDownloads() {
  console.log('⏳ Waiting for CSV downloads to complete...');
  
  // Wait for downloads (adjust time based on your data size)
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check download folder
  const downloadPath = path.join(require('os').homedir(), 'Downloads');
  const files = await fs.readdir(downloadPath);
  const csvFiles = files.filter(file => 
    file.endsWith('.csv') && 
    file.includes('vercel') || file.includes('analytics')
  );
  
  console.log(`📁 Found ${csvFiles.length} potential CSV files in Downloads`);
  
  return csvFiles;
}

async function moveAndRenameCSVs(csvFiles) {
  console.log('📁 Moving and organizing CSV files...');
  
  const downloadPath = path.join(require('os').homedir(), 'Downloads');
  let movedFiles = 0;
  
  for (const file of csvFiles) {
    try {
      const sourcePath = path.join(downloadPath, file);
      const stats = await fs.stat(sourcePath);
      
      // Only move recent files (last 5 minutes)
      if (Date.now() - stats.mtime.getTime() < 5 * 60 * 1000) {
        // Determine file type and create appropriate name
        let targetName = file;
        if (file.toLowerCase().includes('pages')) targetName = 'vercel-pages.csv';
        else if (file.toLowerCase().includes('referrer')) targetName = 'vercel-referrers.csv';
        else if (file.toLowerCase().includes('countr')) targetName = 'vercel-countries.csv';
        else if (file.toLowerCase().includes('visitor')) targetName = 'vercel-visitors.csv';
        else if (file.toLowerCase().includes('pageview')) targetName = 'vercel-pageviews.csv';
        
        const targetPath = path.join(EXPORT_CONFIG.exportDir, targetName);
        await fs.rename(sourcePath, targetPath);
        
        console.log(`✅ Moved: ${file} → ${targetName}`);
        movedFiles++;
      }
    } catch (error) {
      console.log(`⚠️  Could not move ${file}:`, error.message);
    }
  }
  
  console.log(`📋 Successfully moved ${movedFiles} CSV files`);
  return movedFiles;
}

async function runExport() {
  if (!VERCEL_EMAIL) {
    console.error('❌ VERCEL_EMAIL environment variable is required');
    console.log('Add your Vercel login email to .env file');
    process.exit(1);
  }
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Set download path
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: EXPORT_CONFIG.exportDir
    });
    
    await loginToVercel(page);
    await navigateToAnalytics(page);
    await setTimeRange(page);
    
    const exportResults = await exportAllPanels(page);
    
    // Wait a bit for downloads to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🎉 Export process completed!');
    console.log(`📁 Check ${EXPORT_CONFIG.exportDir} for your CSV files`);
    console.log('');
    console.log('🎯 Next steps:');
    console.log('1. Run: node scripts/import-vercel-analytics.js --use-csv');
    console.log('2. This will process your CSV files and create the analytics import');
    
  } catch (error) {
    console.error('💥 Export failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the export
if (import.meta.url === `file://${process.argv[1]}`) {
  runExport().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}