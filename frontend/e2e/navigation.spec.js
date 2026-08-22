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
    // Phase 2 H1 (PF-80) — see the note in homepage.spec.js on why `\s+`.
    await expect(page.getByRole('heading', { name: /Parindra\s+Gallage/i })).toBeVisible();
  });
});

/**
 * ⚠️ Route-aware navbar — 2026-08-22.
 *
 * App.jsx mounts <Navbar /> on `path="*"`, and every link used to be a
 * bare hash, so on /blog and on NotFoundPage all six resolved to
 * nothing. PF-86 then pointed five Blog-teaser links at /blog, which has
 * no route — putting the dead chrome two clicks from the home page.
 *
 * These drive the real page rather than the model, which is the point:
 * the unit tests can prove the href strings, only a browser can prove
 * the jump actually lands under the fixed header.
 */
test.describe('Navbar off the home page', () => {
  test('/blog renders the Blog chrome, with no dead bare hashes', async ({ page }) => {
    await page.goto('/blog');
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'PROJECTS' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'ABOUT' })).toBeVisible();
    await expect(header.getByRole('link', { name: /PORTFOLIO/ })).toBeVisible();
    // On it already — and the Blog prototype's nav has no CONTACT.
    await expect(header.getByRole('link', { name: 'BLOG' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'CONTACT' })).toHaveCount(0);
    // The bug itself: zero links that go nowhere off the home page.
    await expect(header.locator('a[href^="#"]')).toHaveCount(0);
  });

  test('a nav link from /blog navigates home AND lands under the header', async ({ page }) => {
    await page.goto('/blog');
    await page.locator('header').getByRole('link', { name: 'PROJECTS' }).click();
    await expect(page).toHaveURL(/\/\?nosplash=1#projects$/);

    // ⚠️ The URL changing is NOT the assertion. React Router v7 performs
    // the navigation and ignores the fragment, so a version of this
    // feature with no ScrollToHash passes a URL check and leaves the
    // viewport at the top. Measure where #projects actually landed.
    await page.waitForTimeout(1500);
    const top = await page.locator('#projects').evaluate(
      (el) => el.getBoundingClientRect().top,
    );
    // --header-h is 71px; sub-pixel layout puts this at ~70.8.
    expect(top).toBeGreaterThan(69);
    expect(top).toBeLessThan(73);
  });

  test('the 404 page navbar links home rather than nowhere', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    const about = page.locator('header').getByRole('link', { name: 'ABOUT' });
    await expect(about).toHaveAttribute('href', '/?nosplash=1#about');
  });

  test('the home page still uses bare hashes — regression guard', async ({ page }) => {
    // The specs above this describe select on a[href="#about"]. If the
    // route-awareness ever leaked onto "/", they would all break at once
    // and this says why.
    await page.goto('/');
    await expect(page.locator('header a[href="#about"]')).toHaveCount(1);
    await expect(page.locator('header a[href="#contact"]')).toHaveCount(1);
  });
});
