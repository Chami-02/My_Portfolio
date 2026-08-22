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

  /**
   * Replaces `"Get In Touch" CTA scrolls to contact section`, which was
   * vacuous and had been since PF-80. Phase 1's hero had
   * `<a href="#contact">Get In Touch</a>`; PF-80 deleted it, so
   * `text=Get In Touch` resolved to the Contact <h2> — href null, never
   * inside an <a>. Measured during PF-84: `location.hash` stayed "" and
   * the same assertion PASSED with no click at all, because Playwright
   * scrolls an element into view before clicking it. It asserted
   * Playwright's own documented behaviour, so it could not fail for a
   * product reason, and it reported `flaky` rather than failing once
   * `?nosplash` removed the incidental delay that let the hero images
   * settle first.
   *
   * The fix is to assert NAVIGATION, not viewport position: `location.hash`
   * distinguishes a real anchor from an auto-scroll, and auto-scroll
   * cannot set it.
   */
  test('the hero LOUD CTA navigates to the contact section', async ({ page }) => {
    // Baseline — if the hash were already #contact the assertion below
    // would pass without the click doing anything.
    expect(await page.evaluate(() => window.location.hash)).toBe('');

    // getByRole('link'), not text=. The Contact <h2> reads "Let's build
    // something loud" too, so a text locator matches two elements and a
    // strict locator throws; filtering by role excludes the heading.
    await page.getByRole('link', { name: /build something LOUD/i }).click();

    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#contact');
    await expect(page.locator('#contact')).toBeInViewport();
  });

  /**
   * PF-87's headline fix, asserted where it is actually observable.
   * `global.css:338` carries `[id] { scroll-margin-top: 5rem }` at
   * (0,1,0) — a tie with a bare class, broken by stylesheet order — so
   * Contact computed 80px against a 71px header and every jump landed
   * 9px low. Contact was the last section still on Phase 1 markup and so
   * the only one still exhibiting it. `section.contact` is (0,1,1) and
   * settles it.
   */
  test('every section clears the fixed header by exactly --header-h', async ({ page }) => {
    const headerHeight = await page.evaluate(
      () => document.querySelector('header').getBoundingClientRect().height,
    );
    expect(headerHeight).toBe(71);

    for (const id of ['hero', 'about', 'skills', 'projects', 'blog', 'contact']) {
      const margin = await page.evaluate(
        (sectionId) => getComputedStyle(document.getElementById(sectionId)).scrollMarginTop,
        id,
      );
      expect(margin, `#${id} scroll-margin-top`).toBe(`${headerHeight}px`);
    }
  });

  test('scroll-to-top button appears after scrolling down', async ({ page }) => {
    // The button only appears after 400px of scrolling
    await expect(page.getByRole('button', { name: /scroll to top/i })).not.toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /scroll to top/i })).toBeVisible();
  });
});
