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

  // ── PF-66, corrected in PF-85 ──────────────────────────────
  // Playwright starts and owns both processes locally, so the E2E backend
  // can only ever be the one on its own database. In CI, the `e2e` job in
  // ci.yml starts both servers itself (for health-check polling and log
  // capture) on these same ports, and Playwright must attach to them.
  //
  // ⚠️ `reuseExistingServer` is therefore `!!process.env.CI` — the INVERSE
  // of Playwright's usual `!process.env.CI` idiom, and deliberately so.
  //
  // It used to be an unconditional `true`, which is a real trap locally: a
  // stray `npm run dev` lands on 5174 automatically, because Vite silently
  // increments past a busy 5173. Playwright then adopted that server AS-IS,
  // with the environment it was launched with — serving
  // `VITE_API_URL=http://localhost:5050/api`, the DEVELOPMENT backend. The
  // suite drove the real page against the dev database: every page rendered
  // perfectly and only the admin logins failed, with a 401, because the dev
  // admin password is not the E2E fixture's. That cost two failures in
  // PF-85's gate and read exactly like an auth regression.
  //
  // Worse than the CORS variant CLAUDE.md documents: there the API calls
  // fail loudly, here only the DATA is wrong. So locally a busy port must
  // fail loudly rather than be silently adopted. In CI there is no stray
  // server — the workflow starts them on these ports with this env — so
  // attaching is correct there and only there.
  webServer: [
    {
      command: 'npm run dev:e2e --prefix ../backend',
      port: E2E_API_PORT,
      reuseExistingServer: !!process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${E2E_WEB_PORT}`,
      port: E2E_WEB_PORT,
      reuseExistingServer: !!process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_URL: `http://localhost:${E2E_API_PORT}/api`,
      },
    },
  ],
});
