import { test, expect } from '@playwright/test';

/**
 * /blog — the Field Notes index. PF-98.
 *
 * ⚠️ MOSTLY STUBBED, and the first draft of this file was not — that is the
 * lesson worth keeping. Driving eleven real navigations through the live
 * stack pushed the WHOLE suite past the backend's 100 req / 15 min / IP
 * limiter, and a rate-limited run does not fail loudly: every section renders
 * its error state, the chip row comes back with only 'All', and the failure
 * reads as "the feature is broken". Measured, not theorised — the first run
 * failed with `Expected: > 2, Received: 1` chips and printed 429s for
 * Skills, Projects, Blog and Contact in specs this ticket never touched.
 *
 * So exactly ONE test below runs against the real stack, to prove the route
 * and both real endpoints actually serve the page. Everything else stubs, and
 * gets determinism for free.
 *
 * ⚠️ Class selectors are unavailable regardless: CSS Modules hash every local
 * name in the production build. This file selects by role, text and href.
 * Everything is scoped to `main` — the footer repeats section anchors and the
 * marquee repeats copy, and an unscoped locator turns that into a strict-mode
 * throw that reads exactly like the feature being gone.
 */

const POSTS = [
  { _id: 'p1', title: 'Newest Post', slug: 'newest-post', excerpt: 'The most recent one.',
    tags: ['React', 'MERN'], readingTimeMinutes: 6, publishedAt: '2026-07-14T09:00:00.000Z' },
  { _id: 'p2', title: 'Second Post', slug: 'second-post', excerpt: 'The second one.',
    tags: ['Docker'], readingTimeMinutes: 7, publishedAt: '2026-06-14T09:00:00.000Z' },
  { _id: 'p3', title: 'Third Post', slug: 'third-post', excerpt: 'The third one.',
    tags: ['Docker', 'DevOps'], readingTimeMinutes: 4, publishedAt: '2026-05-14T09:00:00.000Z' },
  { _id: 'p4', title: 'Fourth Post', slug: 'fourth-post', excerpt: 'The fourth one.',
    tags: ['Java'], readingTimeMinutes: 5, publishedAt: '2026-04-14T09:00:00.000Z' },
];

/**
 * ⚠️ The tag pool deliberately carries a value NO post uses (`Agile`), and
 * that is what makes the chip-row test below discriminating. A pool that
 * happened to equal the posts' tags would pass whether the chips came from
 * the vocabulary endpoint or were derived from the posts.
 */
const TAGS = ['React', 'MERN', 'Docker', 'DevOps', 'Java', 'Agile'];

const json = (data) => ({ json: { status: 'success', data } });

/**
 * ⚠️ The catch-all is registered FIRST on purpose. `page.route()` matches
 * handlers in REVERSE registration order, so a narrow route registered before
 * a a catch-all on every `/api/` path is silently overridden by it.
 */
