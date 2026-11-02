import { test, expect } from '@playwright/test';

/**
 * PF-143 — Education + Certificates: the home row and /certificates, through
 * the REAL stack (the e2e seed writes two education entries, two published
 * certificates and one draft).
 *
 * ⚠️ No sign-in here: the authLimiter allows 10 per 15 minutes and a run
 * already spends 9 (CLAUDE.md, E2E traps). The admin panels are covered by
 * their unit tests; this file proves the public journey end to end.
 *
 * ONE page journey per test, to stay well inside the 100 req / 15 min global
 * limiter (blog.spec.js's lesson). Selected by role, text and href only — CSS
 * Modules hash class names in the build.
 */

test('home → VIEW ALL → a certificate\'s big view → Back closes it', async ({ page }) => {
  await page.goto('/?nosplash=1#about');

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Education', exact: true })).toBeVisible();
  await expect(main.getByText('University of Westminster', { exact: true })).toBeVisible();

  // Only PUBLISHED certificates: the seed's draft never reaches the site.
  await expect(main.getByRole('link', { name: 'Data Scientist in Python', exact: true })).toBeVisible();
  await expect(main.getByText('GitHub Foundations')).toHaveCount(0);

  await main.getByRole('link', { name: 'VIEW ALL CERTIFICATES →' }).click();
  await expect(page).toHaveURL(/\/certificates$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Certificates' })).toBeVisible();
  await expect(page.getByText('2 CERTIFICATES')).toBeVisible();

  await page.getByRole('link', { name: /Data Scientist in Python/ }).click();
  await expect(page).toHaveURL(/\/certificates\/data-scientist-in-python-datacamp$/);
  const dialog = page.getByRole('dialog', { name: 'Data Scientist in Python' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('2 / 2')).toBeVisible();

  // ← steps (replacing the URL), and Back still closes rather than stepping back.
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', { name: /Oracle Cloud/ })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/certificates$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a shared certificate link opens its big view directly; Esc shows the grid', async ({ page }) => {
  await page.goto('/certificates/data-scientist-in-python-datacamp');
  await expect(page.getByRole('dialog', { name: 'Data Scientist in Python' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/certificates$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Oracle Cloud/ })).toBeVisible();
});
