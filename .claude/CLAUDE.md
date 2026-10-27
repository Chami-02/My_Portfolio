# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Portfolio Revolution — Phase 2

## ⚠️ Companion files — this file is a SUMMARY, and you must go read them

| File | What is in it |
| --- | --- |
| `.claude/sprint-log.md` | every `PF-NN` ticket, sprint gates, revision passes, **Outstanding work**; plus the full Project state / Commands / Architecture / Environment text |
| `.claude/silent-failures.md` | the full entry for each trap — mechanism, measurements, mutation records |
| `.claude/locked-decisions.md` | the full reasoning behind each decision (both halves of every reversal), plus the full design-authority and working-agreement text |
| `.claude/product-requirements.md` | the owner's standing product requirements, in full |

**Split twice: 2026-09-02 (8,767 lines) and 2026-10-08 (164,716 chars).** Nothing
was deleted — it was moved. The 2026-10-08 move is appended verbatim at the END
of each companion under `# Moved verbatim from CLAUDE.md on 2026-10-08`.

### ⚠️ SIZE RULE — keep this file under 40,000 characters

Claude Code warns above 40k, and every char here is paid by every session before
work starts. **New ticket detail goes to a companion file. CLAUDE.md gets at most
ONE line per new rule, trap or decision.** Check with `wc -c .claude/CLAUDE.md`
when handing over a ticket that edited it.

### When to read them — not optional

**Grep, don't scroll** — every entry carries its own key:

```bash
grep -n "BlogSection\|PF-86" .claude/sprint-log.md        # before touching a file
grep -n "backdrop-filter" .claude/silent-failures.md      # before trusting a probe
grep -n "marquee\|Marquee" .claude/locked-decisions.md    # before changing a value
grep -n "STAGE\|draft" .claude/product-requirements.md    # before changing admin behaviour
```

Read the relevant entry **before**: touching a file a ticket already worked on;
changing any transcribed value (many "obviously wrong" values are owner-approved);
concluding a documented trap does not apply; reporting a new bug or regression
(check Outstanding work first); any verification claim (the numbers live there).

⚠️ **The cost of the split is serendipity** — grep only finds what you search for.
When work touches an area with history, skim that entry properly, and when
something surprises you, search the companions *before* deriving an explanation.

## The design is the authority

`docs/design/` holds the Claude Design prototype: `Portfolio Revolution.dc.html`
(main page), `Blog.dc.html`, `Admin.dc.html`, `DESIGN.md`, `github.md`, `assets/`.
**Source of truth for every visual decision — FROZEN since 2026-08-22.**

- **The design is the baseline, NOT the ceiling.** Transcribe faithfully by
  default (`scale(1.022)`, never `1.02`; never round). But the shipped site
  deliberately diverges on owner instruction — every divergence is recorded in
  `locked-decisions.md`. **Most recent owner decision wins**; the prototype rules
  only what nothing has overridden.
- **A value that looks wrong against `docs/design/` is not evidence of a bug.**
  Grep `locked-decisions.md` before "fixing" it.
- **I never decide a visual deviation alone**, in either direction, even upward.
  Raise it, get agreement, build, record it. **The test:** would someone comparing
  live site and prototype side by side notice? Then it is a design change.
- **Exceed it freely** in architecture, robustness, tests, performance,
  accessibility, code organisation — the `.dc.html` JS *structure* is not a source
  of truth. Locked decisions still bind (e.g. no animation libraries). This grant
  never implies permission to commit.
- **If a ticket and the prototype disagree, the prototype wins** — say so.
- **Grep for the exact value** (`grep -n "keyframes glowdot" docs/design/*.dc.html`).
  `flt`, `drift`, `sheen`, `riseIn` differ per screen (`flt-portfolio`, `flt-blog`,
  `flt-admin`…) in `frontend/src/styles/keyframes/`.
- **`docs/screenshots/` is the Phase 1 UI — never a visual target.**
- `.dc.html` DSL: `<x-dc>`, `<sc-if>`, `{{ handler }}`, a `text/x-dc` script
  block; styling is inline `style`. `support.js` (the runtime) must never be added.
  `Admin.dc.html`'s demo credentials stay there; never copy them into code.

## Engineering discipline: the real fix, not a plausible one

- **Trace before you write.** A ticket's diff is a hypothesis. Find what the file
  does today; if the ticket's assumption is wrong, the file wins (PF-95: `Blog.js`
  already had two hooks, a third would have fought them).
- **No speculative surface** — no function/hook/file because it *might* be needed.
  If the real fix is two lines in an existing function, ship two lines.
- **Delete what stops earning its place**, in the same ticket, and say so.
- **A green suite is not proof the mechanism is right** — check the test goes
  through the real call path, not a stand-in.

## Standing product requirements

**Full text: `.claude/product-requirements.md`. These outlive their tickets.**

