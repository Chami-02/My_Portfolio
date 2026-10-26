import { test, expect } from '@playwright/test';

// PF-125 — forgot password, through the real frontend and backend.
//
// What this CAN cover: the link, both steps, the same answer for an address
// that does not exist, and the server refusing a wrong code. What it CANNOT:
// reading the emailed code — mail is OFF in E2E (`.env.e2e` blanks GMAIL_*),
// so no code is ever sent. The full code → new password → sessions revoked
// path is proved in backend auth.passwordReset.test.js (with the code read
// from the mocked email) and by the owner's live check.
//
// Budget: forgotLimiter is 5 / 15 min and resetLimiter 10 / 15 min per IP;
// this spec spends one of each.

test('Forgot password? → code step → a wrong code is refused', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email address').fill('nobody@example.com');
  await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();

  await expect(page).toHaveURL('/admin/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset password', exact: true })).toBeVisible();
  // The typed address came along.
  await expect(page.getByLabel('Email address')).toHaveValue('nobody@example.com');

  await page.getByRole('button', { name: 'SEND CODE →', exact: true }).click();
  // The one answer for ANY address — this one exists nowhere — with the
  // address read back so a typo shows.
  await expect(page.getByRole('status')).toContainText('If nobody@example.com can sign in here, a reset code is on its way.');

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByLabel(/^New password/).fill('a long new pass phrase');
  await page.getByLabel('Repeat new password').fill('a long new pass phrase');
  await page.getByRole('button', { name: 'RESET PASSWORD →', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('That code is wrong or has expired.');
  await expect(page).toHaveURL('/admin/forgot-password');
});
