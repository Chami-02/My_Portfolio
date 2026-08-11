import { defineConfig, devices } from '@playwright/test';

const E2E_API_PORT = 5055;
const E2E_WEB_PORT = 5174;      // not 5173 — leaves your dev server alone

export default defineConfig({
  testDir:    './e2e',
  timeout:    30_000,      // 30 seconds per test
  retries:    1,           // Retry failing tests once (handles flaky timing)

  // PF-66 — every worker shares one portfolio_e2e database. Parallel specs
  // creating and deleting the same fixtures produce failures that look
  // random and are miserable to debug. Serial is slower and honest.
  fullyParallel: false,
  workers:    1,
  reporter:   'html',

  globalSetup: './e2e/global-setup.js',

  use: {
    baseURL:      `http://localhost:${E2E_WEB_PORT}`,
    headless:     true,    // Change to false to watch the browser during debugging
    screenshot:   'only-on-failure',
    video:        'retain-on-failure',
    trace:        'on-first-retry',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
  ],

  // ── PF-66 ──────────────────────────────────────────────────
  // Playwright starts and owns both processes locally, so the E2E backend
  // can only ever be the one on its own database. In CI, the `e2e` job in
  // ci.yml starts both servers itself (for health-check polling and log
  // capture) on these same ports — reuseExistingServer is therefore always
  // true, not just outside CI: CI's servers ARE the servers Playwright would
  // otherwise start, on the same ports with the same env, so attaching to
  // them is correct rather than a CI-only relaxation of a safety check.
  webServer: [
    {
      command: 'npm run dev:e2e --prefix ../backend',
      port: E2E_API_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${E2E_WEB_PORT}`,
      port: E2E_WEB_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        VITE_API_URL: `http://localhost:${E2E_API_PORT}/api`,
      },
    },
  ],
});