- **Contact messages are emailed to the owner** (PF-123, BUILT 2026-10-20).
  Email is a NOTIFICATION: a failed send never fails the submission, is never
  silent (`Contact.notifiedAt`), never deletes the message. ONE mailer,
  `services/mailer.js` — PF-125/124/133 reuse it.
- **Admin panels STAGE — the public site changes only on SAVE.** REMOVE stages
  too; toggles that drive the site stage; client file checks are a COURTESY, the
  magic-byte check in `utils/fileType.js` is the gate.
- **SAVE is dim until dirty; REVERT restores the last SAVED state** (never empties)
  and discards staged files too. `UNSAVED CHANGES` stays as a marker; since PF-118 b2 leaving also ASKS (below).
- **Invalid save is REFUSED** — SAVE pressable while dirty, no request sent, banner
  `CHECK THE CHANGES AGAIN — N fields need attention.`, every field marked, first
  focused. Compose from `utils/formErrors.js`, `hooks/useFormGuard.js`,
  `admin.module.css`. Invalid state keys on `aria-invalid`; field `id` derived from
  the error path; **`noValidate` on the form is mandatory**; clear a mark per field
  on keystroke, never re-validate; server failures are a separate channel.
- **New records SAVE AS DRAFT (title only, invisible publicly); existing records
  REVERT.** Blog's draft rules live in the MODEL (because of `togglePublish`).
- **A blank FIXED field may be empty (twitter); a row you ADDED may not.** Pin both
  halves in one test; adding a row must make the form dirty.
- **A blank social URL renders NOTHING** — `utils/social.js` `socialEntries()`.
  Footer = complete list; Contact = GitHub + LinkedIn only, deliberately.
- **A panel that could not load shows `LoadError`** — never the empty state, never a
  form over missing data (About), no count until loaded (PF-117).
- **Site address is `pcgallege@gmail.com` ONLY; admin logs in as pcgallege OR parindrachameekara** (Google or password, one User, PF-119 absorbed PF-122). Old demo address gone. Panel shows the address SIGNED IN WITH (`signedInAs`); counts poll 60 s + on focus.
- **One panel field drives EVERY render site** (PF-118) — e.g. `timezone` → Contact AND footer; grep every literal before wiring. A fixed set of answers is CHOSEN (dropdown), never typed.
- **Password change / reset / forgot = password + emailed code** (owner 2026-10-13): FORGOT BUILT (PF-125), change = PF-124; Gmail SMTP now, Resend after the domain; addresses stay fixed; `admin:password` is break-glass. New passwords: `passwordProblem` (≥15) + `isBreached`.
- **Login page** (owner, 2026-10-14): password eye, `Forgot password?` and a reset prompt after 3 failed sign-ins (401s only) all BUILT — **never a password hint** (owner chose this over a hint).
- **Leaving unsaved admin work asks first — every exit** (PF-118 b2; REVERSES "marker, not a blocker"): Keep / Save (never publishes) / Discard; panels register via `useUnsavedChanges`.

## Project state

**Full history: `.claude/sprint-log.md`.**

