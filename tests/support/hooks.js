import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';

// Set default timeout for all steps
setDefaultTimeout(30000);

let browser;

// Launch browser once for all scenarios (efficient)
BeforeAll(async function () {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
});

// Clean up browser after all scenarios
AfterAll(async function () {
  if (browser) {
    await browser.close();
  }
});

// Create fresh context and page for each scenario
Before(async function () {
  this.context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  this.page = await this.context.newPage();
  this.baseURL = process.env.BASE_URL || 'http://localhost:4321';
  this.testData = {};
});

// Clean up after each scenario
After(async function (scenario) {
  // Attach screenshot on failure for debugging
  if (scenario.result?.status === 'FAILED' && this.page) {
    try {
      const screenshot = await this.page.screenshot();
      this.attach(screenshot, 'image/png');
    } catch (e) {
      // Ignore screenshot errors
    }
  }

  if (this.context) {
    await this.context.close();
  }
});

// Handle @mobile tag - set mobile viewport
Before({ tags: '@mobile' }, async function () {
  if (this.page) {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }
});
