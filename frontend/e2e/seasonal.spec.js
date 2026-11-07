import { test, expect } from '@playwright/test';

/**
 * Seasonal effects — PF-151. What a unit test cannot reach: the real routes (the
 * sign-in page shows none), the real click path through a canvas
 * in front of the page, and the splash.
 *
 * Every test answers About itself, so the switch is exercised without a sign-in
 * (the E2E sign-in budget is small) and whatever the date the suite runs on. The
 * star field is the page's other canvas, so "the fall shows" is two canvases.
 */
const answerAbout = async (page, seasonalEffect) => {
  await page.route(/\/api\/about$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.seasonalEffect = seasonalEffect;
    await route.fulfill({ response, json: body });
  });
};

test.describe('Seasonal effects (PF-151)', () => {
  test('the switch shows the fall on a public page', async ({ page }) => {
    await answerAbout(page, 'snow');
    await page.goto('/blog');
    await expect(page.locator('canvas')).toHaveCount(2);
  });

  test('OFF shows none', async ({ page }) => {
    await answerAbout(page, 'off');
    // Waited for: the count below is also true BEFORE the answer arrives, and ending
    // the test while the stub is still working fails it ("Response has been disposed").
    const answered = page.waitForResponse(/\/api\/about$/);
    await page.goto('/blog');
    await answered;
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  // The panel shows it too (owner, 2026-11-06), but that needs a sign-in, which
  // this file avoids: AdminLayout.test.jsx and the report's browser check cover it.
  test('never on the sign-in page', async ({ page }) => {
    await answerAbout(page, 'snow');
    await page.goto('/admin/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('a visitor with reduced motion gets none', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await answerAbout(page, 'snow');
    await page.goto('/blog');
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('the home page waits for the splash, then falls', async ({ page }) => {
    await answerAbout(page, 'halloween');
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveCount(2, { timeout: 10_000 });
  });

  test('a click goes straight through it', async ({ page }) => {
    await answerAbout(page, 'snow');
    await page.goto('/blog');
    await expect(page.locator('canvas')).toHaveCount(2);

    // The header's links sit under the fall (65 over 60), no scrolling needed.
    const hit = await page.locator('header a').first().evaluate((link) => {
      const box = link.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return top === link || link.contains(top);
    });
    expect(hit).toBe(true);

    // The control: the same probe does see the canvas once it may take clicks,
    // so the pass above is not a probe that cannot fail.
    const blocked = await page.locator('header a').first().evaluate((link) => {
      const fall = [...document.querySelectorAll('canvas')].find((c) => getComputedStyle(c).zIndex === '65');
      fall.style.pointerEvents = 'auto';
      const box = link.getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === fall;
    });
    expect(blocked).toBe(true);
  });
});
