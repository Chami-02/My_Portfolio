import { test, expect } from '@playwright/test';

/**
 * PF-88 — the Phase 2 footer.
 *
 * Two things here are only observable in a real browser driving the real
 * page, which is why they are e2e rather than unit tests:
 *
 *   1. REPLAY INTRO genuinely re-runs the splash over a page whose
 *      reveals have reset. Every piece of that is testable in isolation;
 *      the sequence is not.
 *   2. The footer's nav links resolve off the home page. That is the bug
 *      Step 3 fixed, and its failure mode is a link that does nothing —
 *      which no unit test of the component can see.
 */

test.describe('Footer (PF-88)', () => {

  /* ── the replay sequence ─────────────────────────────────────────── */

  /**
   * ⚠️ The one assertion that cannot be faked. Our Reveal sets `revealed`
   * true once and never unsets it, so closing the readiness gate alone
   * leaves an already-revealed page revealed — the splash would play
   * over a fully-revealed page and lift on a static one. Nothing errors.
   *
   * `?nosplash` so the page starts with no splash: the replay is then
   * unambiguously the button's doing and not the load's.
   */
  test('REPLAY INTRO re-runs the splash over reset reveals', async ({ page }) => {
    await page.goto('/?nosplash');
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    await expect(page.getByText(/Booting portfolio/i)).toHaveCount(0);
    const revealedBefore = await page.locator('[data-reveal="in"]').count();
    expect(revealedBefore).toBeGreaterThan(10);

    await page.getByRole('button', { name: /REPLAY INTRO/ }).click();

    // The splash comes up...
    await expect(page.getByText(/Booting portfolio/i)).toBeVisible();
    // ...over a page whose reveals have gone back to hidden.
    expect(await page.locator('[data-reveal="in"]').count())
      .toBeLessThan(revealedBefore);

    // ...and we are taken back to the top.
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)),
      { timeout: 4000 }).toBe(0);

    // The splash leaves on its own and the reveals fire again.
    await expect(page.getByText(/Booting portfolio/i))
      .toHaveCount(0, { timeout: 10000 });
    await expect.poll(() => page.locator('[data-reveal="in"]').count(),
      { timeout: 5000 }).toBeGreaterThan(5);
  });

  /**
   * The star-flicker guard. StarfieldCanvas reads useSplashReady(), so it
   * has to live inside SplashProvider — which makes "key the provider" a
   * tempting and wrong way to reset readiness: it regenerates every
   * star's position mid-replay, visibly, behind the splash. Node identity
   * is the assertion; a remounted canvas is still a canvas.
   */
  test('replay does not regenerate the star field', async ({ page }) => {
    await page.goto('/?nosplash');
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.querySelector('canvas').dataset.probe = 'original'; });

    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /REPLAY INTRO/ }).click();
    await expect(page.getByText(/Booting portfolio/i)).toBeVisible();

    expect(await page.evaluate(() => document.querySelector('canvas')?.dataset.probe))
      .toBe('original');
  });

  /**
   * ⚠️ A JS scrollTo with an explicit `behavior` is NOT reached by
   * motion.css's root-element scroll-behavior override, so the
   * preference has to be read in the handler or it is silently ignored
   * for the one audience it exists for. Asserted on the ARGUMENT,
   * because an instant scroll and a fast smooth one look alike.
   */
  test.describe('under prefers-reduced-motion', () => {
    test('replay scrolls instantly and mounts no splash', async ({ page }) => {
      /* ⚠️ `page.emulateMedia()`, NOT `test.use({ reducedMotion })`.
         The fixture is SILENTLY INERT in this project's config —
         measured, not guessed: with `test.use({ reducedMotion: 'reduce'
         })` at either file or describe level,
         `matchMedia('(prefers-reduced-motion: reduce)').matches` reads
         **false** inside the page and <html> carries no data-motion.
         The same option passed to `browser.newContext()` works, and
         emulateMedia works. A test written with the fixture therefore
         asserts the FULL-MOTION path while claiming to test the reduced
         one — it does not error, it just tests the wrong thing.
         Asserted explicitly below so this cannot regress silently. */
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      expect(await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      )).toBe(true);

      await page.locator('footer').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);

      await page.evaluate(() => {
        window.__scrollArgs = [];
        const orig = window.scrollTo.bind(window);
        window.scrollTo = (...a) => { window.__scrollArgs.push(a[0]); return orig(...a); };
      });
      const revealedBefore = await page.locator('[data-reveal="in"]').count();

      await page.getByRole('button', { name: /REPLAY INTRO/ }).click();
      await page.waitForTimeout(500);

      expect(await page.evaluate(() => window.__scrollArgs))
        .toEqual([{ top: 0, behavior: 'auto' }]);
      await expect(page.getByText(/Booting portfolio/i)).toHaveCount(0);
      // The reveals stay exactly where they are — that is what the
      // preference asks for.
      expect(await page.locator('[data-reveal="in"]').count()).toBe(revealedBefore);
    });
  });

  /* ── route-aware links ───────────────────────────────────────────── */

  test('footer nav links are bare hashes on the home page', async ({ page }) => {
    await page.goto('/?nosplash');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#about');
    await expect(footer.getByRole('link', { name: 'Field Notes' })).toHaveAttribute('href', '#blog');
    await expect(footer.getByRole('link', { name: 'SCROLL BACK UP ↑' })).toHaveAttribute('href', '#hero');
  });

  /**
   * The bug Step 3 fixed. App.jsx mounts <Footer /> on path="*", so
   * before this every one of these was a bare hash resolving to nothing
   * on a 404 and on /blog — dead chrome two clicks from the home page,
   * exactly the navbar bug one element lower.
   */
  test('footer nav links work from a 404, landing under the header', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    const link = page.locator('footer').getByRole('link', { name: 'Projects' });
    await expect(link).toHaveAttribute('href', '/?nosplash=1#projects');

    await link.click();
    await expect(page).toHaveURL(/\/\?nosplash=1#projects$/);

    // ?nosplash=1 is the prototype's own convention — without it the
    // ~5.65s splash replays OVER the anchor jump while initialReady
    // holds every reveal.
    await expect(page.getByText(/Booting portfolio/i)).toHaveCount(0);

    const headerHeight = await page.evaluate(
      () => document.querySelector('header').getBoundingClientRect().height);
    await expect.poll(
      () => page.evaluate(() => Math.round(document.querySelector('#projects').getBoundingClientRect().top)),
      { timeout: 8000 },
    ).toBe(Math.round(headerHeight));
  });

  test('no REPLAY INTRO button off the home page, but the bar keeps three columns', async ({ page }) => {
    // There is no splash to replay off "/", so a button there would be
    // dead chrome of exactly the kind the links above stopped being. The
    // bar is `1fr auto 1fr`, so the slot still has to be occupied or the
    // copyright stops being centred.
    await page.goto('/this-page-does-not-exist');
    await expect(page.locator('footer').getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => {
      const f = document.querySelector('footer');
      const bar = f.children[1].lastElementChild;
      return { children: bar.children.length, cols: getComputedStyle(bar).gridTemplateColumns.split(' ').length };
    })).toEqual({ children: 3, cols: 3 });
  });

  /* ── content ─────────────────────────────────────────────────────── */

  test('renders the four columns, the availability badge and the copyright', async ({ page }) => {
    await page.goto('/?nosplash');
    const footer = page.locator('footer');
    for (const heading of ['NAVIGATE', 'ELSEWHERE', 'STATUS']) {
      await expect(footer.getByText(heading, { exact: true })).toBeVisible();
    }
    await expect(footer.getByText('AVAILABLE FOR WORK')).toBeVisible();
    await expect(footer.getByText(/© 2026 PARINDRA GALLAGE · DESIGNED & BUILT FROM SCRATCH/)).toBeVisible();
    await expect(footer.getByRole('link', { name: 'START A PROJECT →' })).toHaveAttribute('href', '#contact');
    // The logo is decorative — the name and role are real text beside it.
    await expect(footer.locator('img')).toHaveAttribute('alt', '');
  });
});
