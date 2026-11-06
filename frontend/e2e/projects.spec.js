import { test, expect } from '@playwright/test';

/**
 * PF-144 — the projects journey through the REAL stack: the e2e seed writes
 * four published projects (seed.js), each given a slug and a one-section page
 * by the model, and a category.
 *
 * ⚠️ No sign-in: the authLimiter budget belongs to admin.spec.js. ONE page
 * journey per test (the 100 req / 15 min global limiter). Selected by role,
 * text and href only — CSS Modules hash class names in the build.
 */

// PF-150 — the public answer through the real API. The seed's visits are zero,
// and automated browsers are not counted, so this asserts labels, never a count.
test('the home page shows the site numbers where the terminal was', async ({ page }) => {
  await page.goto('/?nosplash=1#projects');

  const box = page.getByRole('region', { name: 'Site numbers', exact: true });
  await expect(box.getByText('VISITS', { exact: true })).toBeVisible();
  await expect(box.getByText('COUNTRIES', { exact: true })).toBeVisible();
  await expect(box.getByText('BLOG READS', { exact: true })).toBeVisible();
  await expect(box.getByText(/^Updated /)).toBeVisible();
  await expect(page.getByText('docker compose up')).toHaveCount(0);
});

test('home → VIEW ALL → search + chip → a project → BACK TO RESULTS', async ({ page }) => {
  await page.goto('/?nosplash=1#projects');

  const section = page.locator('#projects');
  // Picture-on-top cards: one link each, named by the title.
  await expect(section.getByRole('link', { name: 'ClearDrive.lk', exact: true })).toBeVisible();
  // GitHub links moved to the project's page.
  await expect(section.getByRole('link', { name: /VIEW ON GITHUB/ })).toHaveCount(0);

  await section.getByRole('link', { name: 'VIEW ALL PROJECTS →' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Built');
  await expect(page.getByText('4 PROJECTS · ALL')).toBeVisible();

  // PF-138: one spelling mistake is forgiven — through the real MongoDB.
  await page.getByRole('textbox', { name: /Search projects/ }).fill('dokcer');
  await expect(page).toHaveURL(/\?q=dokcer$/);
  await expect(page.getByText('2 OF 4 PROJECTS')).toBeVisible();

  // The search reaches the page's sections, not only the title.
  await page.getByRole('textbox', { name: /Search projects/ }).fill('docker');
  await expect(page).toHaveURL(/\?q=docker$/);
  await expect(page.getByText('2 OF 4 PROJECTS')).toBeVisible();

  await page.getByRole('group', { name: 'Filter by category' })
    .getByRole('button', { name: 'Web App', exact: true }).click();
  await expect(page).toHaveURL(/category=Web\+App/);

  await page.getByRole('link', { name: 'ClearDrive.lk', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/cleardrivelk$/);
  await expect(page.getByRole('heading', { level: 1, name: 'ClearDrive.lk' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Description/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /VIEW ON GITHUB/ })).toHaveAttribute('target', '_blank');

  await page.getByRole('link', { name: '← BACK TO RESULTS' }).first().click();
  await expect(page).toHaveURL(/\/projects\?q=docker&category=Web\+App$/);
  await expect(page.getByText('2 OF 4 PROJECTS')).toBeVisible();
});

test('a shared project link opens its page; an unknown one keeps the URL', async ({ page }) => {
  await page.goto('/projects/smart-campus-api');
  await expect(page.getByRole('heading', { level: 1, name: 'Smart Campus API' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'More projects' })).toBeVisible();

  await page.goto('/projects/no-such-project');
  await expect(page.getByRole('status')).toContainText('That project is not here');
  await expect(page).toHaveURL(/\/projects\/no-such-project$/);
});
