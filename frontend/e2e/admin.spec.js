import { test, expect } from '@playwright/test';

// Credentials come from the environment so this suite can run against a
// deployed environment, where the admin password is NOT the local default.
// The fallbacks match what `npm run seed` writes when SEED_ADMIN_PASSWORD
// is unset, so a plain local run needs no setup.
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'admin@portfolio.dev';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@1234!';

test.describe('Admin Authentication Flow', () => {
  test('unauthenticated users are redirected to login', async ({ page }) => {
    // Clear any existing auth. PF-108: the refresh token is what persists
    // now (the access token lives in memory only); 'portfolio_token' no
    // longer exists and removing it would clear nothing.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('portfolio_refresh'));

    await page.goto('/admin');
    // Should redirect to login
    await expect(page).toHaveURL('/admin/login');
  });

  test('admin login page displays the form', async ({ page }) => {
    await page.goto('/admin/login');
    // PF-109 — the Phase 2 heading is "Admin sign in" (the second word
    // is the outlined one). exact: true pins the copy; without it
    // Playwright matched the old casing by substring, case-insensitive,
    // and this line would have kept passing against either page.
    await expect(page.getByRole('heading', { name: 'Admin sign in', exact: true })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('wrong credentials show error message', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test('correct credentials log in and redirect to dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to /admin after successful login
    await expect(page).toHaveURL('/admin', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  // PF-107 renamed this control and moved it. The Phase 1 sidebar had a
  // "View Site" link that opened a new tab; the rebuilt shell has the
  // prototype's "↗ HOME" in the header and "← BACK TO HOME PAGE" in the
  // new footer, both same-tab react-router links. The feature moved, it
  // did not disappear — which is exactly the case where a stale E2E
  // assertion goes red while every unit test stays green.
  test('the shell offers a way back to the public site', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // exact: true — getByRole matches by SUBSTRING in Playwright, and
    // "HOME" is contained in "BACK TO HOME PAGE". Without it this is a
    // strict-mode violation, not a pass.
    const home = page.getByRole('link', { name: '↗ HOME', exact: true });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('href', '/?nosplash=1');

    const back = page.getByRole('link', { name: '← BACK TO HOME PAGE', exact: true });
    await expect(back).toHaveAttribute('href', '/?nosplash=1');
  });

  test('the shell shows the signed-in account, not a hardcoded address', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // Scoped to the header: the footer's session column shows the same
    // address, so an unscoped locator is a strict-mode violation.
    await expect(
      page.locator('header').getByText(ADMIN_EMAIL, { exact: true }),
    ).toBeVisible();
  });

  // PF-110. The Overview's four stat cards and the sidebar badges read
  // ONE request, GET /api/dashboard/stats. This drives the real endpoint
  // against the seeded e2e database rather than a stub, so a route that
  // 401s, a badge that stays blank, or a card that never leaves its
  // skeleton all fail here and nowhere in the unit suite.
  test('the overview shows the dashboard counts from one request', async ({ page }) => {
    const statsRequests = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/dashboard/stats')) statsRequests.push(r.url());
    });

    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // Every card's value is a digit once the request lands. Scoped to
    // main: the sidebar repeats "Projects" / "Skills" as nav labels.
    const main = page.getByRole('main');
    for (const label of ['PROJECTS', 'SKILLS', 'PUBLISHED POSTS', 'UNREAD MESSAGES']) {
      const card = main.getByText(label, { exact: true }).locator('..');
      await expect(card).toHaveText(/[0-9]+/);
    }

    // The seed writes projects and skills, so those two badges carry a
    // number; Overview and About never do (the prototype's own choice).
    const nav = page.getByRole('navigation', { name: 'Admin sections' });
    await expect(nav.getByRole('button', { name: /Projects/ })).toHaveText(/[1-9][0-9]*/);
    await expect(nav.getByRole('button', { name: /Skills/ })).toHaveText(/[1-9][0-9]*/);
    await expect(nav.getByRole('button', { name: /Overview/ })).not.toHaveText(/[0-9]/);

    // One call feeds the cards, the badges and the footer — not one each.
    expect(statsRequests).toHaveLength(1);
  });

  test('the overview quick actions land on their panels', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // + NEW POST is the one that needs more than a tab switch: the blog
    // panel mounts in list view and must arrive with its editor open.
    await page.getByRole('button', { name: '+ NEW POST', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Post', exact: true })).toBeVisible();

    // Back to the overview by the sidebar, then a plain tab-switch action.
    await page.getByRole('navigation', { name: 'Admin sections' })
      .getByRole('button', { name: /Overview/ }).click();
    await page.getByRole('button', { name: 'EDIT PROFILE', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  });
});
