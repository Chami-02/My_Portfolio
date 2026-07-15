import { test, expect } from '@playwright/test';

test.describe('Navbar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navbar is visible on page load', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
  });

  test('clicking "About" nav link scrolls to about section', async ({ page }) => {
    await page.click('a[href="#about"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#about')).toBeInViewport();
  });

  test('clicking "Skills" nav link scrolls to skills section', async ({ page }) => {
    await page.click('a[href="#skills"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#skills')).toBeInViewport();
  });

  test('clicking "Projects" nav link scrolls to projects section', async ({ page }) => {
    await page.click('a[href="#projects"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#projects')).toBeInViewport();
  });

  test('404 page shows for unknown route', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
  });

  test('"Back to Home" link on 404 navigates home', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await page.getByRole('link', { name: /back to home/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /Parindra\s+Chameekara/i })).toBeVisible();
  });
});
