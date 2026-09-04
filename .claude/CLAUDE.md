# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Portfolio Revolution — Phase 2

## ⚠️ Companion files — this file is a SUMMARY, and you must go read them

Split out on 2026-09-02. CLAUDE.md was 8,767 lines and consumed most of a
context window before any work started; the record now lives beside it.

| File | Lines | What is in it |
| --- | --- | --- |
| `.claude/sprint-log.md` | 5,017 | every `PF-NN` ticket, sprint gates, the owner-requested revision passes, and **Outstanding work** |
| `.claude/silent-failures.md` | 1,570 | the full entry for each trap — mechanism, measurements, build output, mutation records |
| `.claude/locked-decisions.md` | 1,594 | the full reasoning behind each decision, including both halves of every reversal |

**Nothing was deleted — it was moved.** The compact lists below name every
trap and every decision, and they are authoritative for **what** the rule
is. They are NOT sufficient for **why**, for measurements, or for what a
past ticket already tried.

### When to read them — not optional

**Grep, don't scroll.** Every entry carries its own key, so a targeted grep
costs one tool call and a few hundred tokens:

```bash
grep -n "BlogSection\|PF-86" .claude/sprint-log.md        # before touching a file
grep -n "backdrop-filter" .claude/silent-failures.md      # before trusting a probe
grep -n "marquee\|Marquee" .claude/locked-decisions.md    # before changing a value
```

Read the relevant entry **before**:

- **touching a file a ticket already worked on** — grep the filename in
  `sprint-log.md`. Nearly every file in `frontend/src` has a ticket behind
  it, and that entry usually records something measured that is not
  visible in the code.
- **changing any transcribed value** — colour, timing, spacing, copy,
  count. Grep `locked-decisions.md` first; a surprising number of
  "obviously wrong" values are owner-approved deviations, and reverting one
  looks exactly like fixing a bug.
- **concluding a documented trap does not apply.** The compact entry tells
  you the trap exists; the full entry is what tells you whether your case
  is the exception. This project's traps have all fired at least once on
  someone who had read the summary.
- **reporting something as a new bug or a regression** — check Outstanding
  work in `sprint-log.md`. A long list of known, deliberately-deferred
  defects lives there, several of which look like fresh regressions.
- **any verification claim.** "Verified" is worth nothing next session
  without its numbers, and the numbers are in the companion file.

⚠️ **The known cost of this split: serendipity.** With the whole record
inline, a session could stumble on a relevant past finding it was not
looking for. Grep only finds what you think to search for. So when work
touches an area with history, skim that entry properly rather than grepping
one keyword and moving on — and when something surprises you, search the
companion files *before* deriving an explanation from scratch. This project
has re-derived a wrong answer to an already-settled question more than
once, and that was true even when the file was fully loaded.

## The design is the authority

`docs/design/` holds the Claude Design prototype this project is rebuilding
toward. **These files are the source of truth for every visual decision.**

```
docs/design/
  Portfolio Revolution.dc.html   main page — splash, hero, about, skills,
                                 projects, blog teaser, contact, footer
  Blog.dc.html                   Field Notes — index, search, reading view
  Admin.dc.html                  CMS — login plus six panels
  DESIGN.md                      design system spec
  github.md                      sync log and screen map
  assets/                        9 source images, full resolution
```

### ⚠️ The design is the baseline, NOT the ceiling — restated 2026-09-02

Owner's words: the design files are to be followed, **but the implementation
already differs and will differ more** — things added, things removed, on
their recommendation and their requirements. From here on there is work to
do *beyond* the design, not only transcription of it.

**Both halves are true at once, and neither cancels the other:**

- **Transcribe faithfully by default.** Where the prototype has a value and
  nothing overrides it, that value ships exactly — `scale(1.022)`, not
  `scale(1.02)`. That has not loosened.
- **The shipped site is deliberately not the prototype.** The header, the
  theme toggle, the section washes, the marquee bands, the hero chips, the
  splash scan lines, the footer, the star drift, the About portrait — all
  diverge on owner instruction, and every one is recorded in
  `.claude/locked-decisions.md`.

**So the authority is layered:** the prototype, *plus* the sanctioned
deviations, *plus* whatever the owner directs next. **Where they conflict,
the most recent owner decision wins** — and the prototype is only the
authority for what nothing has overridden.

⚠️ **The practical consequence: a value that looks wrong against
`docs/design/` is not evidence of a bug.** Grep
`.claude/locked-decisions.md` before "fixing" it. `docs/design/` has been
**frozen since 2026-08-22**, so it will drift further from the live site by
design, and that gap is expected to widen — not a sync failure to repair.

⚠️ **What has NOT changed: I still do not get to decide a visual deviation
alone.** "More than the design" means the owner adds and removes; it does
not license my own aesthetic judgement, in either direction. Raise it, get
agreement, then build — and record it. That process is the reason every
divergence above is legible today instead of looking like a transcription
error.

### ⚠️ `docs/screenshots/` is NOT the design

That directory holds an image of the **Phase 1 UI** — the old site, before this
rebuild. It is historical reference only.

**Never use it as a visual target.** It shows the previous slate/indigo palette
and Inter typography, both of which Phase 2 replaces. If a screenshot and the
prototype disagree, the screenshot is the outdated one.

### Working with the prototype

**Read the relevant file before implementing any visual work.** Grep for the
exact value rather than reasoning from a description:

```bash
grep -n "keyframes glowdot" docs/design/*.dc.html
grep -n "data-screen-label" "docs/design/Portfolio Revolution.dc.html"
```

**If a ticket and the prototype disagree, the prototype wins.** Say so, then
implement what the prototype says. This has happened repeatedly — tickets have
carried wrong keyframe values, a wrong test directory, a wrong import order,
and a wrong z-index (grain guessed at a low single digit; the prototype has it
at 70, above the header). The prototype has never been wrong.

**Transcribe exactly. Never round.** `scale(1.022)` is not `scale(1.02)`.
`translateY(-14px)` is not `-12px`. These carry the design's feel; rounding
produces something that looks approximately right and feels wrong, in a way
that is very hard to diagnose later.

**Three keyframes differ per screen** — `flt`, `drift`, `sheen`. Check which
screen you are building before copying a value. They live under explicit
variant names (`flt-portfolio`, `flt-blog`, `flt-admin`) in
`frontend/src/styles/keyframes/`.

### Where you can exceed the prototype, and where you can't

"The prototype wins" governs visual and UX values — colours, spacing, timing,
easing curves, copy, layout, which features exist. Those transcribe exactly.
Nothing above or below this section changes that.

Everything else — architecture, robustness, test coverage, performance
safeguards not visible to the user, accessibility, code organisation — has no
floor at the prototype's own implementation. The `.dc.html` files are a design
tool's export: a single class component driving a live preview, not a
production React app. Treating its JS *structure* as a second source of truth
alongside its visual values is a mistake this project doesn't need to make.
Improve it freely, no need to ask first. Scope: work on `sprint-N-*` branches,
`master` excluded.

⚠️ This grant used to be worded as inheriting the sprint-branch *commit*
authorization. That authorization was revoked on 2026-08-17 (see the Working
agreement) and the cross-reference was removed then. The two are independent
and always were: this one is about making implementation decisions without
asking first, and it still stands. It has never implied permission to commit,
and now explicitly does not — improve freely, then hand the work over.

One limit on "freely", and it already exists elsewhere in this file: **Locked
decisions still bind.** "No frontend animation libraries" is not reopened by an
argument that some library is better architecture, and the same holds for every
other entry there.

Already-sanctioned examples, for calibration:

- **The `visibilitychange` pause (PF-76)** — zero visual difference, pure
  resource efficiency for a hidden tab. Confirmed absent from the prototype
  (zero matches for `visibilitychange`, `document.hidden`, `visibilityState`).
  The cleanest case: nothing to compare on screen, so nothing to raise.
- **`useSplashReady()`/`SplashProvider` (PF-75)** — note the prototype does
  gate reveals on the splash; it calls `hideReveals()` at mount (line 892) and
  defers `startReveals()` until `finishSplash()` (line 945). What it doesn't
  need is a *propagated* flag, because it arms every reveal in one imperative
  sweep over `document.querySelectorAll('[data-reveal]')` — deferring a single
  call is the entire gate. A React port where each `Reveal` mounts and arms its
  own observer has no such single call, so the state has to travel. The
  improvement is in porting the concept, not inventing one.
- **`SplashProvider`'s `initialReady` prop (PF-78)** — fixes a race the
  prototype is not exposed to. Not because it isn't React: it is
  (`class Component extends DCLogic`, `React.createRef()`, `this.setState()`).
  It dodges the race because reveals are armed by that one imperative DOM
  sweep rather than by per-element effects reading state, so there is no
  effect that can arm under a stale value while a `setState` is still pending.

Those three share a shape worth naming: each is a place where the prototype's
*structure* doesn't carry over, not a place where its *judgement* was wrong.
Read that way, "improve freely" almost never conflicts with fidelity.

**The one rule that doesn't bend: never reduce, and never substitute your own
aesthetic judgement for the design's, even upward.** A colour that reads as
more harmonious, a curve that feels smoother, a layout that seems more
balanced — all real improvements they might be, and all still need to be
raised and agreed to first, not decided alone. The reduced cursor-web density
is the model for how this should go: proposed explicitly, reasoned about
explicitly (which parameters, by how much, why), executed only after being
asked for, and then recorded in this file as a sanctioned exception — not
decided unilaterally and presented as already correct.