| Phase / sprint | Scope | State |
| --- | --- | --- |
| Phase 1 (PF-1 → PF-51) | original site | complete |
| Sprint 9–13 (PF-52 → PF-106) | API, design system, chrome, sections, Blog | merged (PRs #4–#7) |
| Sprint 14 — E9 (PF-107 → PF-122) | Admin panel rebuild | **merged** — PR #29, `d243464`, 2026-10-14; live checks passed 2026-10-16 |
| PF-126 (+ 3 follow-up fixes) | migration guard, deploy pipeline | merged 2026-10-15; `deploy.yml` is the ONLY path to production |
| **Sprint 15 (PF-123 → PF-125, new from PF-127)** | **speed + auth + email + Settings** | **in progress** — PF-127→130, PF-123, PF-125 merged + live; PF-131 built 2026-10-27 |

`global.css` is Tailwind's entry point only (PF-116). Sprint 14 history:
sprint-log "Sprint 14 closed — PF-121".

**▶ NEXT, in order (owner, 2026-10-16):** Sprint 15 runs in the plan's order —
PF-127 → PF-128 → PF-129 → PF-130 (merged) → PF-123 mailer (built 2026-10-20) →
PF-125 forgot password (live 2026-10-27) → PF-131 Settings (built 2026-10-27) → PF-124… (plan: `new mds/Sprint 15/PF-123-138-sprint-15-plan.md`).
- ⚠️ **Light theme: restored POST-LAUNCH** (owner, 2026-10-11) — after the custom-domain
  deploy, as maintenance practice. Until then fix light BUGS only; upgrades need approval.
- Open from PF-113: keep the background block's status badge + `MAX 4 MB` caption?
- **Every doc I create** (tickets, reports, plans, PDFs) goes to `new mds/Sprint 15/` (owner, 2026-10-16; outside the repo). Sprint 15 plan: `new mds/Sprint 15/PF-123-138-sprint-15-plan.md`.

**Key paths** (full inventory in `sprint-log.md` — grep the filename):
- `frontend/src/styles/`: `global.css` (Tailwind only), `tokens.css`,
  `keyframes/index.css`, `animations.css` (the `.kf-*` carriers), `motion.css`,
  `patterns.module.css`, `admin.module.css` (THE shared admin layer).
- `frontend/src/utils/` — React-free, unit-testable (theme, motion, nav, splash,
  blogMeta, aboutStats, social, blogForm, projectForm, formErrors, mediaFile,
  resizeImage, loginError, dashboard).
- Shared admin blocks — compose, never copy: `ConfirmDialog`, `LoadError`, `VocabularyPicker`,
  `UploadPill`, `DropZone`, `mediaBadge.js`, `hooks/useStagedFile.js`,
  `hooks/useFormGuard.js`, `services/multipart.js`.
- Guards: `styles/__tests__/adminFoundation.test.js` (`PHASE_2_SHEETS` and
  `REBUILT_JSX` are EXPLICIT lists), `cutover.test.js` (all of `src/`),
  `revealTransition.test.js`, `stickyOverflow.test.js`, `keyframes.test.js`.
- `/admin` + `/admin/login` mount the SITE's ambient layer; `.shell` paints no
  background. Every count-changing mutation calls `refreshDashboard(qc)` (never a bare invalidate).

## Commands

No root package.json — run from `frontend/` or `backend/`.

| Frontend | |
| --- | --- |
| `npm run dev` | Vite :5173 |
| **`npm run check`** | **fast gate** — lint `--max-warnings=0` + `test:coverage` + build |
| `npm run test:run` / `test:coverage` | Vitest once / with thresholds |
| `npm run test:e2e` | Playwright; refuses unless backend DB matches `/e2e\|test/i` |
| `npm run preview` | :4173 — prod CORS blocks it; use `-- --port 5173` |

| Backend | |
| --- | --- |
| `npm run dev` | `node --watch` on :5050 (AirPlay owns 5000). NOT nodemon |
| `npm run dev:e2e` | port 5055, `portfolio_e2e` |
| `npm test` / `test:coverage` | Jest via `scripts/run-jest.js`, IN-MEMORY Mongo, ~60 s — **never `npx jest`** |
| `npm run test:atlas` | real server, ~10 min, rarely needed |
| `npm run seed` | **wipes** Project/Skill/Blog/About/User and reseeds; demo password only on `_dev/_test/_e2e/_ci` DBs |
| `npm run admin:password` | break-glass password reset: terminal only, type the DB name back, revokes all sessions (PF-120) |
| `npm run migrate[:status\|:dry\|:baseline\|:verify]` | migration runner; records applied set in a `migrations` collection |

Single test: `npx vitest run <path>` / `npm test -- <path>` or `-t "name"`.

- **Migrations:** numbered, idempotent; never edit one that ran in production
  (checksum guard refuses). The runner SPAWNS each one — never "simplify" to
  `require()`. `migrate:verify` never against `portfolio_test`. Production is NOT
  yet baselined. They reach prod via `deploy.yml` behind an approval gate.
  EXPAND before deploy, CONTRACT a release later.
- **The gate:** before every hand-off run `frontend npm run check` + `backend npm
  run test:coverage`. CI runs all seven on every `sprint-*` push; `all-checks-pass`
  is the single required check. Run E2E locally when the ticket touches what a
  spec covers or CI's E2E went red. Mutation-test NEW guard logic (backend mutants
  in a scratch copy). Backend branch coverage has the tightest margin.
- **CI:** `ci.yml` jobs credential-scan, audit, migrations, frontend, backend, e2e →
  `all-checks-pass`. ⚠️ A job added to its `needs:` must also go in its `if`.
  `deploy.yml` uses `cancel-in-progress: false` deliberately; it runs after CI
  passes on `master` (`workflow_run`), behind two approvals (Migrate, Deploy).
- **Bots on `master`** (since 2026-10-05): Dependabot + `dependabot-automerge.yml`
  (dev tools/Actions patch-minor auto; site packages and build tools patch auto;
  majors wait), `health-check.yml` hourly, CodeQL. Auto-merges move `master` —
  sync a long branch with `git merge origin/master`, regenerate lockfiles with
  `npm install`.

## Architecture

**Backend — Express 5 + Mongoose, serverless-shaped.** `server.js` and Vercel both
import `app.js`. Order is load-bearing: helmet → cors → globalLimiter (100/15 min)
→ morgan → parsers (10 kb) → `/uploads` → `GET /api/health` → **`connectDB()`
middleware** → routes → notFound → multer errors → errorHandler.
- `/api/health` sits BEFORE `connectDB` and returns 200 with `database: null` on
  an outage — assert the `database` field.
