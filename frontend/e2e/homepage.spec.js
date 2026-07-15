import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads and displays hero section', async ({ page }) => {
    // Page title
    await expect(page).toHaveTitle(/Parindra Chameekara/i);

    // Hero heading
    await expect(page.getByRole('heading', { name: /Parindra\s+Chameekara/i })).toBeVisible();

    // Availability badge
    await expect(page.getByText('Open to opportunities')).toBeVisible();
  });

  test('typewriter animation starts and displays text', async ({ page }) => {
    // Wait for the typewriter to type at least something
    await page.waitForTimeout(500);
    const typewriterEl = page.locator('.animate-blink').first();
    // The cursor should be visible (blinking cursor shows typewriter is running)
    await expect(typewriterEl).toBeVisible();
  });

  test('terminal window displays output lines', async ({ page }) => {
    await expect(page.getByText('$ docker compose up --build')).toBeVisible({ timeout: 5000 });
  });

  test('"View My Work" CTA scrolls to projects section', async ({ page }) => {
    await page.click('text=View My Work');
    await page.waitForTimeout(800); // Allow smooth scroll to finish
    // The projects section heading should now be in the viewport
    await expect(page.locator('#projects')).toBeInViewport();
  });

  test('"Get In Touch" CTA scrolls to contact section', async ({ page }) => {
    await page.click('text=Get In Touch');
    await page.waitForTimeout(800);
    await expect(page.locator('#contact')).toBeInViewport();
  });

  test('scroll-to-top button appears after scrolling down', async ({ page }) => {
    // The button only appears after 400px of scrolling
    await expect(page.getByRole('button', { name: /scroll to top/i })).not.toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /scroll to top/i })).toBeVisible();
  });
});