**The test**: if a person comparing the live site to the prototype side by side
would notice a difference — in what's visible, audible, interactive, worded, or
how a specific transition feels — that's a design change. Raise it first,
regardless of how it's motivated or how minor it seems. If the only difference
is in code nobody sees without opening dev tools, it's an implementation
choice. Go ahead.

## Engineering discipline: the real fix, not a plausible one

Added 2026-09-01, after PF-95's Step 0 turned up two different-shaped
mistakes worth naming so they don't recur.

**Trace before you write.** A ticket's proposed diff is a hypothesis about
what the code does, not a fact. PF-95 proposed a second `pre('validate')`
hook on `Blog.js` because it assumed the schema had one gate; the schema
actually has two (`pre('validate')` and `pre('insertMany')`, sharing
`applyDerivedFields()`), and a second hook bolted on next to the real one
would have left both in place, fighting — with the *existing* hook still
winning. The correct fix turned out to be two lines inside the function
that already existed, not a new one beside it. Before adding a hook,
function, file, or config knob: find out what the real file does today. If
a ticket's assumption is wrong, the file wins and the diff gets rewritten
against it, not layered on top of it.

**No speculative surface.** Don't create a function, hook, file, or
abstraction because it might be needed, because a pattern elsewhere
suggests it, or because reconciling with what exists is more work than
writing something parallel. PF-95 also proposed a new
`frontend/src/utils/blog.js` for a date formatter that already existed,
two lines away, inside `BlogSection.jsx` — same mistake, smaller stakes.
If the real fix is a two-line change to an existing function, ship the
two lines.

**Delete what stops earning its place.** Code that becomes dead,
redundant, or superseded by a ticket's own work does not get left behind
"in case." Remove it in the same ticket and say so in the commit message —
the same way a Locked-decision reversal gets recorded rather than
silently swapped.

**A green test suite is not proof the mechanism is right.** Tests can pass
against a plausible-but-wrong fix if they don't exercise the real call
path. A migration test that regex-pins `seed.js`'s source text against a
`TARGET_DATA` object would pass even if the seeded value never survived a
real `insertMany()` — it never touches the database or the hook. Before
trusting a green run as verification, trace whether the test actually
goes through the code path the bug lives in, not a stand-in for it.

### Reading `.dc.html` files

They use a custom DSL compiled by the Claude Design runtime: `<x-dc>` root,
`<sc-if>` conditionals, `{{ handler }}` bindings, `ref="{{ x }}"`, and a
`<script type="text/x-dc" data-dc-script>` logic block.

Styling is almost entirely **inline `style` attributes** — no class names to
map. Read the inline value and re-express it.

`support.js` is the Claude Design runtime. It is deliberately **not** in this
repo and must never be added.

`Admin.dc.html` contains hardcoded demo credentials in its logic block. That is
expected for design reference, and CI's credential scan skips `.html`
deliberately. Do not strip them; do not copy them into application code.

## Project state

**Full ticket-by-ticket history is in `.claude/sprint-log.md`** — what each
`PF-NN` built, every sprint gate result, the re-pointing pass, the
owner-requested revision passes, and the Outstanding-work list. Read it
before touching an area a ticket has already been through; this section is
only the current position.

| Phase / sprint | Scope | State |
| --- | --- | --- |
| Phase 1 (PF-1 → PF-51) | the original site | complete |
| Sprint 9 (PF-52, PF-59 → PF-65) | API serves every Phase 2 field | merged |
| Sprint 10 — E6 (PF-66 → PF-74) | design system foundations | merged, PR #4 |
| Sprint 11 — E7 (PF-75 → PF-84) | chrome + Hero → Skills | merged, PR #5, `b8cef24` |
| Sprint 12 (PF-85 → PF-94) | Projects, Blog, Contact, Footer, cutover, a11y | merged, PR #6, `79835e0` |
| **Sprint 13 — E8 (PF-95 → PF-102)** | **Blog** | **in progress**, branch `sprint-13-blog` |

Numbering note: six Jira epics consumed PF-53–PF-58, so the jump from PF-52
to PF-59 is intentional.

### Sprint 13 — the current sprint

**31 Aug → 8 Sep · 8 items · 51 points · branch `sprint-13-blog`.**

> **Goal.** Field Notes is a real destination — every post is readable at
> its own URL, findable by tag or search, and editable from the admin panel
> — and no Phase 1 page is left in the visitor-facing site.

| Ticket | Title | Pts | State |
| --- | --- | --- | --- |
| PF-95 | Migration 005 — distinct blog publish dates | 3 | ✅ built 2026-09-01 |
| PF-96 | Blog API — `publishedAt`, update-hook defects, `?q=` search + tag filter, prev/next, one shared sort spec | 8 | ✅ built 2026-09-02 |
| PF-97 | Admin Blog panel repair — posts editable again | 5 | ✅ built 2026-09-04 (really ~8) |
| PF-98 | `/blog` index — header, featured card, grid, search, tag chips, empty state | 10 | to do |
| PF-99 | `/blog/:slug` reading view — sections, bullets, prev/next, EMAIL ME removed | 8 | to do |
| PF-100 | 404 page — Phase 2 treatment | 3 | to do |
| PF-101 | Blog responsive + state audit, both themes | 6 | to do |
| PF-102 | Sprint gate, PR, close | 8 | to do |

⚠️ **The Jira board still shows PF-95 as To Do; it is DONE.** Built,
verified and recorded on 2026-09-01. Moving the board is the owner's.

⚠️ **Four of these tickets are the second half of defects already found and
written up** — read `.claude/sprint-log.md` → **Sprint 13 → The plan**
before starting any of them. It is the starting point, not background:

- ~~**PF-96**~~ — **BUILT 2026-09-02.** Both inherited defects fixed: the
  ordering bug (now `$ifNull: [publishedAt, createdAt]` desc, `_id` asc,
  defined once in `backend/src/utils/blogQuery.js`) and `updatePost`'s
  `findByIdAndUpdate` (now load → assign → `save()`, so `pre('validate')`
  runs). ⚠️ **The claim that a `BlogSection.test.jsx` guard "fails by
  design" was FALSE** — measured, 61 of 63 passed against the old rule.
  PF-96 built the discriminating fixture that was missing. Report:
  `new mds/E8/PF-96-blog-api-ordering-search-and-update-fix.md`.
- ~~**PF-97**~~ — **BUILT 2026-09-04.** The inherited `content`-required
  400 was the SMALLER half. The admin editor was bound to the same dead
  field, so **no post was editable at all**: `Edit` opened a blank
  `required` textarea the browser refused to submit, and the post's real
  `sections[]` body was never shown. Now a structured sections editor
  (owner-approved deviation — `Admin.dc.html` still shows the Phase 1
  markdown box), plus the tag vocabulary picker and `?inUse=true`. Report:
  `new mds/E8/PF-97-admin-blog-panel-sections-editor.md`.
- **PF-99**'s EMAIL ME removal is an existing **locked decision**
  (2026-08-22, never built because the reading view does not exist).
- **PF-100** inherits three measured contrast failures raised in PF-91.
  ⚠️ Not a pin-to-dark candidate — it fails in dark, the default theme.

**`/blog` and `/blog/:slug` have no routes yet.** PF-86's five teaser links
point at `/blog` and render `NotFoundPage` today. `Blog.dc.html` is PF-98
and PF-99's design source.

⚠️ **PF-98's tag-chip row is already decided and half-built.** It calls
`GET /api/vocabulary/tag?inUse=true` (PF-97) and prepends `'All'` itself —
`buildMatch` in `utils/blogQuery.js` already treats `'All'` as no filter.
**Do NOT derive the chips from the fetched posts** the way
`Blog.dc.html:327` does: PF-96 made `?q=`/`?tag=` server-side, so the list
response is already filtered and derived chips would shrink as you filter.
Full reasoning and both rejected alternatives in `locked-decisions.md`. **Sprint 14, not 13**, owns `/admin`'s light
theme, `global.css`'s `:root` deletion and the font cutover — one piece of
work, don't pull it forward.

The main page is fully Phase 2 — header through footer. `/admin/*` and
`NotFoundPage` are still Phase 1 layouts, and they go together with
`global.css`'s `:root` and the `body { font-family }` cutover as **one**
piece of work (Sprint 14), not three.

**⚠️ Before cutting any sprint branch, confirm the previous PR actually
merged** — `gh pr view <N> --json state,mergedAt`. Branch too early and none
of the previous sprint's primitives exist, and the first import fails. Check,
don't assume.

### What's ready to build with

All on `master`. Exact paths, because they are not guessable from ticket
names:

