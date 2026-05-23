#!/usr/bin/env node

// Quick sanity check script for DRBI website pages
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:4321';

// Key pages to check
const PAGES_TO_CHECK = [
  { url: '/', name: 'Home' },
  { url: '/about-us', name: 'About Us' },
  { url: '/how-to-purchase-a-plot', name: 'How to Purchase a Plot (fixed page)' },
  { url: '/memorial', name: 'Memorial' },
  { url: '/events', name: 'Events' },
  { url: '/news', name: 'News' },
  { url: '/topics', name: 'Topics' },
  { url: '/agriculture', name: 'Agriculture' },
  { url: '/arts', name: 'Arts' },
  { url: '/history', name: 'History' },
];

async function checkPage(browser, pageInfo) {
  const page = await browser.newPage();

  try {
    console.log(`\n🔍 Checking: ${pageInfo.name} (${pageInfo.url})`);

    await page.goto(BASE_URL + pageInfo.url, {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    // Check for JavaScript errors
    const errors = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    // Check if page loaded
    const title = await page.title();
    console.log(`  ✓ Title: ${title}`);

    // Check for broken images
    const brokenImages = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.complete || img.naturalHeight === 0)
        .map(img => img.src);
    });

    if (brokenImages.length > 0) {
      console.log(`  ⚠️  Broken images (${brokenImages.length}):`);
      brokenImages.slice(0, 3).forEach(src => console.log(`     - ${src}`));
      if (brokenImages.length > 3) {
        console.log(`     ... and ${brokenImages.length - 3} more`);
      }
    } else {
      console.log(`  ✓ All images loaded`);
    }

    // Check for console errors
    if (errors.length > 0) {
      console.log(`  ⚠️  JavaScript errors (${errors.length}):`);
      errors.slice(0, 2).forEach(err => console.log(`     - ${err}`));
    } else {
      console.log(`  ✓ No JavaScript errors`);
    }

    // Check if prose formatting is applied (for article pages)
    if (pageInfo.url.includes('plot') || pageInfo.url.includes('how-to')) {
      const hasProseStyles = await page.evaluate(() => {
        const proseDiv = document.querySelector('.prose-lg');
        if (!proseDiv) return false;

        // Check if strong tags have bold font weight
        const strong = proseDiv.querySelector('strong');
        if (strong) {
          const styles = window.getComputedStyle(strong);
          return parseInt(styles.fontWeight) >= 700;
        }
        return false;
      });

      if (hasProseStyles) {
        console.log(`  ✓ Prose formatting applied correctly`);
      } else {
        console.log(`  ⚠️  Prose formatting may not be applied`);
      }
    }

    return { success: true, errors: errors.length, brokenImages: brokenImages.length };

  } catch (error) {
    console.log(`  ❌ Error loading page: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🚀 Starting DRBI website sanity check...\n');
  console.log(`Base URL: ${BASE_URL}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  for (const pageInfo of PAGES_TO_CHECK) {
    const result = await checkPage(browser, pageInfo);
    results.push({ ...pageInfo, ...result });
  }

  await browser.close();

  // Summary
  console.log('\n\n📊 Summary:');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const withErrors = results.filter(r => r.success && r.errors > 0);
  const withBrokenImages = results.filter(r => r.success && r.brokenImages > 0);

  console.log(`\n✅ Successfully loaded: ${successful.length}/${results.length}`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed to load (${failed.length}):`);
    failed.forEach(r => console.log(`   - ${r.name}: ${r.error}`));
  }

  if (withErrors.length > 0) {
    console.log(`\n⚠️  Pages with JS errors (${withErrors.length}):`);
    withErrors.forEach(r => console.log(`   - ${r.name} (${r.errors} errors)`));
  }

  if (withBrokenImages.length > 0) {
    console.log(`\n⚠️  Pages with broken images (${withBrokenImages.length}):`);
    withBrokenImages.forEach(r => console.log(`   - ${r.name} (${r.brokenImages} images)`));
  }

  if (failed.length === 0 && withErrors.length === 0 && withBrokenImages.length === 0) {
    console.log('\n🎉 All pages look good!');
  }

  console.log('\n');
}

main().catch(console.error);
