import { test, expect } from '@playwright/test';

test.describe('Admin Authentication Flow', () => {
  test('unauthenticated users are redirected to login', async ({ page }) => {
    // Clear any existing auth
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('portfolio_token'));

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
    await page.fill('input[type="email"]',    'admin@portfolio.dev');
    await page.fill('input[type="password"]', 'Admin@1234!');
    await page.click('button[type="submit"]');

    // Should redirect to /admin after successful login
    await expect(page).toHaveURL('/admin', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('"View Site" link exists in admin sidebar', async ({ page }) => {
    // Login first
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    'admin@portfolio.dev');
    await page.fill('input[type="password"]', 'Admin@1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    await expect(page.getByRole('link', { name: /view site/i })).toBeVisible();
  });
});