```
frontend/
  index.html                     FOUC guard (inline, runs pre-paint) + font <link>s
  src/
    main.jsx                     stylesheet import order is load-bearing, see below
    styles/
      global.css                 Phase 1 :root + the Tailwind import
      tokens.css                 Phase 2 tokens, dual theme, Anton fallback @font-face
      keyframes/
        index.css                single import point — import this, not the parts
        base.css                 the 22 non-variant keyframes
        portfolio.css            flt-portfolio  drift-portfolio  sheen-portfolio
        blog.css                 flt-blog  sheen-blog          (no drift — correct)
        admin.css                flt-admin  drift-admin  sheen-admin  auroraA  auroraB
      animations.css             the .kf-* carriers — see Silent failures
      motion.css                 reduced-motion layer — imported LAST, deliberately
      patterns.module.css        shared structural patterns, pulled in via composes:
    providers/                   ThemeProvider  MotionProvider  SplashProvider
                                 each with its context in a SEPARATE module
    hooks/                       useTheme  useReducedMotion  useSplashReady
                                 useSplashControls  useAbout/useBlog/useProjects/useSkills
                                 useVocabulary — PF-97: the tag/tech pool.
                                 ⚠️ useDeleteVocabulary invalidates the BLOG
                                 caches too; the delete cascades server-side
    components/
      motion/                    index.js barrel — Reveal, CountUp, Marquee
      ambient/                   index.js barrel — PageShell, StarfieldCanvas,
                                 CursorGlow, GrainOverlay
      splash/                    index.js barrel — Splash
      icons/                     BrandIcons.jsx — inline SVG on currentColor
      layout/                    Navbar ThemeToggle Footer SkipLink
                                 ScrollToTop ScrollToHash
    utils/                       ALL React-free and directly unit-testable:
      theme.js                   normalise, readTheme, applyTheme, toggleLabel
      motion.js                  prefersReducedMotion, subscribe…
      nav.js                     navModel, isBlogPath, sectionHref
      splash.js                  shouldShowSplash()
      parallax.js                computeParallaxTransform()
      loginError.js              loginErrorMessage() — see Silent failures
      blogForm.js                PF-97: postToForm/formToPayload/formErrors
                                 + tagList/hasTag/toggleTag/removeTag.
                                 ⚠️ emptySection()/emptyForm() are FACTORIES,
                                 not constants — a shared object hands every
                                 section the same arrays
```

⚠️ **`src/hooks/__tests__/` now exists** (PF-97, `useVocabulary.test.jsx`),
as does `src/components/admin/panels/__tests__/` (the first admin component
test). Both follow the per-module convention; neither existed before.

- **Motion primitives**: `import { Reveal, CountUp, Marquee } from
  '../components/motion'`. `Reveal` needs `type="up"|"pop"|"rise"|"left"`
  matched to the prototype's `data-reveal` for that element.
- **Tokens**: flat tokens + 5 channel triplets, dual-theme via
  `html[data-theme]`. `--acc2`/`--acc2rgb` have **zero** consumers today
  (the sun/moon toggle replaced their only one) — orphaned, not live.
- **Fonts**: `--font-display` (Anton 400 only), `--font-body` (Space
  Grotesk), `--font-mono` (JetBrains Mono), all in `tokens.css`, served
  from the Google Fonts CDN — there are no `.woff2` files in this repo.
- **33 keyframes** — the design's **32**, plus `dot-ok` (2026-08-29, the
  LIVE SITE dot), the only one with no prototype source.
  `keyframes.test.js` keeps it in a separate `ADDITIONS` list so the 32
  still means the design's own set. There are **8** `flt`/`drift`/`sheen`
  variants, not 9: the Blog prototype has no `drift`, so `drift-blog` does
  not exist and never should.
- **Test helpers** live in `src/test/` — currently just `leadsWithIcon.js`.
  The bar for putting one there rather than duplicating per-file is that
  the *assertion itself* is subtle enough to need its reasoning written
  once.

## Commands

Everything runs from `frontend/` or `backend/` — there is **no root
package.json**.

### Frontend (`frontend/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on :5173; proxies `/api` + `/uploads` → `backend:5000` |
| `npm run build` | Production build → `dist/` |
| `npm run lint` | ESLint over the whole package (flat config, `eslint.config.js`) |
| `npm run test` | Vitest **watch** |
| `npm run test:run` | Vitest once — this is what the gate and CI run |
| `npm run test:coverage` | Vitest once + v8 coverage (thresholds enforced in `vite.config.js`) |
| `npm run test:e2e` | Playwright; `e2e/global-setup.js` refuses to run unless the backend's DB name matches `/e2e\|test/i` |
| `npm run preview` | Serve `dist/` on :4173 — the production backend blocks this origin (CORS is exact-match); use `-- --port 5173` to verify against it |

Single test: `npx vitest run src/components/sections/__tests__/HeroSection.test.jsx`
or `npx vitest run -t "renders the marquee"`.

### Backend (`backend/`)

| Command | Purpose |
| --- | --- |
| `npm run dev` | nodemon `src/server.js` on :5050 (macOS AirPlay owns 5000) |
| `npm run dev:e2e` | same, env from `.env.e2e` — port 5055, `portfolio_e2e` |
| `npm start` | `node src/server.js` |
| `npm run seed` | **wipes** Project/Skill/Blog/About/**User** then reseeds from `src/seed.js` |
| `npm test` | Jest via `scripts/run-jest.js` — **never `npx jest`** |
| `npm run test:coverage` | Jest + coverage (thresholds in `package.json`) |

`scripts/run-jest.js` forces `NODE_ENV=test` and rewrites `MONGO_URI`'s
database name to `portfolio_test` (or `TEST_MONGO_URI`). That rewrite is the
only thing making `clearDB`'s wipe safe — bypassing the wrapper points the
suite at whatever `backend/.env` names.

Single test: `npm test -- src/__tests__/blog.test.js` or
`npm test -- -t "increments views by one"`.

### Migrations (`backend/src/migrations/`)

Numbered, idempotent, run in order, read `MONGO_URI` **directly** — point it
at the target database deliberately. `--dry-run` first (reports, writes
nothing), then a real run. Never edit one that has run in production; write
the next number.

```bash
node src/migrations/005-blog-publish-dates.js --dry-run
```

### The gate — run all five, in this order

`npm test` does **not** chain to E2E and CI runs it, so a green
four-command gate can still land a red CI. Frontend and backend suites are
separate.

```bash
cd frontend && npm run test:run
cd frontend && npm run lint -- --max-warnings=0     # CI's exact invocation
cd frontend && npm run build
cd backend  && npm test
cd frontend && npm run test:e2e
```

### Docker & CI

`docker compose up` — frontend :5173, backend :5050→:5000, mongo :27017,
mongo-express :8081. Dev convenience only; production is Vercel + MongoDB
Atlas + Cloudinary.

CI (`.github/workflows/ci.yml`, Node 20): `credential-scan` (greps
`Admin@1234!` outside `seed.js` / `e2e/admin.spec.js` / `postman/`),
`frontend` (lint → test:run → coverage → build), `backend` (Mongo 7
service, `test:coverage`), `e2e` (needs both; seeds `portfolio_e2e`, starts
both servers, runs Playwright).

## Architecture

Two independent packages. The frontend reaches the backend only over
`/api/*` — dev via the Vite proxy, prod via `VITE_API_URL` on a **different
origin**.

### Backend — Express 5 + Mongoose, serverless-shaped

`src/server.js` (local `listen`) and Vercel both import `src/app.js`.
Middleware order in `app.js` is load-bearing:

`helmet` → `cors(corsOptions)` → `globalLimiter` (100 req / 15 min / IP) →
`morgan` → JSON/urlencoded parsers (10 kb cap) → `/uploads` static →
`GET /api/health` → **`connectDB()` middleware** → routes → `notFound` →
multer-error translation → `errorHandler`.

- **`connectDB()` runs on every request**, ahead of all routes, caching the
  connection on `global` across warm invocations. `config/db.js`'s
  `assertExplicitDatabase()` throws if `MONGO_URI` has no database path —
  the driver would otherwise silently use a DB literally named `test`
  (PF-66). It never calls `process.exit`; a failed connect throws and the
  middleware turns it into a 500.
- **`/api/health` sits IN FRONT of that middleware** and swallows connect
  errors, returning 200 with `database: null`. A status-code monitor reads
  green during a DB outage — assert the `database` field instead.
- **Route → controller → model.** `routes/*Routes.js` wire
  `router.<verb>(path, [rules, validate], [protect], handler)`; controller
  functions and their express-validator rule arrays (e.g. `blogRules`) live
  together in `controllers/*Controller.js`.
- **`middleware/auth.js` `protect`** verifies the `Bearer` JWT and sets
  `req.user`. Public GETs are open; writes need `protect`. Admin list
  endpoints are `GET /<resource>/admin/all`.
- **`middleware/validate.js`** runs the rule array and 400s on failure.
- **`errorHandler` + `utils/AppError.js`** are the one funnel — throw
  `new AppError(msg, status)` or `next(err)`; never respond from a catch.
  Per-route rate limiters layer on top (blog view counter is 30/min).
- **Models** (`models/*.js`): User (bcrypt), Project, Skill (`order`), Blog
  (`sections[]`; `slug`, `readingTimeMinutes`, `publishedAt` derived in
  **two** hooks — `pre('insertMany')` on raw POJOs, then `pre('validate')`;
  read the PF-95 / PF-86 entries before touching them), About (a **single**
  document — bio, stats, `resume{url,publicId}`), Contact, Vocabulary.
- **Uploads**: `middleware/upload.js` (multer, 5 MB, memory) →
  `services/storage.js` → `config/cloudinary.js`. `isConfigured()` gates
  the résumé route with a clean 503; `POST /api/upload` has no such guard.
- **Four databases by convention** (see `.env.example`): `portfolio_prod`
  (Vercel), `portfolio_dev` (`backend/.env`), `portfolio_test` (`npm test`
  rewrite), `portfolio_e2e` (`.env.e2e`).

### Frontend — React 19 + Vite SPA

Provider nest in `main.jsx`: `QueryClientProvider` (staleTime 5 min, retry
1, no refetch-on-focus) → `ThemeProvider` → `MotionProvider` → `App`.
`SplashProvider` is mounted lower, inside `HomePage`, so `/admin` and future
Blog routes never carry it.

Stylesheet import order in `main.jsx` is locked and breaks **silently** if
disturbed: `global.css` → `tokens.css` → `keyframes/index.css` →
`animations.css` → `motion.css` (last).

`App.jsx` — `BrowserRouter` with **three separate `<Routes>` blocks** so
chrome can be excluded per route: navbar (all routes except `/admin/*`),
`<main id="main-content">` (`/`, `/admin/login`, `/admin` + `/admin/*`
behind `ProtectedRoute`, `*` → `NotFoundPage`), footer (same exclusion).
`SkipLink` is the first child; `ScrollToTop` is last.

Data flow: component → `hooks/use*.js` (TanStack Query) →
`services/*Service.js` → `services/api.js` (one axios instance). The request
interceptor attaches `localStorage.portfolio_token`; the response
interceptor clears it and redirects to `/admin/login` on a 401 for admin
paths. `apiUrl()` is for URLs the browser fetches itself (anchor hrefs,
`<img src>`), which must be absolute in prod.

`HomePage` is the Phase 2 rebuild: ambient layer (`StarfieldCanvas`,
`CursorGlow`, `GrainOverlay`) + `Splash` gate + sections Hero → About →
Skills → Projects → Blog teaser → Contact, each wrapped in
`<ErrorBoundary>`. API-wired sections: Skills, Projects, Blog, Contact.
About and Hero are transcribed static (PF-81). `/admin/*` is still the
Phase 1 UI.

## Stack

React 19 · Vite · Tailwind v4 · CSS Modules · React Router v7 · TanStack Query v5
Express · MongoDB Atlas · Mongoose · JWT · Cloudinary
Vitest · Jest · Supertest · Playwright · GitHub Actions

## Styling approach

**CSS Modules** (`*.module.css`) for anything copied from the prototype —
gradients, shadows, keyframe applications, layered backgrounds, transforms.
Paste the value verbatim; no translation, no drift.

**Tailwind utilities** for simple layout only — `flex`, `gap-4`, `items-center`.

Rationale: translating `radial-gradient(120% 90% at 78% 18%, rgba(var(--srf),.62)…)`
into a Tailwind arbitrary value needs underscore-escaping, and a mistake **fails
silently** — no error, the element just renders without a background.

Shared structural patterns live in `frontend/src/styles/patterns.module.css`
and are pulled in with `composes:`. Do not generalise a value used once.

**Animations are the one thing a CSS Module cannot express directly.** A
keyframe name written in a `*.module.css` gets scoped and silently resolves to
nothing. Pull the name in with `composes: kf-<name> from global` and keep the
timing values in the module as longhands:

```css
.ringOuter {
  composes: kf-pulsering from global;   /* must be the first declaration */
  animation-duration: 6s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