- Route → controller → model; rules + `validate` + `protect` (Bearer JWT).
  Throw `AppError` / `next(err)`; never respond from a catch.
- Models: User, Project, Skill, SkillCategory, Blog (`sections[]`; derived fields in
  `pre('insertMany')` AND `pre('validate')`), About (single doc), Contact,
  Vocabulary, Session.
- Uploads: multer **4 MB** (Vercel caps bodies at 4.5 MB) → `services/storage.js`
  → Cloudinary. Every media field has a DEDICATED route.
- Databases: `portfolio_prod`, `portfolio_dev`, `portfolio_test[_N]`, `portfolio_e2e`.

**Frontend — React 19 + Vite SPA.** Providers: QueryClient → Theme → Motion → App;
`SplashProvider` inside `HomePage` only. **Stylesheet import order in `main.jsx` is
locked:** `global.css` → `tokens.css` → `keyframes/index.css` → `animations.css` →
`motion.css` (last). `App.jsx` has three `<Routes>` blocks (navbar / main / footer,
chrome excluded on `/admin/*`). Data: component → `hooks/use*.js` (TanStack) →
`services/*Service.js` → `services/api.js`. `apiUrl()` for browser-fetched URLs.
Session: 15-min access JWT in memory + rotating refresh token in `localStorage`
(NOT a cookie — measured dead on Vercel).

## Stack

React 19 · Vite · Tailwind v4 · CSS Modules · React Router v7 · TanStack Query v5
Express · MongoDB Atlas · Mongoose · JWT · Cloudinary
Vitest · Jest · Supertest · Playwright · GitHub Actions

## Styling approach

**CSS Modules** for anything copied from the prototype — paste verbatim.
**Tailwind** for simple layout only. Shared patterns via `composes:` from
`patterns.module.css`; do not generalise a value used once.

**A keyframe name inside a `*.module.css` silently resolves to nothing.** Use:

```css
.ringOuter {
  composes: kf-pulsering from global;   /* must be the first declaration */
  animation-duration: 6s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
```

Carriers live in `styles/animations.css` — add the carrier before any module names it.

## React conventions

- **Never call `setState` in an effect body** (`react-hooks/set-state-in-effect`)
  — derive during render. Inside a callback the effect registers is fine.
- **A provider file exports components only** — contexts live in their own module
  (`ThemeContext.js`, `SplashContext.js`, `AdminFlashContext.js`…).

## Silent failures — the index

**Full mechanism and measurements: `.claude/silent-failures.md`. Read it before
working in an area, and before concluding "this is fine, I read the source".**
Where a mistake would be silent, add a test that would catch it.

**CSS**
- Mistyped custom property / `animation-name` → dropped, no error (`drift-blog` does not exist).
- nginx: a `location` with its own `add_header` drops EVERY inherited header — keep `add_header` out of locations (guarded).
- The SPA rewrite must exclude `/assets/` — else a missing chunk gets index.html + 200, cached a year (guarded, PF-127).
- Keyframe named in a CSS Module → scoped to nothing; tell is `el.getAnimations().length === 0`.
- Never declare `transition` on a `Reveal`-wrapped element (guarded).
- `rgba(#hex,.5)` is invalid — channel triplets stay bare `R,G,B`.
- `var()` inside `@supports` answers true without testing.
- `html[data-motion="reduced"] *` never matches `<html>`.
- `border-radius` in `:focus-visible` reshapes the element — omit it.
- `-webkit-backdrop-filter` FIRST, standard LAST, or Chrome gets no blur.
- Two stacked full-size layers: only the top gets clicks — overlay root IS the backdrop.
- `overflow-x: hidden` on body/wrappers kills descendant `sticky` → use `clip` (guarded).
- `align-items: start` grid sizes a column to content; split stretch rail from sticky inner.
- Inline custom property on `<html>` beats `html[data-theme]` — set `data-theme` only.
- `flex: 1` has basis 0 — a wrapping row never wraps; give a real basis + `max-width: 100%` on `flex: none` siblings.

**Tests that pass while asserting nothing**
- Raw-text CSS assertion matches a COMMENT → parse with postcss.
- `firstElementChild` skips text → use `src/test/leadsWithIcon.js`.
- Playwright `getByRole({name})` is substring → `exact: true`.
- Counting controls in a landmark → assert names.
- `[class*="x"]` matches longer names → compare local names exactly.
- Pinned mocks / non-discriminating fixtures disarm "does not happen again" guards — mutation-test.
- `insertMany` does not stamp identical `createdAt` — assert the weakest property.
- Shared mutable fixtures → `Object.freeze`; mutation-test the whole file, never `-t`.
- A green suite hides dead code — count consumers excluding the module and its test.
- Stability checks/polls the failure state also satisfies are vacuous.
- `document.body.focus()` is a jsdom no-op; jsdom has no `DragEvent` (polyfill).
- Mutation harness: `cmp` the snapshot before/after; zsh does not word-split `$FILES`.
- A query's `data = []` default turns a FAILED load into the empty state (and a derived form into an empty, saveable one).
- TanStack DEDUPES an invalidation into a query's FIRST in-flight fetch (stale answer wins) → `refreshDashboard` = cancel, then invalidate.
- Data-router navigations are TRANSITIONS — a lazy page's Suspense fallback shows on direct loads only; in-app the old page stays up (PF-130).
- E2E "scroll to bottom" before API data lands stops short; assert the bottom element is ON SCREEN, never `scrollY > 0`.
- CSS-Module rules are invisible to Vitest; `el.style.opacity` reads back normalised.