async function stubApi(page) {
  await page.route('**/api/**', (route) => route.fulfill(json([])));

  await page.route('**/api/vocabulary/**', (route) =>
    route.fulfill(json(TAGS.map((value, i) => ({ _id: `v${i}`, type: 'tag', value })))));

  // Mirrors backend/src/utils/blogQuery.js `buildMatch`. Kept deliberately
  // close to it, because a stub that filters differently from the server
  // makes an E2E suite assert the stub rather than the app.
  //
  // ⚠️ `getAll`, not `get` — PF-105 made the filter multi-tag, and `get`
  // would silently honour only the first, which is exactly the shape of
  // the server bug that ticket fixed.
  //
  // Tags AND together (a post must carry every selected one), each matched
  // exactly and case-insensitively, `'All'` means no filter, and the tag
  // set ANDs with `q`.
  //
  // ⚠️ `q` here covers title + excerpt + tags only. PF-104 widened the
  // REAL query to section headings, paragraphs and bullets too — these
  // fixtures carry no `sections`, so the two cannot disagree on this data.
  // If a fixture ever gains sections, this stub has to grow with it.
  await page.route('**/api/blog**', (route) => {
    const url  = new URL(route.request().url());
    const q    = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const tags = url.searchParams.getAll('tag')
      .filter((t) => t && t.toLowerCase() !== 'all');

    let list = POSTS;
    for (const tag of tags) {
      list = list.filter((p) => p.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    }
    if (q) {
      list = list.filter((p) =>
        `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(q));
    }
    return route.fulfill(json(list));
  });
}

const main = (page) => page.locator('main');
const cards = (page) => main(page).locator('a[href^="/blog/"]');
const search = (page) => main(page).getByLabel('Search posts, tags and tools');
const chip = (page, name) => main(page).getByRole('button', { name, exact: true });

/**
 * The chip row's LABELS, in order.
 *
 * ⚠️ This assertion used to be `main(page).getByRole('button')` counted
 * against a number — every button in the landmark, standing in for "the
 * chips". It broke the moment PF-104 added a search-submit button inside
 * `main`, reporting 8 where 7 was expected, and the failure message named
 * the chip row rather than the real cause.
 *
 * Same family as the documented `[class*="name"]` trap: a locator that
 * selects the right set today for a reason that is not the one the
 * assertion is about.
 *
 * Returning NAMES rather than a count fixes it properly. The search and
 * clear controls are icon-only, so their text is empty and they filter out
 * on their own — no exclusion list to keep in step. And the result says
 * WHICH chips are present, so a row that kept its length while swapping a
 * tag fails too, where a count could not tell.
 */
const chipLabels = (page) =>
  main(page)
    .locator('form[role="search"] button')
    .allTextContents()
    .then((labels) => labels.map((t) => t.trim()).filter(Boolean));

test.describe('/blog index (PF-98)', () => {

  /**
   * THE ONE REAL-STACK TEST. The regression this ticket exists to fix: PF-86
   * pointed five Blog-teaser links at /blog, which had no route, so every one
   * of them rendered NotFoundPage — a dead end two clicks from the home page.
   * Unstubbed, so it also proves `GET /api/blog` and
   * `GET /api/vocabulary/tag?inUse=true` really do serve this page.
   */
  test('is a real page served by the real API, not the 404', async ({ page }) => {
    await page.goto('/blog');
    await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(/Field\s+Notes/);
    await expect(main(page).getByText('THE JOURNAL')).toBeVisible();
    await expect(page.getByText("This page doesn't exist.")).toHaveCount(0);
    await expect(cards(page).first()).toBeAttached();
  });

  test.describe('with a stubbed API', () => {
    test.beforeEach(async ({ page }) => { await stubApi(page); });

    test('renders the featured post and the rest as a grid', async ({ page }) => {
      await page.goto('/blog');
      await expect(main(page).getByText('Newest Post')).toBeVisible();
      await expect(cards(page)).toHaveCount(4);
      await expect(main(page).getByText('4 POSTS · ALL TOPICS')).toBeVisible();
    });

    test('every card links to its own post URL', async ({ page }) => {
      await page.goto('/blog');
      await expect(cards(page)).toHaveCount(4);
      expect(await cards(page).evaluateAll((els) => els.map((e) => e.getAttribute('href'))))
        .toEqual([
          '/blog/newest-post', '/blog/second-post',
          '/blog/third-post', '/blog/fourth-post',
        ]);
    });

    /* ── filtering ────────────────────────────────────────────────── */

    test('a tag chip filters the grid and marks itself pressed', async ({ page }) => {
      await page.goto('/blog');
      await expect(cards(page)).toHaveCount(4);

      await chip(page, 'Docker').click();

      await expect(page).toHaveURL(/\?tag=Docker$/);
      await expect(chip(page, 'Docker')).toHaveAttribute('aria-pressed', 'true');
      await expect(cards(page)).toHaveCount(2);
      await expect(main(page).getByText('2 OF 4 POSTS')).toBeVisible();
    });

    /**
     * ⚠️ THE LOCKED DECISION (2026-09-04), and the thing only a two-endpoint
     * run can prove.
     *
     * Chips come from `GET /api/vocabulary/tag?inUse=true`, NOT from the
     * fetched posts the way the prototype does it (Blog.dc.html:327). PF-96
     * made `?q=`/`?tag=` server-side, so the list arrives already filtered —
     * derived chips would SHRINK as you filter and a visitor would watch
     * their own filter options disappear.
     *
     * Discriminating by construction: the pool carries `Agile`, which no post
     * uses, so a derived row is SHORTER than the pool even before filtering.
     */
    test('the chip row is the tag pool, and does not shrink as posts filter', async ({ page }) => {
      await page.goto('/blog');
      await expect(chip(page, 'Agile')).toBeVisible();   // in the pool, on no post
      await expect.poll(() => chipLabels(page)).toEqual(['All', ...TAGS]);

      await chip(page, 'Docker').click();
      await expect(cards(page)).toHaveCount(2);          // the posts really narrowed
      await expect.poll(() => chipLabels(page)).toEqual(['All', ...TAGS]);  // chips did not
      await expect(chip(page, 'Agile')).toBeVisible();
    });

    test('search filters the grid and lands in the URL', async ({ page }) => {
      await page.goto('/blog');
      await search(page).fill('docker');
      await expect(page).toHaveURL(/\?q=docker$/);
      await expect(cards(page)).toHaveCount(2);
    });

    /**
     * The debounce and `replace`, tested by their EFFECT rather than by
     * timing: six characters typed one at a time must add ZERO history
     * entries. Undebounced-and-pushed they would add six, and the back button
     * would then walk backwards through a half-typed word one letter at a
     * time.
     *
     * ⚠️ The first version of this test asserted that one Back returns to
     * `/blog`, and that was wrong about its own subject — `replace` means the
     * `/blog` entry is OVERWRITTEN, so there is nothing to go back to and
     * Back leaves the site entirely. `history.length` is the property
     * actually under test, so it is what gets asserted.
     */
    test('a typed search adds no history entries at all', async ({ page }) => {
      await page.goto('/blog');
      const before = await page.evaluate(() => history.length);

      await search(page).pressSequentially('docker', { delay: 60 });
      await expect(page).toHaveURL(/\?q=docker$/);

      expect(await page.evaluate(() => history.length)).toBe(before);
    });

    /**
     * The counterpart, and the reason the two are separated: choosing a tag
     * DOES push, so the back button steps through tag changes. That is the
     * useful granularity — a filter is a place you were, a half-typed search
     * term is not.
     */
    test('choosing a tag DOES add one history entry', async ({ page }) => {
      await page.goto('/blog');
      const before = await page.evaluate(() => history.length);

      await chip(page, 'Docker').click();
      await expect(page).toHaveURL(/tag=Docker/);

      expect(await page.evaluate(() => history.length)).toBe(before + 1);
    });

    test('a filtered URL loads filtered, so the link is shareable', async ({ page }) => {
      await page.goto('/blog?tag=Docker&q=second');
      await expect(search(page)).toHaveValue('second');
      await expect(chip(page, 'Docker')).toHaveAttribute('aria-pressed', 'true');
      await expect(cards(page)).toHaveCount(1);
    });

    test('the back button undoes a tag choice', async ({ page }) => {
      await page.goto('/blog');
      await chip(page, 'Docker').click();
      await expect(page).toHaveURL(/tag=Docker/);

      await page.goBack();
      await expect(page).toHaveURL(/\/blog$/);
      await expect(chip(page, 'All')).toHaveAttribute('aria-pressed', 'true');
      await expect(cards(page)).toHaveCount(4);
    });

    /* ── empty state ──────────────────────────────────────────────── */

    test('a search matching nothing shows the empty state, and RESET clears it', async ({ page }) => {
      await page.goto('/blog?q=zzzznomatchanywhere');

      await expect(main(page).getByText('Nothing filed under that')).toBeVisible();
      await expect(main(page).getByText('Try another keyword or clear the filters.')).toBeVisible();
      await expect(cards(page)).toHaveCount(0);

      await main(page).getByRole('button', { name: 'RESET FILTERS' }).click();
      await expect(page).toHaveURL(/\/blog$/);
      await expect(search(page)).toHaveValue('');
      await expect(cards(page)).toHaveCount(4);
    });

    /* ── search controls and clearing (PF-104) ──────────────────────── */

    test('the search button runs the search without waiting for the debounce', async ({ page }) => {
      await page.goto('/blog');
      // `pressSequentially` types character by character, so the debounce is
      // genuinely mid-flight when the button is clicked — `fill()` would set
      // the value in one shot and prove less.
      await search(page).pressSequentially('docker', { delay: 10 });
      // ⚠️ `exact: true` is load-bearing. Playwright matches an accessible
      // name by case-insensitive SUBSTRING by default, so 'Search' also
      // resolves "Clear search" and the click fails on a strict-mode
      // violation. testing-library's getByRole matches a string name in
      // full, which is why the unit test for this passes without it — the
      // two libraries differ, and the E2E one is the permissive one.
      await main(page).getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page).toHaveURL(/\?q=docker$/);
      await expect(cards(page)).toHaveCount(2);
    });

    test('Enter submits, because the field is inside a real form', async ({ page }) => {
      await page.goto('/blog');
      await search(page).pressSequentially('docker', { delay: 10 });
      await search(page).press('Enter');
      await expect(page).toHaveURL(/\?q=docker$/);
    });

    test('the clear button empties the field, the URL and the filter', async ({ page }) => {
      await page.goto('/blog?q=docker');
      await expect(cards(page)).toHaveCount(2);

      await main(page).getByRole('button', { name: 'Clear search' }).click();
      await expect(page).toHaveURL(/\/blog$/);
      await expect(search(page)).toHaveValue('');
      await expect(cards(page)).toHaveCount(4);
    });

    test('clicking the ACTIVE chip clears the tag instead of re-picking it', async ({ page }) => {
      await page.goto('/blog?tag=Docker');
      await expect(cards(page)).toHaveCount(2);

      await chip(page, 'Docker').click();
      await expect(page).toHaveURL(/\/blog$/);
      await expect(cards(page)).toHaveCount(4);
    });

    test('CLEAR ALL drops both filters at once, from a page with results', async ({ page }) => {
      // ⚠️ The gap this closes: RESET FILTERS only ever rendered inside the
      // EMPTY state, so a visitor looking at results had no visible way to
      // clear anything. This URL deliberately still matches a post.
      await page.goto('/blog?q=docker&tag=Docker');
      await expect(cards(page)).toHaveCount(2);

      await main(page).getByRole('button', { name: 'CLEAR ALL' }).click();
      await expect(page).toHaveURL(/\/blog$/);
      await expect(cards(page)).toHaveCount(4);
    });

    test('several chips filter with AND, and each pill clears only itself', async ({ page }) => {
      await page.goto('/blog');
      await chip(page, 'Docker').click();
      await expect(page).toHaveURL(/\?tag=Docker$/);

      // ⚠️ DevOps is the reachable pair here. Only one stubbed post carries
      // Docker AND DevOps, so this also proves AND rather than OR — under
      // OR the count would go UP, not down.
      await chip(page, 'DevOps').click();
      await expect(page).toHaveURL(/tag=Docker&tag=DevOps/);
      await expect(cards(page)).toHaveCount(1);

      // Each summary pill drops only its own tag.
      await main(page).getByRole('button', { name: 'Clear the DevOps tag filter' }).click();
      await expect(page).toHaveURL(/\?tag=Docker$/);
      await expect(cards(page)).toHaveCount(2);
    });

    test('a chip whose combination has no posts is disabled', async ({ page }) => {
      await page.goto('/blog?tag=Docker');
      // Nothing carries Docker AND React; something carries Docker AND
      // DevOps. Both asserted, so a rule disabling everything or nothing
      // fails one of them.
      await expect(chip(page, 'React')).toBeDisabled();
      await expect(chip(page, 'DevOps')).toBeEnabled();
      await expect(chip(page, 'Docker')).toBeEnabled();   // still removable
    });

    test('the empty state names the term that found nothing', async ({ page }) => {
      await page.goto('/blog?q=zzzznomatchanywhere&tag=Docker');
      await expect(
        main(page).getByText('No posts match "zzzznomatchanywhere" tagged DOCKER.'),
      ).toBeVisible();
    });

    /* ── chrome ───────────────────────────────────────────────────── */

    /**
     * The Blog nav variant has existed since PF-86 and rendered over
     * NotFoundPage until now. It must survive the route landing under it.
     */
    test('keeps the Blog chrome now that the route resolves', async ({ page }) => {
      await page.goto('/blog');
      const header = page.locator('header');
      await expect(header.getByRole('link', { name: 'PROJECTS' })).toBeVisible();
      // PF-103: '← GO BACK', not the prototype's '← PORTFOLIO'.
      await expect(header.getByRole('link', { name: /GO BACK/ })).toBeVisible();
      await expect(header.getByRole('link', { name: 'BLOG' })).toHaveCount(0);
      await expect(header.locator('a[href^="#"]')).toHaveCount(0);
      await expect(page.locator('footer')).toBeVisible();
    });
  });
});
