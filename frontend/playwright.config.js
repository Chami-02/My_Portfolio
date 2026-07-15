import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:    './e2e',
  timeout:    30_000,      // 30 seconds per test
  retries:    1,           // Retry failing tests once (handles flaky timing)
  workers:    1,           // Run tests sequentially (avoids race conditions on shared DB)

  use: {
    baseURL:      'http://localhost:5173',
    headless:     true,    // Change to false to watch the browser during debugging
    screenshot:   'only-on-failure',
    video:        'retain-on-failure',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the dev server before running tests
  // webServer: {
  //   command: 'npm run dev',
  //   url:     'http://localhost:5173',
  //   reuseExistingServer: true,
  // },
});