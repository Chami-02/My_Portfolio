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
    await expect(page.getByRole('heading', { name: 'Admin Sign In' })).toBeVisible();
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
});
