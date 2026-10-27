import { test, expect } from '@playwright/test';

// Credentials come from the environment so this suite can run against a
// deployed environment, where the admin password is NOT the local default.
// The fallbacks match what `npm run seed` writes when SEED_ADMIN_PASSWORD
// is unset, so a plain local run needs no setup.
const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    || 'pcgallege@gmail.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin@1234!';

test.describe('Admin Authentication Flow', () => {
  test('unauthenticated users are redirected to login', async ({ page }) => {
    // Clear any existing auth. PF-108: the refresh token is what persists
    // now (the access token lives in memory only); 'portfolio_token' no
    // longer exists and removing it would clear nothing.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('portfolio_refresh'));

    await page.goto('/admin');
    // Should redirect to login
    await expect(page).toHaveURL('/admin/login');
  });

  test('admin login page displays the form', async ({ page }) => {
    await page.goto('/admin/login');
    // PF-109 — the Phase 2 heading is "Admin sign in" (the second word
    // is the outlined one). exact: true pins the copy; without it
    // Playwright matched the old casing by substring, case-insensitive,
    // and this line would have kept passing against either page.
    await expect(page.getByRole('heading', { name: 'Admin sign in', exact: true })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  // PF-119 — Google sign-in. What this CAN cover: our button reaches our
  // API, which sends the browser to Google with every parameter the flow's
  // security rests on. What it CANNOT: Google's consent screen, and the
  // callback → handoff → session leg after it (real Google cannot be driven
  // by a test). That leg is covered by backend google.auth.test.js with
  // real ID-token verification, and by the owner's manual round trip.
  test('CONTINUE WITH GOOGLE sends the browser to Google with PKCE, state and nonce', async ({ page }) => {
    // ⚠️ Intercept OUR start route, not accounts.google.com: page.route
    // never sees a redirect hop, so a handler on Google's host is skipped
    // and the browser really goes to Google (measured — the first version
    // of this test landed on Google's "invalid_client" page). Fetch the
    // real API response WITHOUT following the 302 and read where it points.
    let googleUrl = null;
    await page.route('**/api/auth/google/start**', async (route) => {
      const response = await route.fetch({ maxRedirects: 0 });
      expect(response.status()).toBe(302);
      googleUrl = new URL(response.headers().location);
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub google</p>' });
    });

    await page.goto('/admin/login');
    await page.getByRole('link', { name: 'CONTINUE WITH GOOGLE', exact: true }).click();
    await expect(page.getByText('stub google')).toBeVisible();

    expect(googleUrl).not.toBeNull();
    expect(googleUrl.origin).toBe('https://accounts.google.com');
    const p = googleUrl.searchParams;
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid email');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get('redirect_uri')).toMatch(/\/api\/auth\/google\/callback$/);
    expect(p.get('client_id')).toBeTruthy();
  });

  test('a refused Google sign-in comes back as a readable error, password door intact', async ({ page }) => {
    await page.goto('/admin/login#google_error=not_allowed');
    await expect(page.getByRole('alert')).toHaveText(/isn't an admin account/);
    // The fragment is wiped once read.
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('wrong credentials show error message', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test('correct credentials log in and redirect to dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to /admin after successful login
    await expect(page).toHaveURL('/admin', { timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  // PF-107 renamed this control and moved it. The Phase 1 sidebar had a
  // "View Site" link that opened a new tab; the rebuilt shell has the
  // prototype's "↗ HOME" in the header and "← BACK TO HOME PAGE" in the
  // new footer, both same-tab react-router links. The feature moved, it
  // did not disappear — which is exactly the case where a stale E2E
  // assertion goes red while every unit test stays green.
  test('the shell offers a way back to the public site', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // exact: true — getByRole matches by SUBSTRING in Playwright, and
    // "HOME" is contained in "BACK TO HOME PAGE". Without it this is a
    // strict-mode violation, not a pass.
    const home = page.getByRole('link', { name: '↗ HOME', exact: true });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('href', '/?nosplash=1');

    const back = page.getByRole('link', { name: '← BACK TO HOME PAGE', exact: true });
    await expect(back).toHaveAttribute('href', '/?nosplash=1');
  });

  test('the shell shows the signed-in account, not a hardcoded address', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // Scoped to the header: the footer's session column shows the same
    // address, so an unscoped locator is a strict-mode violation.
    await expect(
      page.locator('header').getByText(ADMIN_EMAIL, { exact: true }),
    ).toBeVisible();
  });

  // PF-110. The Overview's four stat cards and the sidebar badges read
  // ONE request, GET /api/dashboard/stats. This drives the real endpoint
  // against the seeded e2e database rather than a stub, so a route that
  // 401s, a badge that stays blank, or a card that never leaves its
  // skeleton all fail here and nowhere in the unit suite.
  test('the overview shows the dashboard counts from one request', async ({ page }) => {
    const statsRequests = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/dashboard/stats')) statsRequests.push(r.url());
    });

    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // Every card's value is a digit once the request lands. Scoped to
    // main: the sidebar repeats "Projects" / "Skills" as nav labels.
    const main = page.getByRole('main');
    for (const label of ['PROJECTS', 'SKILLS', 'PUBLISHED POSTS', 'UNREAD MESSAGES']) {
      const card = main.getByText(label, { exact: true }).locator('..');
      await expect(card).toHaveText(/[0-9]+/);
    }

    // The seed writes projects and skills, so those two badges carry a
    // number; Overview and About never do (the prototype's own choice).
    const nav = page.getByRole('navigation', { name: 'Admin sections' });
    await expect(nav.getByRole('button', { name: /Projects/ })).toHaveText(/[1-9][0-9]*/);
    await expect(nav.getByRole('button', { name: /Skills/ })).toHaveText(/[1-9][0-9]*/);
    await expect(nav.getByRole('button', { name: /Overview/ })).not.toHaveText(/[0-9]/);

    // One call feeds the cards, the badges and the footer — not one each.
    expect(statsRequests).toHaveLength(1);
  });

  test('the overview quick actions land on their panels', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');

    // + NEW POST is the one that needs more than a tab switch: the blog
    // panel mounts in list view and must arrive with its editor open.
    await page.getByRole('button', { name: '+ NEW POST', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Blog', exact: true })).toBeVisible();
    // PF-115: the prototype's casing, `New post` (Admin.dc.html:1191).
    await expect(page.getByRole('heading', { name: 'New post', exact: true })).toBeVisible();

    // Back to the overview by the sidebar, then a plain tab-switch action.
    await page.getByRole('navigation', { name: 'Admin sections' })
      .getByRole('button', { name: /Overview/ }).click();
    await page.getByRole('button', { name: 'EDIT PROFILE', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();

    // PF-131. Folded into this test, not a new one: every sign-in spends the
    // authLimiter budget. Settings is reached from the sidebar, and its Account
    // card names the address this login typed — through the real /auth/me.
    await page.getByRole('navigation', { name: 'Admin sections' })
      .getByRole('button', { name: /Settings/ }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    const account = page.getByRole('region', { name: 'Account', exact: true });
    await expect(account.getByText('Signed in as', { exact: true }).locator('xpath=following-sibling::dd'))
      .toHaveText(ADMIN_EMAIL);

    // PF-124. A wrong current password, through the real server: refused
    // with its own sentence (a 400, never a 401) and the session survives.
    // Nothing is changed — the e2e password stays the seed's.
    const password = page.getByRole('region', { name: 'Password', exact: true });
    await password.getByRole('button', { name: /CHANGE PASSWORD/ }).click();   // the fold
    await password.getByLabel('Current password', { exact: true }).fill('not the password');
    await password.getByLabel('New password', { exact: true }).fill('a long new pass phrase');
    await password.getByLabel('Repeat new password', { exact: true }).fill('a long new pass phrase');
    await password.getByRole('button', { name: 'SEND CODE', exact: true }).click();
    await expect(password.getByText('Your current password is wrong.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });
});

// ── PF-118 batch 2 — leaving unsaved work asks first ────────────────────────
// In THIS file, not a new spec: CI's credential-scan allows the seed password
// only in seed.js, e2e/admin.spec.js and postman/, and these tests sign in.
// None of them saves anything — every path is Keep or Discard — so the e2e
// database is not written to.
test.describe('Unsaved changes guard (PF-118 batch 2)', () => {
  const signIn = async (page) => {
    // Start on the home page so the browser's Back has somewhere to go.
    await page.goto('/?nosplash');
    await page.goto('/admin/login');
    await page.fill('input[type="email"]',    ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/admin');
  };
  const nav = (page) => page.getByRole('navigation', { name: 'Admin sections' });
  const openProjectsAndType = async (page) => {
    await nav(page).getByRole('button', { name: /Projects/ }).click();
    await page.getByLabel('Title', { exact: true }).fill('E2E unsaved idea');
  };
  const dialog = (page) => page.getByRole('dialog');

  // ⚠️ ONE sign-in for these three checks, on purpose. authLimiter (10 logins /
  // 15 min) is live under E2E, and five separate sign-ins pushed a repeated run
  // into "Too many login attempts" — measured 2026-10-12. A shared storageState
  // is NOT an option: the refresh token ROTATES, and replaying a used one trips
  // reuse detection and revokes the whole session family.
  test('in-app exits: zero case, panel switch (KEEP / DISCARD) and ↗ HOME', async ({ page }) => {
    await signIn(page);

    // Zero case first: nothing typed → panels switch with no question.
    await nav(page).getByRole('button', { name: /Projects/ }).click();
    await nav(page).getByRole('button', { name: /Skills/ }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();

    // A half-typed project, then a panel switch: asked; KEEP keeps the typing.
    await openProjectsAndType(page);
    await nav(page).getByRole('button', { name: /Skills/ }).click();
    await expect(dialog(page)).toContainText('Your new project has changes');
    await dialog(page).getByRole('button', { name: 'KEEP EDITING', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('E2E unsaved idea');

    // ↗ HOME (a router link) is held too.
    await page.getByRole('link', { name: '↗ HOME', exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole('button', { name: 'KEEP EDITING', exact: true }).click();
    await expect(page).toHaveURL('/admin');

    // DISCARD actually goes.
    await nav(page).getByRole('button', { name: /Skills/ }).click();
    await dialog(page).getByRole('button', { name: 'DISCARD & LEAVE', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();
  });

  test('the browser Back button is held while dirty', async ({ page }) => {
    await signIn(page);
    // ⚠️ Build the history IN-APP. `page.goto` loads a new DOCUMENT, and Back
    // across documents is a real browser navigation React cannot intercept —
    // that case gets the browser's own beforeunload prompt (the next test).
    // Back WITHIN the app is a popstate, and that is what the dialog holds.
    await page.getByRole('link', { name: '↗ HOME', exact: true }).click();
    await page.waitForURL(/\/\?nosplash/);
    await page.getByRole('link', { name: 'ADMIN', exact: true }).click();
    await page.waitForURL('/admin');
    await openProjectsAndType(page);

    await page.goBack();
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL('/admin');
    await dialog(page).getByRole('button', { name: 'DISCARD & LEAVE', exact: true }).click();
    // The home page drops `?nosplash` from the URL once it has read it.
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('closing the tab while dirty raises the browser prompt', async ({ page }) => {
    await signIn(page);
    await openProjectsAndType(page);

    const prompt = new Promise((resolve) => page.once('dialog', async (d) => {
      resolve(d.type());
      await d.accept();
    }));
    await page.close({ runBeforeUnload: true });
    expect(await prompt).toBe('beforeunload');
  });
});