```

Full reasoning in Silent failures; carriers in `styles/animations.css`.

## React conventions

CI runs ESLint with `--max-warnings=0`, and React 19's hooks plugin enforces two
rules that shape how components here are written. Both cost a full CI cycle at
the end of Sprint 10. Sprint 11 writes far more effects than Sprint 10 did —
two canvases, a splash sequence, scroll and pointer handlers — so read these
before the first `useEffect`.

**Never call `setState` in an effect body** (`react-hooks/set-state-in-effect`).
Derive the value during render instead. This is not a style preference: the
effect version renders once with the wrong value and then re-renders, so the
user sees the wrong frame first. In Sprint 10 that meant `Reveal` painting one
frame of its *hidden* state for reduced-motion users, and `ThemeProvider`
flashing the wrong theme whenever the FOUC guard hadn't run — a FOUC inside the
component built to prevent FOUC. `setState` inside a callback the effect
registers (an `IntersectionObserver` callback, a `requestAnimationFrame` step,
an event listener) is fine and is what effects are for; only the synchronous
body is the problem. The rule reports one violation per effect, so fixing the
first can uncover a second in the same hook.

**A provider file exports components and nothing else**
(`react-refresh/only-export-components`). Contexts live in their own module —
`providers/ThemeContext.js`, `providers/MotionContext.js` — and the provider
imports from there. A context exported alongside its provider forces a full page
reload on every edit instead of a hot swap. `providers/SplashContext.js`
follows the same split, added in PF-75. Any future provider must too, or it
lands on a red CI for the identical reason.

## Silent failures

This project has been bitten repeatedly. **Assume any of these can happen
with no error message.** Every entry below is real and was found here.

**Full mechanism, measurements, build output and mutation records for each:
`.claude/silent-failures.md`.** The list here is the rule and the tell —
go there before working in an area one of these covers, and *always* before
concluding "this is fine, I read the source".

### CSS and the cascade

- **Mistyped custom property** → declaration dropped, element inherits.
- **Mistyped `animation-name`** → element simply does not animate.
  `drift-blog` is the trap: it looks like it should exist by symmetry, and
  it does not.
- **⚠️ Naming a keyframe inside a `*.module.css` breaks it — ALWAYS**, and
  not as a typo class; correct spellings fail too. CSS Modules scopes the
  name and rewrites it in the `animation` declaration, so it resolves to a
  scoped name matching nothing. **Fix: `composes: kf-<name> from global`**
  as the first declaration, timing as longhands (the shorthand resets
  `animation-name` to `none`). ⚠️ `getComputedStyle` reports it as running;
  the only reliable tell is **`el.getAnimations().length === 0`**. 16 live
  declarations shipped this way once.
- **⚠️ A bare `transition:` on a `Reveal`-wrapped element eats the entrance
  easing.** `.reveal` and a section class both land at (0,1,0), so the
  section wins on emission order. **Rule: never declare a `transition` on a
  Reveal-wrapped element — not gated, not at all.** An element that is
  *not* Reveal-wrapped must keep its own. Guarded repo-wide by
  `styles/__tests__/revealTransition.test.js`.
- **`rgba(#hex, .5)`** → invalid, produces nothing. The five channel
  triplets must stay bare `R,G,B`.
- **Redefined `@keyframes` of the same name** → later definition wins.
- **A `var()` inside an `@supports` condition makes it answer `true`
  without testing anything** — the declaration is *assumed valid*, so the
  fallback never applies on the one engine it exists for. Keep conditions
  var()-free; put the token in the rule body.
- **`html[data-motion="reduced"] *` never matches `<html>` itself.** Cost
  the reduced-motion `scroll-behavior` override once. Any property that
  lives on the root needs its own rule.
- **`border-radius` inside a `:focus-visible` rule reshapes the ELEMENT,
  not the ring** — it squares off 999px pills while focused, and only then.
  Omit it; the outline follows the element's own curve for free.
- **⚠️ `backdrop-filter` BEFORE `-webkit-backdrop-filter` ships
  webkit-only, and Chrome ignores the prefix — so the blur silently does
  not render.** esbuild keeps only the last of the pair. **Order:
  `-webkit-` first, standard last.** Shipped broken on the header and
  mobile nav for a full sprint. ⚠️ `CSS.supports()` returns true while the
  property computes to `none`.
- **Two stacked full-size layers: only the top one gets clicks.** Neither
  `z-index: -1` nor ordering saves a backdrop under a full-viewport panel.
  The overlay root must *be* the backdrop.
- **Inline custom property on `<html>`** beats the `html[data-theme]`
  block, making every later `tokens.css` edit dead code. Set `data-theme`
  and nothing else.

### Tests that pass while asserting nothing

- **⚠️ A raw-text CSS assertion can match a COMMENT instead of the rule.**
  This codebase documents removed values in prose exactly where the rule
  was, so the searched-for string is very often in the comment explaining
  it. Produces a **false positive** — passes while asserting nothing.
  **Fix: parse with `postcss`**, or strip comments first. Eight test files
  carry a workaround; five were confirmed blind and caught only by
  mutation. **Not detectable by inspection — mutate it or parse it.**
- **⚠️ `link.firstElementChild === svg` does not test ordering.**
  `firstElementChild` skips text nodes by definition, so the label is
  invisible to it and the icon passes from either position. Use
  `src/test/leadsWithIcon.js`. Generalises: **any `*Element*` DOM accessor
  filters out text**, so none can answer a question about where text sits.
- **A `[class*="name"]` selector silently matches longer class names.**
  `pill`/`pillRow` and `card`/`cardPlaceholder` both exist; the substring
  form counted 31 pills where there were 26. `[class~=]` does not fix it
  (the token is `_pill_f5cf21`). Unwrap the local name and compare exactly.
- **⚠️ A guard against a FUTURE change is vacuous unless its fixture can
  tell the two outcomes apart.** PF-95's "publishedAt is not wired to
  sort yet" absence-assertion was recorded as PF-96's safety net and was
  not one — its fixture's publish-date order coincided with the `_id`
  order it pinned, so **61 of 63 tests passed against the reverted
  rule**. Any "X is what decides" assertion needs a fixture where X-order
  and Y-order DIFFER. Mutation-test a guard when you write it.
- **⚠️ `insertMany` does NOT stamp one identical `createdAt`** — a batch
  routinely straddles a millisecond (measured: 3 of 5, then 1 of 3). A
  test asserting the stamps tie passes alone and in three consecutive
  runs, then fails in the full suite. Corollary: **assert the weakest
  property the test depends on**; a stronger one imports assumptions that
  are not yours to make.
- **A shared mutable test fixture disarms the guard watching it.** A
  "does not mutate" test passed because an earlier test in the same file
  had already sorted the fixture. `Object.freeze` it — the same mutant then
  fails 13 tests instead of 0. ⚠️ Mutation-test with the **whole file**,
  never `-t`.
- **⚠️ A green test suite actively HIDES dead code.** A module's own test
  file keeps passing forever after its last consumer disappears, so the
  suite says *alive* about unreachable code. Count consumers by grepping
  the identifier and **discounting the module's own file and its own
  test** — that discount is what makes the count look non-zero if skipped.
- **A stability check that accepts the first plateau is a timer wearing a
  measurement's clothes.** Under load the main thread stalls, which pauses
  a smooth scroll — two readings then agree mid-animation. Retry the whole
  check (`expect.poll`), and make sure the failure state does not also
  satisfy the predicate.
- **Polling a predicate the failure state also satisfies is a vacuous
  poll** — it returns on the first tick and a later assertion eats the
  failure. The poll must cover the whole condition.
- **`document.body.focus()` is a silent no-op in jsdom** (`<body>` is not
  focusable), so a test simulating "focus escaped" asserts a different case
  than it names. Use `document.activeElement.blur()`.
- **CSS-Module rules are invisible to Vitest** — no stylesheet is ever
  applied and `document.styleSheets.length === 0`. Assert stylesheets as
  parsed text; assert the DOM only for what JS writes inline. ⚠️ This means
  "use the CSSOM" is *not* available as the fix for the comment trap above.
- **`el.style.opacity` reads back normalised** — a component writing the
  prototype's `'.13'` reads back `'0.13'`. Assert the effective value.

### Tooling and gates whose scope is narrower than it reads

- **`npm test` does not run the E2E suite**, and CI runs it. A "full" local
  gate can be green while CI is red. **Run all five commands.** ⚠️ Unit
  green + E2E red is the signature of a **removed feature whose tests were
  not cleaned up**; unit *red* means broken code — opposite diagnoses.
- **⚠️ Name the lint SCRIPT, never a path.** `npm run lint` once covered
  `src/` only, so eight root config files were linted by nothing — CI
  included, because CI runs the script. A live `no-undef` sat in
  `vite.config.js` for ten days. A documented path is a second source of
  truth that drifts; the script cannot.
- **A tool given an explicit path lints exactly that path, and a file's
  absence from the report is indistinguishable from a clean file.** Check
  what a gate command actually covers before trusting "exit 0".
- **`playwright-report/` and `test-results/` are git-ignored and were not
  ESLint-ignored**, so `eslint .` reported 642 errors in vendor code after
  any E2E run — the gate breaking itself. Same for `dist-*/`, which this
  file's own verification recipe creates.
- **The root `.gitignore` has no `node_modules` entry** — running vitest
  from the repo root leaves an untracked cache file that `git add -A`
  would stage.
- **A test file under `src/` ships dead CSS** — Tailwind v4 scans it and
  emits any bare utility-looking token into the shipped stylesheet.
  `global.css` carries `@source not` for `__tests__/` and `*.test.js`;
  a helper named outside those patterns is **not** excluded.

### Playwright and E2E

- **`toBeVisible()` ignores occlusion** — an element fully covered by the
  splash still passes. `click()` is the opposite: actionability hit-tests,
  so a click under the splash silently retries for ~5.65s rather than
  failing. A slow suite, not a red one.
- **⚠️ `test.use({ reducedMotion })` is silently INERT here** — measured
  `matches === false` at file and describe level. Use
  `await page.emulateMedia({ reducedMotion: 'reduce' })` in the test body
  **and assert the emulation took**. Same caution for `colorScheme` and
  `forcedColors`.
- **`page.route()` matches handlers in REVERSE registration order** — a
  narrow stub registered before a `**/api/**` catch-all is silently
  overridden. **Register the catch-all FIRST.**
- **⚠️ `reuseExistingServer` will adopt a STALE dev server** with whatever
  env it was launched with, so the suite drives the real page against the
  *development* database. Everything renders; only the data is wrong.
  Now `!!process.env.CI` — the inverse of the usual idiom, deliberately.
  Check what is on 5174 before believing any E2E auth failure.
- **A duplicated in-page anchor turns a selector into a strict-mode
  throw**, and it reads as the feature being gone. The footer repeats all
  six section anchors. ⚠️ `getByText` **ignores `aria-hidden`** (only
  `getByRole` respects it), so a decorative marquee still breaks a text
  locator. Scope to the landmark.
- **Playwright reports `flaky` in a bucket separate from `passed`**, so a
  suite that ran everything can read as one that skipped tests. Diagnose
  from the JSON reporter's per-attempt data. ⚠️ Redirect stdout to a
  *different* file than the reporter writes.
- **The backend rate-limits at 100 req / 15 min / IP.** Automated browser
  verification exhausts it easily; it presents as sections rendering their
  error state for no reason. Prefer `route.fulfill()` with a fixture.
- **The E2E contact spec writes a row per run and never cleans up** —
  `portfolio_e2e.contacts` grows monotonically. Not a usable signal there.

### Backend, database and environment

- **A connection string with no database path** → the driver silently uses
  a database literally named `test`. **This already happened here** and is
  why `assertExplicitDatabase` exists (PF-66). ⚠️ Production is
  `portfolio_prod` now; `test` still exists as a frozen rollback, so
  anything pointed at it reads a stale snapshot. Re-read, don't remember.
- **⚠️ A production outage where `/api/health` returned 200 throughout.**
  It sits *in front of* the `connectDB()` middleware and swallows connect
  errors. **`database` is the only field carrying the truth** — assert it
  is a non-null string, ideally the expected name.
- **A red backend suite has FOUR distinct shapes**, all on diffs that never
  touched the backend: a **timeout** (no `expect` diff), **SRV DNS**
  (`querySrv ENOTFOUND`, every route fails), **isolation residue**
  (`E11000` in a `beforeEach`), and a **real assertion diff** caused by a
  transient connection — a 404 test receiving 500, because `connectDB()`
  runs ahead of the router. ⚠️ So "no `expect` diff" is *not* the reliable
  discriminator; **reproducibility is**. `mongodb-memory-server` removes
  all four.
- **`mongodb+srv://` needs SRV DNS** — a broken resolver presents as a
  broken backend. Compare your resolver against `1.1.1.1`. ⚠️ Do NOT "fix"
  it by hardcoding shard hostnames in the repo.
- **The CORS allowlist is exact-match**, so a stale dev server on an
  incremented Vite port breaks every API call while the site loads fine.
  A dev-port range is allowed in **non-production only**.
- **A single fallback error string collapsed "wrong password" and "no
  server" into one message.** No `err.response` fell through to the
  credential sentence. Fixed by `utils/loginError.js`. ⚠️ The
  documentation half matters too: it shipped inside an unrelated commit
  and was invisible here for three sprints.

### Prototype-specific

- **⚠️ A prototype element's real behaviour often lives in the SCRIPT
  BLOCK, not its `style` attribute.** Four times now: `data-cardbg`,
  `data-cv`, `data-strip`/`data-ok`, `data-heroimg`. **Grep the script for
  the element's own attribute before calling an href dead or a value
  complete.**
- **The prototype's reveal transition is INLINE and PERMANENT** —
  `hideReveals()` writes it and nothing clears it, so a revealed element
  eases *every* later property change including hover. "The stylesheet
  declares no transition" does not mean "it snaps".
- **Prototype line 834 reads an undeclared `acc`** → transcribe as
  `self.accColor`. The only known case of the prototype being wrong, and
  it is a JS bug, not a design value.
- **Grain's `0.42` opacity looks like a bug and is not** — `paintGrain()`
  overwrites the theme value on mount, in both themes. Reordering the two
  effects silently changes the shipped look.
- **A design image referenced by URL 404s in silence.** `docs/design/assets/`
  is not served. Copy into `frontend/src/assets/` and `import` it, so an
  unresolvable path fails the build loudly.

### Measurement

- **⚠️ CLIPPED and OCCLUDED look identical in a screenshot and are
  opposite defects** — one is overflow, one is stacking. Every box
  measurement reports clean on an occluded element, because every box *is*
  clean. **Hit-test it** (`elementFromPoint`). Third member of a family
  with the splash gate and `toBeVisible()`: **a position-based check
  cannot see what is painted on top.**
- **⚠️ The optimisation that makes a probe fast is what puts a surface
  outside it.** `?nosplash` removed the entire splash from every audit —
  five AA failures went unmeasured through a ticket whose whole purpose was
  the a11y contract. Same shape as a probe that never scrolled far enough
  to mount `ScrollToTop`. **Name what a probe EXCLUDES in the same breath
  as its result.**
- **Always run the control.** A broken probe reports zero exactly like a
  clean one. ⚠️ A rAF-based counter **self-drives** and reads ~61 in both
  modes — `getAnimations()` filtered on `playState === 'running'` is the
  instrument that works.
- **`:focus-visible` DOES match a programmatically-focused element** —
  Chromium keys on input *modality*, so a `.focus()` after an Enter press
  matches. ⚠️ And a UA default ring sits behind ours; only an explicit
  suppression removes it.
- **`scrollWidth === clientWidth` proves nothing about whether a page looks
  right on a phone.** Three real defects — a field off-screen, two chips
  sliced in half, the primary nav at 32px — all sat behind an ancestor that
  clips, a media query a sweep never fires, or a width band nobody tests.
  **Open the menus and look at the screenshots.**
- **⚠️ A `<button>` inside a `<form>` with no `type` is a SUBMIT button,
  so a dialog rendered inside a form saves the form.** PF-97's tag-delete
  confirm sat inside the post `<form>`; "Yes, Remove" deleted the tag AND
  silently saved and closed the post. **It looked like it worked** — the
  tag really was gone. Caught only by a test asserting the editor was
  still open. The sibling Delete-Post modal escapes it purely by being
  rendered outside the form. **Always `type="button"` on any button that
  is not the form's submit.**
- **⚠️ Snapshot for a mutation restore AFTER the edit under test, and
  ALWAYS run a control.** In PF-97 the copy was taken *before* the
  feature was written, so the first restore silently reverted it and
  four later mutations ran against code that no longer contained the
  fix — reporting failures that meant nothing. The only tell was the
  **control run** failing. A failing control means a broken harness,
  not a broken fix. ⚠️ The documented "restore from a copy, not `git
  checkout`" rule does NOT protect you if the copy is of the wrong
  state.
- **Mutate the code, then confirm the file actually changed.** Several
  mutations reported clean because the regex hit a *comment* naming the
  value, or did not match at all. ⚠️ And restore from a **copy**, never
  `git checkout`, while unstaged work is in the tree — that silently
  reverted a real edit once.

Where a mistake would be silent, add a test that would catch it.

## Locked decisions — do not reopen

**Full reasoning, measurements and revision history for every entry:
`.claude/locked-decisions.md`.** This list is what is decided; that file is
why. Read the full entry before changing anything here — several of these
reverse an earlier decision, and both halves are recorded there so a
settled question does not get re-derived from scratch.

Every deviation below was **raised and approved before shipping**. That is
the process, and it is not optional: see "Where you can exceed the
prototype" above.

### ⚠️ `docs/design/` is FROZEN as of 2026-08-22

Nothing is written there. Re-exporting from Claude Design was considered and
**rejected finally** — a re-export regenerates the whole file, and an
unrequested token change would arrive carrying design authority while every
test stayed green.

**Consequence, accepted: the prototype no longer shows the site's real
header.** Anyone diffing live against the `.dc.html` files WILL see
differences. The sanctioned-deviation entries are the only record that they
are intentional — a fidelity pass that cannot find them will "restore" the
prototype's switch, its loud ADMIN pill and its inboard logo.

### Sanctioned deviations from the prototype

Each is owner-requested. **Do not "restore" any of them to match the
export** — the mismatch is deliberate and is exactly what a fidelity check
flags as a bug.

**Reductions** — the only three:
- **Cursor web toned down twice** — `WEB_LINK_PX` 150 → **105**,
  `WEB_ALPHA` 0.14 → **0.065**. The cursor→star spray is a *separate* line
  family, still at the prototype's 0.3, and is the next lever if needed.
- **The splash's two travelling scan lines removed** (elements, not just
  their animation). ⚠️ `.scanTexture` is a different element and **stays**.
  Splash is **12** animated elements, not 14.
- **The hero marquee band slimmed** — font and padding together; 84px → 52px.

**Removals** — each is the element, not just its paint, and each has a
sibling that must NOT be swept up with it:
| Removed | Keep |
| --- | --- |
| Contact's accent glow layer | `overflow: hidden` — the prototype's own |
| Blog featured card's ghost `01` | `.sweep`, and the 02/03/04 numerals |
| About portrait's caption | `.portraitFade` |
| Blog reading view's "GOT A QUESTION" block (decision only, unbuilt) | — |
| REPLAY INTRO + SCROLL BACK UP from the footer | — |
| All section washes, site-wide | card and panel surfaces |

⚠️ The section-wash removal was **narrowed on 2026-08-27**: the footer now
takes the navbar's surface (`rgba(var(--ftr),.86)` + blur). Chrome vs
section is the distinction. The prototype's own footer *gradient* is still
omitted — keep the two straight.

**Additions and overrides:**
- **Hero**: a fourth pill-row item (the LOUD CTA), **ten** floating chips
  not eight, a two-layer `mask-image` on the portrait (both radii **50%**,
  both `mask-composite` spellings required), `.blobC` at **z-index 2** not
  the prototype's 4.
- **Nine links carry brand icons** the prototype has no icon for; all
  `aria-hidden`, trailing `→`/`↗` retained. ⚠️ `public/icons.svg` is
  unusable — hardcoded fills, zero consumers.
- **LIVE SITE carries a pulsing green dot** — added `@keyframes dot-ok`,
  the 33rd and the only one with no prototype source.
- **Marquee `copies` exceeds the prototype's 2** — hero **8**, footer
  **18**. The requirement is `copies ≥ 2 × band / copy`, **not**
  `copy ≥ band`. Counts must stay **EVEN**.
- **Both bands run at 50 px/s** — hero 84s, footer 70.7s. Equal **SPEED**
  is the contract; equal duration is the bug. Durations are un-round
  because they encode one speed over two distances.
- **`STAR_DRIFT = 0.35`**, 3.89× the prototype. ⚠️ No design source — an
  owner call, not "what Admin does". Guarded as *direction*, not an exact
  number, so re-tuning by eye does not turn the suite red.
- **The About portrait is a different photograph.** ⚠️ Never point an
  import at the `.heic` — only Safari decodes it and Vite emits it without
  complaint.
- **Smooth scroll**, which the prototype does not use. CSS, not a JS
  `scrollTo`, so it covers back/forward and typed hashes.
- **`data-terminal` attached** to the terminal panel, activating a
  `tokens.css` rule that had never matched an element.

### Chrome (the 2026-08-22 navbar rework)

- **The header is FULL-BLEED** — no `max-width`. ⚠️ This *reversed* a
  same-day decision that added one. **Accepted consequence: above ~1320px
  the header no longer aligns with section content.** Restoring the cap to
  "fix" that is the thing that was rejected.
- **ADMIN is isolated as chrome** — outline, not fill; **`--muted`, not the
  requested `--muted2`**, which fails AA in dark here. Isolation comes from
  FORM, not darker ink. ⚠️ `.adminDivider` was built and **removed**;
  `.divider` (the prototype's, on the toggle's LEFT) **stays**. ⚠️ The
  requested `margin-left: auto` is a **silent no-op** in this layout — do
  not add it back.
- **The theme toggle is a 44×44 sun/moon icon button**, not the prototype's
  switch. ⚠️ 44 is chosen to **equal the logo** — it is what keeps
  `--header-h` at 71px, which every section's `scroll-margin-top` reads.
  The icon shows the **destination**. Glow is **theme-scoped** and uses
  `drop-shadow`, never `box-shadow`.
- **The navbar is route-aware** — bare hashes on `/` (e2e depends on it),
  absolute `/?nosplash=1#…` elsewhere, Blog's own nav on `/blog*`.
- **`ScrollToHash` is gated on splash readiness and passes NO `behavior`
  argument**, so it inherits the root's `scroll-behavior` and the
  reduced-motion override reaches it. It is mounted **inside
  `SplashProvider` in `HomePage`**, not `App.jsx` — an App-level mount
  compiles, renders, and silently skips the gate.
- **`--header-h` is 71px, and it is measured** — 12 + 44 + 12 + 2 + **1px
  border**. The ticket's estimate of 70 dropped the border.

### Motion and accessibility

- **Hover lifts are UNGATED under `prefers-reduced-motion`** — transitions
  are already collapsed, so a lift is an instant state change, same
  category as the `border-color` beside it. `.reveal`'s opacity stays
  unconditional; only the transform half is `:not(:hover)`.
- **The card hover-transition deviation was WITHDRAWN** (PF-93). Both cards
  let `Reveal` own `transition`. Do not re-add one.
- **PF-91 contrast pass** — five groups, all approved, all deviations from
  prototype values: `--muted2` → `--muted` in **dark only** on tinted
  surfaces; `--faint` → `--muted`; the terminal panel's ink becomes
  **literal**; `--ok` light `#0E7A55` → **`#0B6446`**; both Blog separators
  unified on `var(--acc)` at `.9`. Result: **zero AA failures** across the
  Phase 2 surface, both themes.
  - ⚠️ **The SURFACE decides, not the colour.** `#34d399` stays literal on
    the terminal (deliberately dark in both themes) and becomes `var(--ok)`
    on the form. Three files apart this looks like an oversight;
    "unifying" it reintroduces a 2.82:1 line while reading as a cleanup.
- **PF-91 exemptions, decided not omitted**: the six decorative numerals
  (all `aria-hidden`) and the 17 control borders (every one on a control
  whose *label* passes) stay as they are.
- **`main[tabindex="-1"]:focus { outline: none }` is the repo's ONLY
  `outline: none`.** ⚠️ The scoping is the entire justification —
  discriminator is whether a keyboard can **OPERATE** the element, not
  whether it can receive focus. Never quote it to excuse an unscoped one;
  Contact's fields resolve the same question the *opposite* way.
- **About's stat labels are one token lighter in DARK only.** Wins on
  **specificity** (0,2,1), never emission order.
- **Splash timing**: `SPLASH_MS` **4500** (slightly *shorter* than the
  prototype's 4600). Boot lines and `BAR_TICKS` are **DERIVED** from it, so
  changing it keeps everything in step. The exit is a fixed timer and must
  **not** be driven by the bar reaching 100%.
- **Mobile nav overlay**: the ambient layer shows through; z-index 80;
  breakpoint 768px; **the overlay root IS the backdrop** (one element).

### Architecture

- **No frontend animation libraries.** CSS keyframes plus vanilla JS. Not
  reopened by an argument that some library is better architecture.
- **Channel-triplet tokens stay triplets.**
- **`tokens.css` imports AFTER `global.css`** in `main.jsx`; `motion.css`
  is LAST. The order is load-bearing and breaks silently.
- **Tailwind `@theme` uses `var()` references** to `tokens.css`, so colour
  utilities follow the theme. Opacity modifiers degrade to full opacity on
  pre-2023 engines — known and accepted.
- **Fonts are deliberately NOT in `@theme`** — `--font-*` collides with
  `tokens.css`'s own names, so the reference would be self-referential.
- **`body { font-family }` is NOT set until cutover**, so Phase 1 keeps
  Inter.
- **A context lives in its own module**, separate from its provider —
  `react-refresh/only-export-components` fails CI otherwise. This has cost
  a lint cycle three times.
- **`SplashProvider` fails open** (`{ ready: true }` default, no throw
  outside a provider), unlike Theme and Motion. A missing theme is a bug
  worth surfacing; a missing splash is the normal case.
- **Splash read and write are separate hooks** — `useSplashReady()` and
  `useSplashControls()` — so every consumer of splash state is not also
  able to control it.
- **Projects: the big card is chosen by `order`, the badge by `featured`.**
  ⚠️ An unfeatured first project renders **nothing** in that slot, never a
  `01`. Reordering is an admin-panel edit, not a code change.
- **ClearDrive keeps 10 tech pills**; the prototype's 9 is stale. The API
  wins here — opposite resolution to PF-82's skill-order finding, and
  deliberately so.
- **CORS allows a localhost dev-port range in NON-PRODUCTION only.**
  Production stays exact-match.
- **Cursor-web frame budget**: lower the 80-node web cap first; the 2600
  star-density divisor is the fallback.
- **Vocabulary deletion is hard-delete with cascade**, behind an
  impact-count confirm.
- **Cloudinary for file storage**, behind a provider interface.
- **Résumé is PDF only; a new upload hard-deletes the old.**
- **Blog content is `sections[]`**, not a flat string.
- **The admin Blog editor is a STRUCTURED SECTIONS EDITOR, not the
  prototype's markdown textarea** (PF-97, owner-approved 2026-09-04).
  ⚠️ `Admin.dc.html:478-481` still shows the single "Content * (Markdown
  supported)" box — it predates PF-59's schema change. **Restoring it to
  match the export re-breaks the panel completely.**
- **The admin Blog form has the design's TAG CHIP PICKER**, backed by the
  `Vocabulary` API that PF-61/PF-62 built and nothing consumed until
  PF-97. The comma-separated text input **stays alongside it** — one is
  for a one-off tag, the other for the shared pool. ⚠️ The `×` is a
  **cascading delete across every post**, behind an impact-count confirm.
- **`/blog`'s chip row = pool tags carried by at least one PUBLISHED
  post** — `GET /api/vocabulary/tag?inUse=true`, PF-98 prepends `'All'`.
  ⚠️ Not the whole pool (dead chips) and NOT derived from the fetched
  posts (PF-96 filters server-side, so they would shrink as you filter).
- **`impact` and `?inUse=true` use DIFFERENT filters on purpose** — impact
  counts every post including drafts, inUse counts published only.
  Unifying them breaks one or the other.
- **The `tech` chip picker for Projects is still NOT built** — same API,
  different form, its own ticket.

## Environment

macOS, zsh. Use `brew`, `jq`, `sed -i ''` with the empty argument, `~` not
`%USERPROFILE%`.

Backend runs on **port 5050** — macOS AirPlay occupies 5000. Inside Docker the
internal target stays `backend:5000`.

E2E runs isolated: database `portfolio_e2e`, backend 5055, frontend 5174.

Prefer `lsof -sTCP:LISTEN -ti:PORT | xargs kill` over pattern-matched
`pkill`. **The `-sTCP:LISTEN` is not optional.** A bare `lsof -ti:PORT`
returns every process holding a socket on that port, clients included, not
just the listening server — so piping it to `kill` takes down whoever is
*connected* to your dev server along with the server. Concretely, a port
audit on 2026-08-18 found four PIDs on 5173/5174/5055/5050 but only three
listeners: the fourth was **Google Chrome** (PID 11172), holding
`[::1]:58572->[::1]:5173 (ESTABLISHED)` because a tab was open on the dev
server. `lsof -ti:5173 | xargs kill` would have killed the browser.
Re-running with `-sTCP:LISTEN` drops it and leaves exactly the three
servers. That same OR-vs-AND trap applies to `lsof`'s selectors generally:
`-p PID -iTCP` unions them and prints every process's TCP sockets — use
`-a` to intersect (`lsof -nP -a -p PID -iTCP`).

Backend tests live in `backend/src/__tests__/`. Run via `npm test`, never
`npx jest` — the wrapper rewrites the Mongo URI to `/portfolio_test`, which is
the only thing making `clearDB`'s wipe safe.

Frontend tests use **per-module `__tests__` directories** — `src/utils/`,
`src/styles/`, `src/providers/`, `src/hooks/`, `src/components/motion/`,
`src/components/ambient/`, `src/components/splash/`,
`src/components/layout/` and `src/components/sections/` each have their own.
Not a top-level `src/__tests__/`.

**Shared test HELPERS — as opposed to test files — live in
`src/test/`**, beside `setup.js`. There is exactly one so far:
`src/test/leadsWithIcon.js` (2026-08-29), used by four `__tests__`
files. The bar for putting one there rather than duplicating it
per-file, the way `localName`/`pick` are duplicated, is that the
ASSERTION itself is subtle enough to need its reasoning written once —
that helper exists because the obvious version of the check is silently
vacuous (see Silent failures). A plain convenience wrapper should still
be copied into the file that uses it.

⚠️ It is `leadsWithIcon.js`, not `.test.js`, and not under a
`__tests__/` directory. That matters beyond tidiness: `global.css`'s
`@source not` rules exclude exactly those two patterns from Tailwind's
scan, so a helper named either way would be excluded — but one named
like this is NOT, and any bare utility-looking token in it would be
emitted into the shipped stylesheet. Verified for this file by building
with and without it: **67,767 bytes either way**, so it leaks nothing.
Re-check that if a second helper lands here.

**One file deliberately breaks that convention**:
`styles/__tests__/revealTransition.test.js` (PF-93) reads every
`components/**/*.jsx` and every `*.module.css` under `src/`, because it is
a repo-wide structural guard rather than a module's own test — there is no
single module it belongs to. The PF-93 ticket placed it there. If a second
cross-cutting guard appears, this is the precedent to follow rather than
inventing a `src/__tests__/`.

**The first push of a new branch is always `git push -u origin <branch-name>`,
never a bare `git push`.** This is not style — PF-75 was pushed straight to
`master`, bypassing the sprint branch and its PR gate, and the cause is a
default that will repeat on every sprint branch created the same way.

Creating a branch from the remote-tracking ref (`git checkout -b sprint-N-x
origin/master`, or picking `origin/master` as the source in VS Code) triggers
Git's `branch.autoSetupMerge` default of `true`: branching from a
remote-tracking ref sets upstream automatically, so the new branch inherits
`branch.<name>.merge = refs/heads/master`. That reads as "my upstream is
master," and any push honouring it lands on `master`. VS Code's Git extension
pushes to the configured upstream refspec, so its push button does exactly
that with no warning. Verified on `sprint-11-main-page`, whose reflog reads
`branch: Created from origin/master`.

Sprint 9's and Sprint 10's branches were fine because their upstreams were set
by an actual `-u` publish. That is the habit to keep: `-u` on first push
overrides whatever upstream the branch inherited at creation, so it makes the
mistake impossible regardless of how the branch was created. Branching from
local `master` instead of `origin/master` also avoids it, but relies on
remembering at creation time rather than at push time.

Check with `git branch -vv` before pushing. The bracketed name is the upstream —
if it does not match the branch's own name, a push will go somewhere else.

After a push, confirm the remote actually moved: `git ls-remote --heads origin
<branch>` must match local `HEAD`. Compare them rather than assuming the push
landed because the command exited cleanly — that is exactly how PF-75 reached
`master` unnoticed. Claude does not run the push (see Working agreement), but
should offer this check when asked whether one landed.

## Working agreement

### ⚠️ Ticket authoring — CHANGED 2026-09-02, applies from PF-96 onward

**The owner states the plan. I write the ticket. The owner approves it. Then
I implement.** Direct instruction, and it inverts how every ticket up to and
including PF-95 was run.

| | up to PF-95 | **from PF-96** |
| --- | --- | --- |
| who writes the ticket | the owner, as a `.md` pasted into chat | **me**, from the owner's stated plan |
| what it was to me | the source of truth, to follow | **a proposal, to be approved** |
| approval | implicit — it arrived written | **explicit, and required before any code** |
| implementation | after reading the doc | **only after the owner approves the ticket** |
| commit | the owner's | **the owner's — unchanged** |

**The sequence, and do not collapse it:**

1. The owner describes what they want, in their own words.
2. **I write the ticket** — scope, the files it touches, the approach, the
   verification, and what is explicitly out of scope. Grounded in what the
   code actually does today (trace first, per Engineering discipline) and in
   what the companion files already record about the area.
3. **I stop and wait for approval.** No implementation before it, and no
   treating a "yes, that sounds right" about the *plan* as approval of the
   *ticket*.
4. **Implement.**
5. **Test.**
6. **Recheck, re-test, fix what surfaces** — an explicit second pass, not a
   re-run of the first. This is where mutation testing, the live/browser
   checks and the five-command gate belong.
7. **Write the ticket report as a `.md` FILE** (below). Not a chat summary —
   a file, every time.
8. **Write the commit message and stop.** The owner reviews and commits by
   hand.

### ⚠️ The ticket report — a required deliverable after EVERY ticket

Added 2026-09-02 by direct instruction. **Its purpose is the owner's own
learning**, so it is written to teach, not to summarise. A report that
proves the work happened but leaves the owner unable to explain the change
to someone else has failed, however accurate it is.

**Where:** OUTSIDE this repo, in the owner's own notes tree, one folder
per Jira epic:

```
/Users/chami02/Documents/Personal/Projects/Portfolio/new mds/E<N>/PF-NN-short-description.md
```

Sprint 13 is Epic 8, so `new mds/E8/`. Say where it was written when
handing over.

⚠️ **This said `docs/tickets/PF-NN.md` until 2026-09-02 and that was
wrong** — corrected by the owner during PF-96. `docs/tickets/` has never
existed; PF-95's report was in `new mds/E8/` all along
(`PF-95-blog-publish-dates-and-reading-time.md`, the template to follow
for depth). Do not create `docs/tickets/`.

**It must answer three questions, in this order and separately:**

| | |
| --- | --- |
| **WHAT** | what changed — every file, every code block |
| **HOW** | the mechanism — how the change actually works, walked through |
| **WHY** | why this way — what was rejected, and what breaks without it |

**Every single change gets its code shown, with its file path.** Added,
deleted, updated, upgraded, downgraded, moved, renamed — no exceptions and
no summarising a diff in prose. For each:

- the **full path** (`backend/src/models/Blog.js`), and whether the file is
  **new**, **modified** or **deleted**
- the code **before** and **after** for a modification; the code itself for
  an addition; what was there for a deletion
- **why that change**, at that place — the mechanism, not the intent alone

**Also required:**

- **The trace** — what the code did *before*, established by reading it, and
  where the defect actually lived. This is usually the most educational part
  and is the thing a diff cannot show.
- **What was rejected and why.** The alternative that looked right and
  wasn't is worth more than the fix, because it is what stops the same wrong
  turn next time.
- **Test results, real numbers**, from steps 5 and 6 — counts, not
  "passing". Both passes, including anything that failed in between and what
  it turned out to be.
- **Bugs found during recheck**, with their cause. A ticket where the second
  pass found nothing should say so explicitly.
- **Anything found but deliberately NOT fixed**, and why — these go to
  Outstanding work in `sprint-log.md` too.
- **The commit message**, at the end.

⚠️ **Write it for someone who does not have the conversation.** No "as
discussed", no "the fix we talked about" — the file is the record, and it is
read later without the session that produced it.

⚠️ **The report does not replace updating `.claude/`.** Findings still go to
`sprint-log.md`, `silent-failures.md` or `locked-decisions.md` as they
always have. The report teaches the ticket; those files carry the standing
rules. Doing one and not the other loses either the lesson or the rule.

⚠️ **A ticket I authored has NO independent authority.** A pasted ticket was
the owner's instruction; one I wrote is my own reasoning, so it cannot be
cited back as justification — "the ticket said so" is now circular. If
implementation shows the ticket was wrong, say so and re-plan rather than
building to a plan I know to be wrong. The whole point of the approval step
is that the owner has seen it; changing it afterwards needs them again.

⚠️ **This raises the stakes on the prototype rule, not lowers them.** With
the owner writing tickets, a scope error surfaced in their own words. Now it
surfaces in mine — so "the prototype wins", "trace before you write" and "no
speculative surface" are what keep an authored ticket honest.

**Historical note:** older entries in this file say a pasted `.md` is the
source of truth for its ticket, and describe correcting tickets that were
wrong about paths or mechanisms. That was accurate through PF-95 and is why
those corrections are recorded. It no longer describes how tickets arrive.

**Never run `git commit`. Committing is the user's, on every branch.**

Stated directly by the user on **2026-08-17**, during PF-79, after four
commits had gone in under the previous authorization: *"dont commit by your
self keep it to me as my part."* No sprint-branch exception, no
"as work completes" — Claude prepares the work and hands it over, the user
authors the commit.

This is a standing instruction, not a per-session mood. Do not infer that a
`sprint-N-*` branch, a green test run, or an explicit "go ahead" on a *ticket*
re-opens it — "go ahead" authorizes the work, never the commit. Only the user
saying so in as many words does.

**Handing off instead.** Do the full verification (tests, lint, browser
checks) and report it, stage nothing unless asked, and make
`git status --short` plus `git diff --cached --stat` the **last** thing run
before handing back — see the staging-drift note below for why the timing is
load-bearing. Say plainly what changed, what is staged, what is not, and why.
Writing a suggested commit message into chat is useful and welcome; running
`git commit` is not.

Pushing was already the user's and stays that way. When asked whether a push
landed, offer the check — `git ls-remote --heads origin <branch>` must match
local `HEAD`, compared rather than assumed.

History of this permission, since it has moved several times and the reasoning
matters more than the verdict:

- Granted in `dfe813e` (2026-08-16), scoped to sprint branches.
- Revoked ~2 hours later inside `9ad74c0`, the PF-77 *feature* commit, with no
  mention in that commit's message.
- Restored on 2026-08-16 after that revocation's stated evidence was checked
  and did not hold up: it cited PF-61 (2026-08-08), but this file did not exist
  then — created 2026-08-13 in `5be0e66` — so nothing said during PF-61 could
  countermand a permission granted eight days later. That left one instance,
  not a pattern.
- **Revoked for good on 2026-08-17 by direct instruction**, quoted above. This
  one needs no inference and rests on no disputed evidence, which the earlier
  two did. It supersedes `dfe813e` entirely.

If it is ever restored, it takes an unambiguous statement from the user, and
the restoring commit's message must say so.

**Stage exactly the files the ticket touches** — `git add <paths>`, never
`git add -A` or `git add .` — and run the full verification (tests, lint,
browser checks) before committing, reporting it. When handing off *without*
committing, show `git status --short` and `git diff --cached --stat` as the
**last** thing before doing so, and say plainly what is staged, what is not,
and why. Either way the index moves on its own here, so the check is the last
thing run, never merely an earlier one.

VS Code's Git extension has staged things nobody asked it to **four** times now.
The first two were unintended files appearing in the index. The third, during
PF-76's follow-up just before `22cf50c`, is why the timing above is spelled
out: `.claude/CLAUDE.md` was checked and confirmed *unstaged* — deliberately
held back for its own commit — then showed up staged a few minutes later, with
no command run against it in between. The earlier clean check proved nothing
about the index by the time the commit came.

The fourth was PF-77: the same file, again deliberately held back and again
confirmed unstaged right after `git add` of the six code files, was staged by
the time the ticket was reported done. Nothing ran against it in between. So
the check binds at both moments — immediately before a commit, and immediately
before a hand-off — because a drift nobody re-checks lands silently either way:
the commit succeeds regardless and its message says nothing about docs. That is
exactly how `9ad74c0` came to carry a Working-agreement rewrite under a feature
message.

The mechanism differs from the first two: staging *drift* on an already-tracked
file, not new files appearing. `git status --short` catches both, but only as
the last thing run before handing off. Check content as well as the file list —
confirm the staged diffstat still matches what was actually reviewed.

**Never paste a credential into chat — not a connection string, not a
`.env` line, not a token.** Read the value's *shape* if you must
(`does MONGO_URI end in a database path?`), or have the tool print only
what is being asked about; never the whole line. A conversation is not a
secure channel, and the only remedy afterwards is rotation.

Written down on **2026-08-31**, after the third incident, because it had
been a habit rather than a rule and habits do not survive a session that
is busy with something else:

- **PF-49 (2026-07-19)**, found 2026-08-07 — real Atlas password and JWT
  secret committed to `backend/.env.example` in a **public** repo. Both
  rotated, the file restored to placeholders, `.env` added to
  `.gitignore`, GitHub's secret-scanning alert closed as *Revoked*.
  History was never rewritten; the dead credential is still visible in
  `88c9e2c` and is inert.
- A second occurrence, remediated the same way.
- **2026-08-31**, during the database restructure — the full
  `mongodb+srv://` string, password included, pasted while working out
  which database was production. `portfolio_admin`'s password rotated in
  Atlas and propagated to `backend/.env`, `backend/.env.e2e` and
  Vercel's `MONGO_URI`, each **re-verified live** rather than assumed
  from the edit.

⚠️ The rotation is the cheap part. What makes this worth a standing rule
is that the *third* one happened while doing careful, well-verified work
— the leak was incidental to a task that was otherwise going well, which
is exactly when nobody is watching for it.

**Never document something as existing until it does.** This file is read as
fact by every session. A pointer to a file that was never written, or a hook
described as "ready to build with" before its ticket ships, sends the next
session chasing something that isn't there — and it declines to look in the
place that does have the answer. Both have already happened here. If it is
planned, say which ticket builds it.

**Flag concerns before executing, not after.**

**Ticket file paths are sometimes wrong for this repo.** When a ticket's path
conflicts with the actual convention, the convention wins — note it as a correct
deviation, not a defect.

Prefer verifying against generated output or a real browser over reasoning from
description — grepping built CSS and driving Playwright have both caught things
a visual check would have missed.

Explain **why**, not just what. When something breaks, give the causal
mechanism.