**Tooling and gates**
- `npm test` does not run E2E; unit green + E2E red = removed feature, stale tests.
- run-jest AND `dev:e2e` load the REAL `backend/.env` → a new outward secret must be stripped there (PF-123: run-jest deletes `GMAIL_*`, `.env.e2e` blanks them) or tests send real mail.
- dotenv 18 ships a `dotenv` bin that shadows `dotenv-cli`'s → `npm run dev:e2e` broken locally (CI unaffected); see Outstanding work PF-127.
- `mongodb` ≥ 7.6 HANGS every DB test under Jest (NODE-7832) — held at `~7.5.0` + Dependabot ignore; lift steps in `dependabot.yml`.
- `cookie` 2.x is ESM-only → Jest cannot load it (every backend suite fails); majors ignored in `dependabot.yml` (#39).
- A required check that never started looks like nothing failing — confirm `All Checks Pass` is listed AND `pass`.
- After a re-trigger, read the LATEST run, not the merged check list.
- Piping a long run through `tail` buffers to the end; `timeout` does not exist on macOS (`gtimeout`).
- Name the lint SCRIPT, never a path; an absent file in a report ≠ clean.
- `playwright-report/`, `test-results/`, `dist-*/` must stay ESLint-ignored.
- Root `.gitignore` has no `node_modules`; tests under `src/` can leak Tailwind classes.

**Playwright / E2E**
- `toBeVisible()` ignores occlusion; `click()` under the splash silently retries.
- `test.use({ reducedMotion })` is inert → `page.emulateMedia` + assert it took.
- `page.route()` matches in REVERSE order — register the catch-all first. It never sees a REDIRECT hop → route the issuer, `route.fetch({ maxRedirects: 0 })`.
- `reuseExistingServer` adopts a stale dev server — check port 5174.
- Vite DEV injects a `composes`-shared sheet per consumer; HMR can leave a stale copy winning — restart before doubting a CSS fix.
- `npm run preview` uses `.env.production` = the PRODUCTION API — grep the built bundle instead.
- Duplicated anchors (footer) → strict-mode throws; `getByText` ignores `aria-hidden`.
- `flaky` is a separate bucket; the rate limiter (100/15 min) bites browser probes, not E2E.
- E2E sign-ins are a budget (authLimiter 10/15 min per run); never share storageState (refresh token rotates → reuse detection). Back after `page.goto` crosses documents — build in-app history to test the dialog.

**Backend / environment**
- An array bypasses `typeof x === 'string'` — always assert a ZERO case. express-validator `isLength` passes arrays too → `isString().bail()` first.
- Chrome AND Node 24 ACCEPT `+05:30` as an Intl timeZone (Node 20 rejected it) → `isTimeZone`'s shape check is load-bearing; keep the stubbed-Intl proof (a `function`, not an arrow).
- `FormData` through `api.js` becomes JSON → `headers: { 'Content-Type': undefined }`.
- A body field that DEFAULTS to true (`read`) makes a dropped body succeed in reverse — assert the wire body.
- Raw Cloudinary assets download with no extension → `GET /api/resume` proxies; never add `.pdf` to the id.
- axios array params → `paramsSerializer: { indexes: null }`.
- A URI with no DB path silently uses/creates `test` (`assertExplicitDatabase`).
- `findOneAndUpdate` runs no `pre('save')` → plaintext password; `validateSync()` runs no middleware. Mongoose DOES run `lowercase`/`trim` setters on query values.
- `verifyIdToken` skips `aud` when `audience` is undefined, and its errors embed the token — never log them.
- Four shapes of a red backend suite — reproducibility discriminates.
- The Vite proxy targets a Docker host; local dev uses absolute `VITE_API_URL` — probe that URL.
- SRV DNS failures look like a broken backend; CORS is exact-match.
- A Vercel SENSITIVE var pulls as `[SENSITIVE]` and beats `.env.production` in a CLI build — `deploy.yml` greps the built bundle before deploying (PF-126 follow-up).
- A Vercel production alias serves the production BRANCH; rewrites drop `Set-Cookie`.
- `authLimiter` is live under test — mint via `issueSession`.
- Deleting a refresh token does not end a session for 15 min.

**Prototype-specific**
- Real behaviour often lives in the SCRIPT block — grep the element's attribute.
- The prototype's reveal transition is inline and permanent.
- Line 834's undeclared `acc` → `self.accColor`.
- Grain's `0.42` opacity is correct (`paintGrain()` overwrites).
- Verify a keyframe against the prototype that OWNS it (six admin bodies were wrong).
- An opaque ancestor background hides a fixed canvas (guarded on `.shell`).
- Design images must be copied into `src/assets/` and imported.

- Stripping a top-level body key leaves its DOTTED paths (`"resume.publicId"`) writable — filter prefixes.
- A CSP hash / `connect-src` breaks on prod only (`vercel.json`) — guarded by `securityHeaders.test.js`.
- Admin panels read the PUBLIC URLs: fresh only while the CDN skips `Authorization` AND `Cache-Control` has no `public`/`must-revalidate`/`s-maxage` (RFC 9111 §3.5); a missed purge is invisible (stale ≤1 h) — PF-128.

**Measurement**
- History API cannot tell first load from Back-to-first-entry.
- Tool round-trip (~8 s) is slower than the 4.5 s splash — print timings, use observers with a control.
- Re-query after any state change; one clean page load per theme.
- Disabled-control opacity can be unreadable; `:hover` still matches `disabled`.
- Clipped vs occluded look identical — hit-test with `elementFromPoint`.
- Name what a probe EXCLUDES (`?nosplash`); the browser tool redacts keys containing "token".
- Always run the control; `:focus-visible` matches programmatic focus after keyboard.
- The browser tool's console never shows CSP violations — probe with `report-uri` + a control.
- The browser tool's hidden tab never fires `requestAnimationFrame` (probe hangs 45s); clicks may need a screenshot first.
- Chrome won't go below ~1141px → same-origin iframe (one at a time; resize, don't reload — 429); set `scrollBehavior: auto` before any scroll-then-measure.
- A flex row can overflow while the page does not — compare the container's `scrollWidth`.
- `<button>` in a `<form>` with no `type` submits it — always `type="button"`.
- Snapshot AFTER the edit; confirm a mutation changed the file; restore from a copy.
- `git rm` STAGES the deletion — delete with `rm` (stage-nothing rule).
- `grep | head` reads like a complete answer — use `grep -c` / `awk`.
- An error-message assertion can match the banner, not the guard — grep the string first.

