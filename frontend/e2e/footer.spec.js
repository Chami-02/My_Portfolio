import { test, expect } from '@playwright/test';

/**
 * Footer — PF-88, revised 2026-08-25.
 *
 * ⚠️ This file was originally three-quarters about REPLAY INTRO. That
 * button and the SCROLL BACK UP link were both removed at the owner's
 * request; what is left covers the two things a unit test genuinely
 * cannot reach:
 *
 *   1. The route-aware links, driven through a real router on a real
 *      404 — the bug that made every footer hash dead off "/".
 *   2. The band and the bottom bar as rendered, including the tilt
 *      clearance that only exists because the footer clips.
 *
 * Absence guards are kept rather than deleted: both removed controls
 * are in the prototype, so a fidelity pass diffing against the export
 * reads them as un-transcribed and puts them back.
 */
test.describe('Footer (PF-88)', () => {

  /* ── route-aware links ───────────────────────────────────────────── */

  test('footer nav links are bare hashes on the home page', async ({ page }) => {
    await page.goto('/?nosplash');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'About' })).toHaveAttribute('href', '#about');
    await expect(footer.getByRole('link', { name: 'Field Notes' })).toHaveAttribute('href', '#blog');
    await expect(footer.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '#contact');
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

  test('neither removed control renders, on any route', async ({ page }) => {
    // Both are in the prototype (line 599 and line 601), so this is an
    // absence guard, not a leftover. REPLAY INTRO went because nobody
    // wants to sit through the splash again mid-visit; SCROLL BACK UP
    // went because ScrollToTop already floats one on every route.
    for (const path of ['/?nosplash', '/this-page-does-not-exist']) {
      await page.goto(path);
      const footer = page.locator('footer');
      await expect(footer.getByRole('button')).toHaveCount(0);
      await expect(footer.getByText(/REPLAY INTRO/i)).toHaveCount(0);
      await expect(footer.getByText(/SCROLL BACK UP/i)).toHaveCount(0);
      await expect(footer.locator('a[href$="#hero"]')).toHaveCount(0);
    }
  });

  test('the bottom bar is one centred line', async ({ page }) => {
    await page.goto('/?nosplash');
    expect(await page.evaluate(() => {
      const bar = document.querySelector('footer').children[1].lastElementChild;
      const cs = getComputedStyle(bar);
      const line = bar.firstElementChild.getBoundingClientRect();
      const box = bar.getBoundingClientRect();
      return {
        children: bar.children.length,
        display: cs.display,
        // Centred within a couple of pixels, measured rather than
        // inferred from `text-align`.
        offCentre: Math.round(
          Math.abs((line.left + line.right) / 2 - (box.left + box.right) / 2)),
      };
    })).toEqual({ children: 1, display: 'block', offCentre: 0 });
  });

  test('the band is a flat, full-bleed rule at the top of the footer', async ({ page }) => {
    // ⚠️ Owner's second pass, 2026-08-25: "the banner shows the end of
    // the web page and start of the footer so it should be full 100%
    // horizontal and fit to footer." So the hero's tilt does NOT come
    // across, and neither does the wrapper that used to clear it.
    await page.goto('/?nosplash');
    const band = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const slab = footer.firstElementChild;
      const cs = getComputedStyle(slab);
      const strip = slab.querySelector('span');
      const sb = slab.getBoundingClientRect();
      const fb = footer.getBoundingClientRect();
      return {
        background: cs.backgroundColor,
        transform: cs.transform,
        stripColour: getComputedStyle(strip).color,
        stripOpacity: getComputedStyle(strip).opacity,
        duration: slab.firstElementChild.getAnimations()
          .map((a) => a.effect.getTiming().duration),
        // Flush with the footer's top edge, and edge to edge.
        gapAbove: Math.round(sb.top - fb.top),
        widthDelta: Math.round(sb.width - document.documentElement.clientWidth),
      };
    });

    // A solid accent slab with ink-on-accent text — not the prototype's
    // .06 tint with .5 accent text.
    expect(band.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(band.stripOpacity).toBe('1');
    expect(band.duration).toEqual([40000]);

    // Flat, flush, full width.
    expect(band.transform).toBe('none');
    expect(band.gapAbove).toBe(0);
    expect(band.widthDelta).toBe(0);
  });

  test('the four columns sit in three zones', async ({ page }) => {
    // Owner-requested: identity left, the link pair centred, status
    // right. Measured as positions rather than read off the stylesheet,
    // because `justify-self` inside a `minmax(0, 1fr)` track is exactly
    // the kind of thing that computes correctly and lays out wrong.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?nosplash');
    const zones = await page.evaluate(() => {
      const grid = document.querySelector('footer').children[1].firstElementChild;
      const [identity, group, status] = [...grid.children].map((el) => el.getBoundingClientRect());
      const page = document.documentElement.getBoundingClientRect();
      return {
        children: grid.children.length,
        linkColumns: grid.children[1].children.length,
        identityLeft: Math.round(identity.left),
        statusRight: Math.round(page.width - status.right),
        groupOffCentre: Math.round(
          Math.abs((group.left + group.right) / 2 - page.width / 2)),
      };
    });

    expect(zones.children).toBe(3);
    expect(zones.linkColumns).toBe(2);
    // Hard against the footer's own padding on both sides, which is
    // clamp(16px, 4vw, 40px) — 40px at 1440.
    expect(zones.identityLeft).toBe(40);
    expect(zones.statusRight).toBe(40);
    // Centred against the page, not merely between its neighbours.
    expect(zones.groupOffCentre).toBeLessThanOrEqual(2);
  });

  test('the footer logo lines up with the header logo', async ({ page }) => {
    // The point of going full-bleed. They were 100px apart at 1440px
    // until 2026-08-25, because the header dropped its content cap on
    // 2026-08-22 and the footer had not.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?nosplash');
    const [header, footer] = await page.evaluate(() => [
      Math.round(document.querySelector('header img').getBoundingClientRect().left),
      Math.round(document.querySelector('footer img').getBoundingClientRect().left),
    ]);
    expect(footer).toBe(header);
  });

  /* ── content ─────────────────────────────────────────────────────── */

  test('renders the four columns, the availability badge and the copyright', async ({ page }) => {
    await page.goto('/?nosplash');
    const footer = page.locator('footer');
    for (const heading of ['NAVIGATE', 'ELSEWHERE', 'STATUS']) {
      await expect(footer.getByText(heading, { exact: true })).toBeVisible();
    }
    await expect(footer.getByText('AVAILABLE FOR WORK')).toBeVisible();
    await expect(footer.getByText(/© 2026 PARINDRA GALLAGE · ALL RIGHTS RESERVED · DESIGNED & BUILT FROM SCRATCH/)).toBeVisible();
    await expect(footer.getByRole('link', { name: 'START A PROJECT →' })).toHaveAttribute('href', '#contact');
    // The logo is decorative — the name and role are real text beside it.
    await expect(footer.locator('img')).toHaveAttribute('alt', '');
  });
});
