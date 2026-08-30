import { test, expect } from '@playwright/test';

/**
 * ⚠️ This file was STALE PHASE 1 until PF-87 — the FIFTH such spec, after
 * the four PF-84 found in `homepage.spec.js` and `navigation.spec.js`.
 * It is not listed in PF-87's own Step 1, which points only at
 * `homepage.spec.js`'s vacuous "Get In Touch" test, so it surfaced by
 * running the suite rather than by reading the ticket.
 *
 * Both failure shapes this repo documents were present in one file:
 *
 *   `shows success state after valid submission` — FAILED. It asserted
 *   Phase 1's success copy, `text=Message received`. The Phase 2 string
 *   is "✓ Message sent — I'll reply within 24 hours." Unit-green +
 *   E2E-red, the signature of a replaced feature whose tests were not
 *   updated.
 *
 *   `empty form cannot be submitted (HTML5 validation)` — PASSED while
 *   asserting nothing. Phase 1's inputs carried `required`, so the
 *   browser blocked the submit. Phase 2 deliberately has neither
 *   `required` nor `type="email"` and sets `noValidate` (the prototype's
 *   own choice — native validation bubbles have no treatment in this
 *   design); JS blocks it instead. The old assertions — "the name input
 *   is still visible" and "Phase 1's success text is absent" — are both
 *   true whether validation runs or not, and would stay true if it were
 *   deleted entirely.
 *
 * `?nosplash` in beforeEach for the reason PF-84 recorded: without it
 * every test waits out the ~5.65s splash, because Playwright will not
 * click through a z-index-100 overlay and retries until it unmounts.
 * That is a slow suite rather than a red one, so nothing draws attention
 * to it.
 */
test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?nosplash');
    await page.evaluate(() => document.getElementById('contact')?.scrollIntoView());
    await page.waitForTimeout(500);
  });

  test('contact form is visible', async ({ page }) => {
    await expect(page.locator('#contact')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
  });

  test('shows the Phase 2 success state after a valid submission', async ({ page }) => {
    await page.fill('input[name="name"]', 'Test Recruiter');
    await page.fill('input[name="email"]', 'recruiter@company.com');
    // ≥10 characters: the backend requires it (contactController's
    // contactRules) while the client check only requires non-empty, so a
    // short message would exercise the server's error path instead.
    await page.fill('textarea[name="message"]',
      'Hi! I would love to discuss a junior developer role with you.');

    await page.click('#contact button[type="submit"]');

    await expect(page.getByRole('status'))
      .toHaveText("✓ Message sent — I'll reply within 24 hours.", { timeout: 8000 });
    // Cleared on success only. The unit suite covers the failure half,
    // where a typed message must survive a network blip.
    await expect(page.locator('input[name="name"]')).toHaveValue('');
    await expect(page.locator('textarea[name="message"]')).toHaveValue('');
  });

  /**
   * Replaces the HTML5-validation test. This one asserts the mechanism
   * that actually runs: the JS check, its error copy, and — the part the
   * old test could not express — that nothing reached the network.
   */
  test('blocks an empty submit in JS and says why', async ({ page }) => {
    let requests = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/contact')) requests += 1;
    });

    await page.click('#contact button[type="submit"]');

    await expect(page.getByRole('alert')).toHaveText('All three fields are required.');
    expect(requests).toBe(0);
    // The form is still there to correct, and still enabled.
    await expect(page.getByRole('button', { name: /send message/i })).toBeEnabled();
  });

  test('rejects a malformed email before sending', async ({ page }) => {
    let requests = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/contact')) requests += 1;
    });

    await page.fill('input[name="name"]', 'Test Recruiter');
    await page.fill('input[name="email"]', 'not-an-email');
    await page.fill('textarea[name="message"]', 'A message comfortably over ten characters.');
    await page.click('#contact button[type="submit"]');

    await expect(page.getByRole('alert')).toHaveText('That email address looks off.');
    expect(requests).toBe(0);
  });

  /**
   * The email field is `type="text"` with `inputmode="email"`, so the
   * browser must NOT be validating it — that is what lets the JS message
   * above be the one the visitor sees.
   */
  test('uses no native validation on the email field', async ({ page }) => {
    const email = page.locator('input[name="email"]');
    await expect(email).toHaveAttribute('type', 'text');
    await expect(email).toHaveAttribute('inputmode', 'email');
    await expect(page.locator('#contact form')).toHaveAttribute('novalidate', '');
  });
});