## Locked decisions — do not reopen

**Full reasoning: `.claude/locked-decisions.md`. Every entry was raised and
approved before shipping. A fidelity pass that "restores" the export breaks it.**

**Sanctioned deviations (public site)**
- Reductions: cursor web `WEB_LINK_PX` 105 / `WEB_ALPHA` 0.065; splash scan lines removed (`.scanTexture` stays, 12 animated elements); hero marquee band 52px.
- Removed: Contact accent glow; blog featured ghost `01`; About portrait caption and sweep; reading-view "GOT A QUESTION"; footer REPLAY/SCROLL UP; all section washes (footer takes the navbar surface).
- Blog teaser featured card: fixed backdrop photo ONE PER THEME, crops differ on purpose, light scrim is a legibility requirement; card fills its cell, grid keeps `align-items: start`.
- Hero: fourth pill item, ten chips, two-layer mask, `.blobC` z-index 2. Nine links carry brand icons. LIVE SITE green dot (`dot-ok`).
- Marquee copies hero 8 / footer 18 (EVEN); both bands 50 px/s — equal SPEED. `STAR_DRIFT = 0.35`. Different About portrait (never import the `.heic`). Smooth scroll via CSS. `data-terminal` attached.

**Chrome**
- Header FULL-BLEED; ADMIN outlined in `--muted`; theme toggle 44×44 sun/moon (keeps `--header-h` 71px); navbar route-aware, `/blog*` nav is ABOUT · SKILLS · PROJECTS · CONTACT · ← GO BACK.
- `ScrollToHash` gated on splash, no `behavior` arg, mounted inside `HomePage`.

**Motion and accessibility**
- Hover lifts ungated under reduced motion; card hover-transition deviation WITHDRAWN.
- PF-91 contrast pass (`--muted2`→`--muted` dark on tinted surfaces, `--ok` light `#0B6446`…) — the SURFACE decides, not the colour.
- `main[tabindex="-1"]:focus { outline: none }` is the ONLY `outline: none`.
- Splash plays once per document load; `SPLASH_MS` 4500, everything derived; mobile overlay z-80, 768px.

