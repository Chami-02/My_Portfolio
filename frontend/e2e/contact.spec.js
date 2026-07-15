import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Scroll to contact section
    await page.evaluate(() =>
      document.getElementById('contact')?.scrollIntoView()
    );
    await page.waitForTimeout(500);
  });

  test('contact form is visible', async ({ page }) => {
    await expect(page.locator('#contact')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
  });

  test('shows success state after valid submission', async ({ page }) => {
    await page.fill('input[name="name"]',      'Test Recruiter');
    await page.fill('input[name="email"]',     'recruiter@company.com');
    await page.fill('textarea[name="message"]', 'Hi! I would love to discuss a junior developer role with you.');

    await page.click('button[type="submit"]');

    // Wait for the success message (API call + state update)
    await expect(page.locator('text=Message received')).toBeVisible({ timeout: 8000 });
  });

  test('empty form cannot be submitted (HTML5 validation)', async ({ page }) => {
    await page.click('button[type="submit"]');
    // HTML5 required validation prevents submission — form stays visible
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('text=Message received')).not.toBeVisible();
  });
});