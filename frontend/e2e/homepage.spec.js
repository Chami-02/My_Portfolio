import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  // `?nosplash` is the prototype's own mechanism, ported in PF-78. Without
  // it every test here waits out the full ~5.65s splash before it can click
  // anything, because the splash sits at z-index 100 over the whole page and
  // Playwright's actionability check refuses to click through it. The splash
  // itself is covered by its own test below, on a plain `/`.
  test.beforeEach(async ({ page }) => {
    await page.goto('/?nosplash');
  });

  test('loads and displays hero section', async ({ page }) => {
    // Page title — still the Phase 1 string; the cutover ticket owns it.
    await expect(page).toHaveTitle(/Parindra Chameekara/i);

    // Hero heading. PF-80 replaced the Phase 1 hero, and the Phase 2 H1 is
    // "Parindra Gallage" — two block-level spans, so `textContent` reads
    // "ParindraGallage" with no space while the ACCESSIBLE NAME has one.
    // `getByRole(...{ name })` matches the accessible name, hence `\s+`.
    await expect(page.getByRole('heading', { name: /Parindra\s+Gallage/i })).toBeVisible();

    // Availability badge. The content is uppercase ("OPEN TO OPPORTUNITIES");
    // `getByText` with a string is case-insensitive, so this still matches.
    await expect(page.getByText('Open to opportunities')).toBeVisible();
    await expect(page.getByText('HEY — I AM')).toBeVisible();
  });

  // Replaces two Phase 1 tests that asserted features PF-80 deliberately
  // removed: the typewriter's `.animate-blink` cursor and TerminalWindow's
  // "$ docker compose up --build". Both components are now orphaned (zero
  // consumers) and the Phase 2 hero has no typewriter at all, so those
  // assertions could only ever fail. These cover what replaced them.
  test('hero renders its Phase 2 role pills and the LOUD CTA', async ({ page }) => {
    await expect(page.getByText('Full-Stack Web Developer')).toBeVisible();
    await expect(page.getByText('Cloud & DevOps Enthusiast')).toBeVisible();
    await expect(page.getByRole('link', { name: /build something LOUD/i })).toBeVisible();
  });

  test('marquee strip renders after the hero', async ({ page }) => {
    // The marquee duplicates its content to loop seamlessly, so this text
    // legitimately appears twice — `.first()` rather than a strict locator.
    await expect(page.getByText(/MERN Stack/i).first()).toBeVisible();
  });

  test('splash covers a normal load, then lifts on its own', async ({ page }) => {
    await page.goto('/');

    // "Booting portfolio…" is unique to the splash. The hero's own LOUD CTA
    // also contains "build something loud", so the splash's last boot line
    // is NOT a safe locator here — it matches two elements mid-splash.
    const booting = page.getByText(/Booting portfolio/i);
    await expect(booting).toBeVisible();

    // SPLASH_MS 4500 + the exit slide ≈ 5.65s to unmount. The timeout is
    // generous because CI runners are slower than a laptop.
    await expect(booting).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Parindra\s+Gallage/i })).toBeVisible();
  });

  test('?nosplash skips the splash entirely', async ({ page }) => {
    await expect(page.getByText(/Booting portfolio/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Parindra\s+Gallage/i })).toBeVisible();
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