**Architecture**
- No frontend animation libraries. Triplet tokens stay triplets. Import order locked. Tailwind `@theme` uses `var()`; fonts not in `@theme`. Body Space Grotesk + `line-height: 1.6`. `--acc2` deleted.
- `SplashProvider` fails open; splash read/write are separate hooks.
- Projects: big card by `order`, badge by `featured`; every featured project shows the `★ FEATURED` pill. ClearDrive keeps 10 pills.
- `About.availableForWork` drives hero badge, footer row, About line. Admin unread dot is `--ok` green.
- Cloudinary behind a provider interface; résumé PDF only; every media field written by a DEDICATED route (security: never a client-supplied publicId); files destroyed on replace AND record delete (row first); images PNG/JPEG/WebP by magic bytes; 4 MB everywhere, browser resize ≤2400px WebP.
- Blog: `sections[]`; `readingTimeMinutes` derived (override is a separate field; never re-add seed literals); structured sections editor, not the export's markdown box; tag chip picker + text input; `?q=` searches the whole post; `publishedAt` stamped at publish; full dates via `formatDate`; multi-tag AND; CLEAR ALL `var(--danger)`; search row is a `<form role="search">`; chips = in-use published tags; impact vs inUse filters differ on purpose; slug route returns `index` + `total`; view counter renders nothing below one; `← BACK TO RESULTS` via router state; inline not-found keeps the URL; reading view uses no `Reveal`, two `← ALL POSTS`; `/blog` scrolls to top on PUSH only.
- Projects: drafts (`published: { $ne: false }`), upload-only background, `tech` picker. Skills: no drafts, level dots, owner-managed sections, three-choice section delete, drag-and-drop. Blog + Messages (PF-115): model-enforced drafts, star + client-side search.
- One `ConfirmDialog` for every admin delete, focus on CANCEL.
- CORS dev-port range in non-production only. Vocabulary delete cascades behind an impact confirm.

