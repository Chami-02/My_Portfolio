import { test, expect } from '@playwright/test';

test.describe('Navbar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('navbar is visible on page load', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
  });

  /* ⚠️ SCOPED TO `header` SINCE PF-88. The Phase 2 footer carries the
     same in-page anchors — About, Skills, Projects, Field Notes, Contact
     and a SCROLL BACK UP → #hero — so a bare `a[href="#about"]` matches
     TWO elements on the home page and a strict locator throws. The
     failure reads as "the navbar link disappeared", which is the
     opposite of what happened. The footer's own links have their own
     specs below. */
  test('clicking "About" nav link scrolls to about section', async ({ page }) => {
    await page.click('header a[href="#about"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#about')).toBeInViewport();
  });

  test('clicking "Skills" nav link scrolls to skills section', async ({ page }) => {
    await page.click('header a[href="#skills"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#skills')).toBeInViewport();
  });

  test('clicking "Projects" nav link scrolls to projects section', async ({ page }) => {
    await page.click('header a[href="#projects"]');
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
    // ⚠️ POLLED, not a single reading after a fixed wait (PF-88).
    // ScrollToHash fires one rAF after the route commits, and the page
    // keeps settling behind it — two unoptimised hero images (1.4MB +
    // 2.3MB) and three API-driven sections all change the height of the
    // content ABOVE #projects. A single measurement at 1500ms catches
    // whatever moment it lands in: under load this read **-355px**
    // during a full-suite run and 70.8px when the file ran alone, which
    // is a flake, not a feature. Polling asserts where it SETTLES.
    //
    // ⚠️ The poll must cover the WHOLE condition, not half of it. A first
    // attempt polled `> 69` and then took a separate reading for `< 73`
    // — but the failure state is an UNSCROLLED page, where the top is
    // ~2664, so `> 69` was satisfied instantly by the very thing the
    // test exists to catch and the poll did nothing at all. Polling a
    // predicate that the failure also satisfies is the same class of
    // mistake as a vacuous assertion.
    //
    // --header-h is 71px; sub-pixel layout puts this at ~70.8.
    await expect
      .poll(
        () => page.locator('#projects').evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        { timeout: 10000 },
      )
      .toBe(71);
  });

  test('the 404 page navbar links home rather than nowhere', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    const about = page.locator('header').getByRole('link', { name: 'ABOUT' });
    await expect(about).toHaveAttribute('href', '/?nosplash=1#about');
  });

  test('the home page still uses bare hashes — regression guard', async ({ page }) => {
    // The specs above this describe select on header a[href="#about"].
    // If the route-awareness ever leaked onto "/", they would all break
    // at once and this says why.
    await page.goto('/');
    await expect(page.locator('header a[href="#about"]')).toHaveCount(1);
    await expect(page.locator('header a[href="#contact"]')).toHaveCount(1);

    // PF-88. The footer repeats the same anchors, which is WHY those
    // specs are header-scoped. Pinned so the reason is visible rather
    // than inferred from a scoping that looks like over-caution.
    await expect(page.locator('footer a[href="#about"]')).toHaveCount(1);
    await expect(page.locator('a[href="#about"]')).toHaveCount(2);
  });
});
