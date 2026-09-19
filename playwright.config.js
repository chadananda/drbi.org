import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4314',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // astro 7's `dev` daemonises: it prints "Dev server running at ... (pid N)"
    // and the launcher exits immediately, which Playwright reads as
    // "process exited before becoming ready". Block after starting it so
    // Playwright has a live process to hold while it polls the URL. The daemon
    // itself outlives the run and is picked up by reuseExistingServer next time.
    command: 'npm run dev && tail -f /dev/null',
    url: 'http://localhost:4314',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