**Admin**
- Header reuses the site's ThemeToggle (67px, `--admin-header-h`); admin footer takes the prototype gradient; below 899px the sidebar is a horizontal strip.
- Session: in-memory access JWT + rotating refresh token + `Session` collection; one `issueSession(user)` for every door; `api.js` never touches `window.location`.
- `/admin/login` and `/admin` share the main page's background; no aurora/scanline; `riseIn` per screen (16/22/18px); no DESIGN PREVIEW line, no spinner.
- `GET /api/dashboard/stats` returns seven fields; shell paints nothing count-shaped while loading; `+ NEW POST` opens the editor.
- About panel is a STAGED form, saved profile-first sequentially; `PENDING SAVE` / `REMOVE ON SAVE` badges; résumé `accept=".pdf"`; portrait card mirrors résumé card but is NOT one component; portrait alt follows the source; upload input clipped, not `display: none`.
- PF-119: auth code + PKCE, backend exchange, 60 s FRAGMENT handoff → `issueSession`; site-styled Google button ABOVE the form; Google binds address→first `sub`, never creates a User; `googleLimiter` 30. Prototype is stale (owner) — its emails aren't targets.
- PF-118 b2: timezone = IANA place (`Asia/Colombo`) shown as its live offset; App uses a DATA router (`createBrowserRouter`, one catch-all) for `useBlocker` — keep the three `<Routes>` as they are.
- PF-118: footer band follows availability (two call sites, 70.7s / 67.1s = equal 50 px/s); Contact intro leads with the note; `timezone` / `heroIntro` / `footerBio` fields ("Site copy" card); three-letter months (`SEP`); no `publishedAt` control.
- PF-120: SPA CSP in `frontend/vercel.json` (scripts by hash only, `frame-ancestors 'none'`); deleted `POST /api/upload`, `PATCH /about/availability`, `/uploads`; `contactLimiter` 5 stored/h; accepted risks (role unread, OAuth code in logs, per-instance limiter…) in locked-decisions.
- Leftovers 2026-10-14: hero cut-out uploadable (`imageSlot` + `imageSlotHandlers` shared with the portrait — never fork), bundled hero is WebP, `↺ MARK UNREAD` (explicit `{ read }`), project row PUBLISH/UNPUBLISH (Blog's rule), backend `GET /`, `og:` tags (url/image only WITH the domain), dates stay reader-local, nginx mirrors vercel.json headers.
- PF-128: API in `bom1` (Atlas Mumbai); public GETs CDN-cached (tag `public-data`), a signed-in write DELETES the tag (SAVE is instant); everything else `no-store`.
- PF-129: bundled hero image never changes (its oval is in its ALPHA); only an UPLOAD gets `.portraitImgUploaded` = measured oval + PF-80's layers.
- PF-123: contact email sent in the BACKGROUND (`waitUntil`), text + ESCAPED html, 12-hour `YYYY/MM/DD` in About's zone, TO the Gmail account itself, Reply-To the visitor; blank `GMAIL_*` = mail off; no retry queue; `location` from Vercel IP headers ONLY when `VERCEL` is set; card mirrors the email (red reminder unread-only).
- PF-125: forgot = OWASP — same answer + timing for any address (work after the response), HMAC'd 6-digit code, 5 guesses capped IN the query, no account lockout, reset signs nobody in; HIBP only after a right code, fails open; login runs a dummy bcrypt for an unknown address (timing). Security emails = `services/alertEmail.js` `renderAlert` (contact keeps its own); "changed" alert → the MAIN address + the one used (never a copy to the second when the main reset). Passkeys = PF-140 (after domain), Mongo limiter = PF-141.
- PF-131: Settings = own ACCOUNT nav group (`⚙︎` + U+FE0E) under MANAGE; ONE real card per ticket, never "coming soon"; `/auth/me` `addresses` sends a Google BOOLEAN, never the `sub`; `Session.signInMethod` → `signedInWith` (rotation copies it).
- PF-130: loading screens only when a wait is REAL — 300 ms delay, NO minimum time, hand-off keeps it up; session/page-code/post only (`LoadingScreen`, `BrandMark`).
- PF-117: a failed load shows `LoadError` (never the empty state, never a form; RETRY own line ≤560px, says "STILL…" if a retry fails); disabled primary has NO glow; `×` gets an invisible 24px hit area, 36–42px buttons stay; strip scrolls the active item into view.

## Environment

- **Free tiers only** — Vercel, Atlas M0, Cloudinary Free; owner pays for a domain
  only. Never propose a paid add-on. Vercel caps bodies at 4.5 MB.
- macOS, zsh: `brew`, `jq`, `sed -i ''`. Backend :5050 (Docker internal :5000).
  E2E: `portfolio_e2e`, backend 5055, frontend 5174.
- Kill servers with `lsof -sTCP:LISTEN -ti:PORT | xargs kill` — the `-sTCP:LISTEN`
  is mandatory (a bare `lsof -ti` also kills Chrome). Use `-a` to AND selectors.
- Frontend tests in per-module `__tests__/`; shared helpers in `src/test/`
  (`leadsWithIcon.js`); cross-cutting guards in `styles/__tests__/`.

### Branching

- **GitHub Flow since Sprint 14 merged** (PR #29) — one
  short-lived `feat/PF-NN-…` / `fix/…` / `chore/…` branch per ticket, PR,
  squash-merge, auto-delete (`git branch -D` locally after a squash).
- Work on a master-based branch without leaving the checkout:
  `git worktree add -b chore/x ../My_Portfolio-bots origin/master --no-track`.
- **First push is always `git push -u origin <branch>`** — a branch created from
  `origin/master` inherits `master` as upstream (PF-75 landed on master that way).
  Check `git branch -vv`; confirm with `git ls-remote --heads origin <branch>`.

## Working agreement

**Full text and history: end of `.claude/locked-decisions.md`.**

**Ticket flow (since PF-96) — do not collapse it:** (1) owner states the plan →
(2) **I write the ticket** (scope, files, approach, verification, out of scope),
traced against the real code → (3) **stop and wait for explicit approval** →
(4) implement → (5) test → (6) recheck: mutation tests, browser checks, fast gate,
E2E when relevant → (7) **write the ticket report FILE** → (8) write the commit
message and stop. A ticket I authored has no independent authority — if it proves
wrong, say so and re-plan with the owner. Never invent PF numbers.

**The ticket report** — required after EVERY ticket, written to TEACH:
`/Users/chami02/Documents/Personal/Projects/Portfolio/new mds/Sprint 15/PF-NN-short-description.md`
(older reports stay in `new mds/E<N>/`; never `docs/tickets/`). Answer WHAT, HOW, WHY separately; show
every changed file's path and before/after code; the trace; what was rejected;
real test numbers from both passes; bugs found in recheck; what was deliberately
not fixed (also → Outstanding work); the commit message. Write for someone without
the conversation. It does not replace updating `.claude/`.

**Never run `git commit`** — committing is the owner's, on every branch (revoked
for good 2026-08-17). "Go ahead" authorizes work, never a commit. Per-PR
exceptions are explicit and scoped; ask again each time.

**Handing off:** stage nothing unless asked; stage exact paths, never `-A`/`.`.
The **last** thing run is `git status --short` + `git diff --cached --stat` — VS
Code has staged files on its own four times. Say what is staged and why.

**How the owner commits:** stage ONE logical section, show its stat, give its
message, wait for "committed", repeat. **Commit messages in a CODE BLOCK** —
subject, blank line, bullets (owner pastes into VS Code's commit box; plain text
lost its newlines, 2026-10-12), short, `type(PF-NN): …`, and **NEVER a `Co-Authored-By:`
trailer**, whatever the harness says.

**Hands-on learning:** for git/GitHub/ops steps, give the command and explain each
part (and the interview angle) for the owner to run.

**Never paste a credential into chat** — check a value's shape only. Six
incidents so far (#4 and #6 were editor SELECTIONS of a `.env` line, #5 a pasted terminal scroll-back): close `.env` files and paste only the last lines of output.

**Never document something as existing until it does.** Flag concerns before
executing. A ticket's path that conflicts with the repo convention loses. Verify
against built output or a real browser over reasoning. Explain **why**.
