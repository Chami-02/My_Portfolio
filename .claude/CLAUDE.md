# Portfolio Revolution — Phase 2

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

Phase 1 (PF-1 → PF-51) complete. Sprint 9 (PF-52, PF-59 → PF-65) complete and
merged — the API serves every field Phase 2 requires.

**Sprint 10 — Epic E6 Design System Foundations (PF-66 → PF-74) is complete**,
branch `sprint-10-design-system`, PR #4 into `master`, CI green. Everything
Sprint 11 needs is in this file — the ticket table below, the Sprint 11 section,
and the "what's ready to build with" list. There is no separate retrospective
document; do not link to one.

| Ticket | Work | Status |
| --- | --- | --- |
| PF-66 | E2E database isolation | ✅ |
| PF-67 | Design token stylesheet | ✅ |
| PF-68 | Font pipeline | ✅ |
| PF-69 | Keyframe library | ✅ |
| PF-70 | Tailwind theme wiring | ✅ |
| PF-71 | FOUC guard | ✅ |
| PF-72 | ThemeProvider | ✅ |
| PF-73 | MotionProvider | ✅ |
| PF-74 | Motion primitives | ✅ |
| PF-75 | Page shell + ambient scaffold + splash gate | ✅ |
| PF-76 | GalaxyCanvas — star field + cursor web | ✅ |
| PF-77 | Grain overlay + cursor glow | ✅ |
| PF-78 | Splash | ✅ |
| PF-79 | Navbar, scroll progress, mobile nav | ✅ |
| PF-80 | Hero + marquee strip | ✅ |
| PF-81 | About — parallax, stats, outline type | ✅ |
| PF-82 | Skills — wired to the API | ✅ |
| PF-83 | Reduced-motion + a11y pass | ✅ |
| PF-84 | Sprint 11 gate, PR, close | ✅ |

Numbering note: six Jira epics were created after PF-52, consuming keys
PF-53–PF-58. The jump from PF-52 to PF-59 is intentional.

**⚠️ Before cutting any sprint branch, confirm the previous sprint's PR
actually merged** — `gh pr view <N> --json state,mergedAt`. Branch too
early and none of the previous sprint's primitives exist on the new
branch, and the first import fails. This was written for Sprint 11
against PR #4, and it still applies: **Sprint 12 branches from `master`
at `b8cef24`**, the PR #5 merge, which is verified below. Check, don't
assume.

### Sprint 11 — Epic E7, Main Page Rebuild (`PF-55`)

Branch `sprint-11-main-page`. First sprint where the site visibly becomes the
Phase 2 design rather than just having the vocabulary to build it with.
**Scoped to chrome + Hero → Skills only** — Projects, Blog, Contact, Footer,
and the full responsive audit are Sprint 12. Splitting here, at the hero
marquee, keeps the riskiest work (two canvases, a splash sequence) from
competing for attention with straightforward section transcription.

| Order | Ticket | Title | Points | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | PF-75 | Page shell + ambient layer scaffold | 5 | — | ✅ |
| 2 | PF-76 | GalaxyCanvas — star field + cursor web | 8 | PF-75 | ✅ |
| 3 | PF-77 | Grain overlay + cursor glow | 3 | PF-75 | ✅ |
| 4 | PF-78 | Splash | 4 | PF-74, PF-75 | ✅ |
| 5 | PF-79 | Navbar, scroll progress, mobile nav | 5 | PF-75 | ✅ |
| 6 | PF-80 | Hero + marquee strip | 8 | PF-74, PF-78 | ✅ |
| 7 | PF-81 | About — parallax, stats, outline type | 5 | PF-74, PF-80 | ✅ |
| 8 | PF-82 | Skills | 3 | PF-81 | ✅ |
| 9 | PF-83 | Reduced-motion + a11y pass | 3 | all | ✅ |
| 10 | PF-84 | Sprint gate, PR, close | 2 | all | ✅ |

46 points. PF-75 carries 5, not 3 — it now includes the splash-readiness gate
(see the silent-failure entry below), pulled forward from PF-78 so the primitive
change lands in a low-stakes ticket instead of the same one building the splash
animation. PF-78 drops from 5 to 4 accordingly: it only has to call `setReady()`
at the right two moments, not build the plumbing.

That last sentence turned out to understate PF-78. It called `setReady()` once,
not twice — the `setReady(false)` half moved into `SplashProvider`'s new
`initialReady` prop, because calling it from the splash's own mount effect is a
render too late (see the race in `providers/SplashProvider.jsx`'s doc comment).
Full markup transcription plus timer choreography plus that provider change put
it closer to 7 points than 4. The table above still reads 4, which is what Jira
has; re-point it there if you want the two to agree.

**Sprint 11 — Epic E7 Main Page Rebuild (PF-75 → PF-84) is COMPLETE and
MERGED.** PR **#5**, merged into `master` on **2026-08-19**, merge commit
**`b8cef24`**. The site visibly is the Phase 2 design from the header
through Skills.

`sprint-11-main-page` has been **deleted on the remote**, matching Sprint
10's pattern — `origin` now carries `master` plus the archived
`sprint-2` … `sprint-8` branches and nothing else. Local copies of
`sprint-9`, `sprint-10` and `sprint-11` still exist with `[gone]`
upstreams; deleting them is housekeeping, not state anyone depends on.

**Sprint 12 branches from `master` at `b8cef24` or later.** Everything in
this file's "ready to build with" lists is on `master` now, so a Sprint 12
branch cut from it inherits all of PF-66 → PF-84. There is no equivalent
of Sprint 10's "confirm PR #4 merged first" warning to repeat here — PR #5
is merged and verified above.

**The PF-84 gate, run fresh on 2026-08-19** — not aggregated from the
individual ticket reports, per the ticket's own instruction:

| Check | Result |
| --- | --- |
| Frontend suite (`vitest --run`) | **403 passed / 403**, 35 files |
| Backend suite (`npm test`) | **211 passed / 211**, 21 suites |
| Lint (`eslint src --max-warnings=0`) | **exit 0**, zero errors, zero warnings ⚠️ |
| Production build (`vite build`) | **succeeds**, 214 modules, 47.13 kB CSS / 412.99 kB JS |
| E2E (`npm run test:e2e`) | **22 passed / 22** — after the fix below; it was **4 failed / 20** |
| Re-run on `master` post-merge (b8cef24) | 403 · 211 · lint 0 · build ok · E2E **21 passed + 1 flaky** ⚠️ |
| Commits on the branch | **25** ahead of `origin/master` |
| Diff vs `origin/master` | 67 files, +9821 / −873 |
| Working tree | clean |

The one non-clean line in any of that is Jest's post-teardown
`ReferenceError` from `health.test.js`. It prints *after* "21 passed" and
is the known open-handle artifact, not a failure — the suite exits 0.

⚠️ **The lint row is accurate about what was run and misleading about what
it proved.** `eslint src` never touched the frontend's root config files,
and `vite.config.js` carried a live `no-undef` throughout — found
2026-08-21. Nothing above is wrong; the scope was just narrower than "exit
0, zero errors" reads. **CI was equally blind** — it runs `npm run lint`,
which was that same command — so this did not show up as a CI failure and
could not have. Fixed in PF-93; full account in Silent failures, including
why the gate should name the script rather than a path from now on.

**⚠️ The gate as the PF-84 ticket specifies it MISSES the E2E suite, and CI
runs it.** The ticket's Step 1 lists four commands — frontend `vitest`,
lint, `vite build`, backend `npm test`. None of them is `npm run test:e2e`,
and `npm test` does not chain to it (`frontend/package.json` has `test:e2e`
as its own script). So the first PF-84 gate came back fully green and CI
then failed with **4 E2E failures**. Run all five, not the ticket's four.

**What the four were: Phase 1 assertions against the Phase 2 page**, not a
regression. PF-80 replaced the hero six days earlier and nothing updated
`e2e/`:

| Spec | Asserted | Reality after PF-80 |
| --- | --- | --- |
| `homepage.spec.js:13` | heading `/Parindra\s+Chameekara/i` | the Phase 2 H1 is **Parindra Gallage** |
| `homepage.spec.js:24` | `.animate-blink` | the typewriter is **gone** — `useTypewriter` is orphaned |
| `homepage.spec.js:28` | `$ docker compose up --build` | `TerminalWindow` is **gone**, also orphaned |
| `navigation.spec.js:40` | heading `/Parindra\s+Chameekara/i` | same H1 change |

**This is the dead-code entry below, seen from the other side, and it is
worth reading as a pair.** That entry says a green unit suite hides dead
code because the test imports the module directly. `useTypewriter`'s four
unit tests are still green *today*, for exactly that reason. The E2E specs
are the tests that could not be fooled — they drive the real page, so they
went red the moment the feature left. **Unit-green + E2E-red is the
signature of a removed feature whose tests were not cleaned up**, and it is
the opposite diagnosis from unit-red, which means broken code.

The fix, in `e2e/homepage.spec.js` and `e2e/navigation.spec.js`:

- **Both heading regexes → `/Parindra\s+Gallage/i`.** The `\s+` is
  load-bearing and not merely inherited from the old assertion: the H1 is
  two block-level spans, so `textContent` reads `"ParindraGallage"` with no
  space at all, while the **accessible name** — which is what
  `getByRole(…, { name })` matches — has one. A test written against
  `textContent` would need `/ParindraGallage/`; one written against the role
  needs `\s+`. Verified both ways in a browser.
- **The two removed-feature tests are REPLACED, not deleted** — role pills
  plus the LOUD CTA, and the marquee strip. Deleting them would have quietly
  dropped the hero's E2E coverage to a single heading assertion.
- **Two new tests cover the splash, which had none** — that it mounts on a
  plain `/` and lifts on its own, and that `?nosplash` skips it. Both were
  mutation-tested (point the first at `?nosplash`, the second at `/`); both
  fail as they should.
  ⚠️ `/Booting portfolio/i` is the only safe splash locator. The splash's
  last boot line is "● Welcome — let's build something loud!" and the hero's
  own CTA reads "Let's build something LOUD!", so `/build something loud/i`
  matches **two** elements mid-splash and a strict locator throws.
- **`homepage.spec.js`'s `beforeEach` now loads `/?nosplash`.** Without it
  every test in the file waits out the full ~5.65s splash before it can
  click anything — Playwright's actionability check will not click through
  a z-index-100 overlay, so it retries until the splash unmounts. That alone
  took the whole suite from **2.1m to 1.2m** while adding two tests.
  `navigation`, `contact` and `admin` still load a plain `/`; they were
  green and were left alone.

Note `toBeVisible()` does **not** check occlusion — an element fully covered
by the splash still reports visible, since Playwright tests bounding box and
`visibility`, not what is painted on top. That is why the heading assertions
failed with "element(s) not found" rather than a timeout, and it is the same
blind spot the splash-readiness gate exists for.

**⚠️ There was a FIFTH stale Phase 1 E2E test, and it is still in the tree.**
It did not appear in the four CI failures because it does not fail — it
passes while asserting nothing. Found on 2026-08-19 by re-running the suite
on `master` after the merge, where it surfaced as `1 flaky`:

```js
test('"Get In Touch" CTA scrolls to contact section', async ({ page }) => {
  await page.click('text=Get In Touch');
  await page.waitForTimeout(800);
  await expect(page.locator('#contact')).toBeInViewport();
});
```

Phase 1's hero had `<a href="#contact">Get In Touch</a>`. **PF-80 deleted
it**, so `text=Get In Touch` now resolves to the Contact section's own
`<h2>`. Measured, not reasoned:

| Probe | Result |
| --- | --- |
| matches for `text=Get In Touch` | 1 — an **`<h2>`**, `href=null`, not inside an `<a>` |
| `location.hash` after the "click" | **`""`** — the app never navigated |
| `scrollY` 0 → | **4786**, entirely from Playwright's actionability auto-scroll |
| same assertion with **no click at all** | **passes** |

So the test asserts that *Playwright scrolls an element into view before
clicking it*, which is Playwright's own documented behaviour and true of
every element on every page. **It cannot fail for a product reason**, and it
would keep passing if `#contact` were deleted from the hero's CTAs entirely
— which is exactly what happened.

**Why it only became flaky now.** Before PF-84, the splash blocked the click
for ~5.65s, and that incidental delay was long enough for the two large hero
images (1.4MB + 2.3MB) to finish loading and the layout to settle. `?nosplash`
removed the delay, so the auto-scroll now races image-driven layout shift and
`#contact` sometimes lands just outside the viewport. **The flake is the
symptom; the vacuous assertion is the defect**, and it predates this sprint.

Note `"View My Work"` in the test above it is **not** the same problem — the
Phase 2 hero really does render `VIEW MY WORK →` as `<a href="#projects">`,
so that one exercises a real CTA. Only the Contact one fell through.

**Not fixed here.** The fix belongs in a Sprint 12 ticket alongside the
Contact rebuild, because the honest replacement is to click a real Phase 2
CTA — `DOWNLOAD CV` or `Let's build something LOUD!`, both `href="#contact"`
— and Contact is Sprint 12's section. Left in place deliberately rather than
patched blind; it is on the Outstanding work list.

**Live spot-checks, measured in Chromium against the production build**, not
read off the stylesheets. Served from `dist/` behind a same-origin proxy to
the real backend, because `.env.production`'s API host is still the Railway
placeholder (see Outstanding work) and a plain `vite preview` would have had
every fetch fail:

| Check | Result |
| --- | --- |
| `--header-h` vs rendered header | token `71px` · measured **71px** |
| `scroll-margin-top`, all 3 sections | **71px** each — the `[id]` cascade trap has not crept back |
| EX1 cursor web | `WEB_LINK_PX` **105**, `WEB_ALPHA` **0.065** (see the ⚠️ below) |
| EX2 splash scan lines | **12** CSSAnimations in the splash, **0** named `scanline` |
| EX3 splash timing | first tick **3%** unpadded · exactly **29** ticks · bar full **~4523ms** · exit 4500ms · unmount **~5690ms** |
| EX4 smooth scroll | root `scroll-behavior: smooth` with motion allowed |
| EX5 section washes | Hero + Skills both `background-image: none`, `rgba(0,0,0,0)` |
| EX5 card surfaces survive | Skills card still `rgba(20,33,61,.52)` |
| EX6 hero parallax grid | 0 `.parallaxGrid`, 0 elements tiled at 74px, 0 `[data-para]` in the hero |
| EX7 About caption | absent; the gradient `.portraitFade` still present |
| EX8 light bridge scope | `#projects` → `--text-primary: #0b1220`, `--accent: #7e4800`; `:root` still `#f1f5f9` |
| EX8 `/admin` + `/admin/login` | both still `#f1f5f9` / `#818cf8` — **the exclusion holds** |
| EX9 stat labels | dark `rgb(147,160,184)` (`--muted`) · light **unchanged** at `rgb(79,93,118)` |
| Skills from the API | 5 category cards, **26** pills |
| Hero chips | **10**, all ten float durations distinct, **0** overlapping pairs at 1440px |
| Marquee band | `offsetHeight` **52px** (rect 82px — rotated, expected), full-bleed, no max-width |
| Ambient z-order | canvas 0 · glow 1 · header 60 · grain 70 (opacity 0.42) · splash 100 · skip link 200 |
| Splash gate | mid-splash **0/38** reveals fired; **20/38** after it lifts |
| Reduced motion | `data-motion=reduced` · root `scroll-behavior: auto` · no splash · **0** rAF in an idle second · **0** `getAnimations()` · no parallax |
| Keyboard order | skip → logo → ABOUT/SKILLS/PROJECTS/BLOG → CONTACT → toggle → ADMIN — exactly as specified |
| Focus rings | present on all 10 stops; pill radii still **999px** while focused |
| Mouse click | `:focus-visible` false, no ring |
| Skip link | parked `top: -900px` → focused `top: 16px`, `fixed`, z-200, topmost **over the splash**, `--accInk` ring, no viewport yank from mid-page |
| Mobile overlay | 8 focusables, Tab never leaks, focus blurred to `<body>` is pulled back, Escape returns focus to the hamburger |
| Headings / images | 1×H1, 5×H2, 8×H3, **0** level skips · **0** `<img>` without `alt` |
| Built bundle | 36 `@keyframes` defined, 19 referenced, **0 unresolved**; **0** `*.module.css` names a keyframe |

**⚠️ The PF-84 ticket's own inventory is stale in three places.** Recorded
because the ticket says to verify its list rather than trust it, and doing
so found these:

1. **Cursor web is 105 / 0.065, not the ticket's "130 (not 150), 0.14".**
   The ticket lists the *first* reduction; there were two, and Locked
   decisions has carried the table since 2026-08-17.
2. **"Splash duration extended to 4.5s" is backwards.** `SPLASH_MS` is
   4500 against the prototype's 4600 — very slightly **shorter**. The
   ticket's Step 0 states it correctly and its PR template does not.
3. **Its silent-failure list names two things CLAUDE.md never recorded** —
   see the two new entries at the end of Silent failures. That is exactly
   the "a fifteenth one was never written down" case the ticket warned
   about, and it turned out to be real.

### Sprint 12 — Main Page Completion, COMPLETE and MERGED

**PR #6, merged into `master` on 2026-08-30, merge commit `79835e0`.**
Verified with `gh pr view`, not assumed. Branch
`sprint-12-main-page-complete`, cut from **local** `master` at `c5669e5`.
Scope: **Projects, Blog teaser, Contact, Footer, then the Phase 1 homepage
cutover and a full responsive + a11y audit.** PF-85 → PF-92, plus PF-94.

**Sprint 13 branches from `master` at `79835e0` or later.** Confirm the
merge before cutting — `gh pr view 6 --json state,mergedAt` — for the
reason the Sprint 10 warning gives: branch too early and none of this
sprint's primitives exist on the new branch.

| Ticket | Work | Status |
| --- | --- | --- |
| PF-85 | Projects section, API-wired | ✅ |
| PF-93 | Reveal entrance regression — withdraw the hover deviation | ✅ |
| PF-86 | Blog teaser (Field Notes), API-wired | ✅ |
| PF-87 | Contact section, API-wired, résumé link | ✅ |
| PF-88 | Footer, API-free, REPLAY INTRO live | ✅ |
| PF-89 | Homepage Phase 1 cutover | ✅ |
| PF-90 | Responsive + **state** audit, both themes | ✅ |
| PF-91 | Accessibility & contrast pass | ✅ |
| PF-94 | `ScrollToHash` lands 115px low off-home — **found BY the gate** | ✅ |
| PF-92 | Sprint gate, PR, close | ✅ |
| — | **Sprint 13 prep — navbar rework + 2 removals** (2026-08-22) | ✅ |
| — | **Link icons + live dot + band slowdown + hero de-mist** (2026-08-29) | ✅ |

**Sprint 13 prep landed on this branch, unticketed and owner-directed
(2026-08-22).** It is recorded here because it is real shipped work that
no ticket number will lead anyone to. Full reasoning lives in Locked
decisions — the five entries under the frozen-design banner — and this is
only the file map.

```
frontend/src/
  utils/nav.js                          NEW  navModel(), isBlogPath(), HOME
  utils/__tests__/nav.test.js           NEW  6 tests
  utils/theme.js                        − themeModeLabel()
  utils/__tests__/theme.test.js         − its 2 tests
  components/layout/
    ScrollToHash.jsx                    NEW  react-router has no hash scroll
    Navbar.jsx  + .module.css           route-aware; ADMIN as quiet chrome
    ThemeToggle.jsx + .module.css       44×44 sun/moon icon button
    __tests__/ScrollToHash.test.jsx     NEW  9 tests
    __tests__/Navbar.test.jsx           + 12 tests
    __tests__/ThemeToggle.test.jsx      rewritten, 16 tests
  pages/HomePage.jsx                    mounts <ScrollToHash /> INSIDE SplashProvider
  pages/__tests__/HomePage.test.jsx     + MemoryRouter (see below)
  components/sections/
    BlogSection.jsx + .module.css       − the ghost numeral
    __tests__/BlogSection.test.jsx      3 absence guards replace 1 presence guard
frontend/e2e/navigation.spec.js         + 4 tests
```

**⚠️ `HomePage` now requires a Router context.** It mounts
`<ScrollToHash />`, which calls `useLocation()`. In the app it has always
been inside `App.jsx`'s `<BrowserRouter>`, so nothing changed there — but
`HomePage.test.jsx` stubs every section and therefore never needed a
router before. It now wraps in `MemoryRouter`. A test rendering `HomePage`
bare fails with "useLocation() may be used only in the context of a
<Router> component", which reads like a routing bug and is not one.

**Two passes, same day.** The owner reviewed the first live and asked
for three changes: header full-bleed (logo further left, ADMIN further
right), the divider right of the toggle removed, and the toggle to glow
like a sun in dark theme while darkening on hover in light. All three are
folded into the Locked-decisions entries above, including the two places
where the second pass **reversed** the first — the header max-width and
`.adminDivider`. Both are recorded as reversals rather than silently
swapped, because each was built for a stated reason that no longer holds.

**The gate, run fresh after the second pass:** 539 frontend / 242 backend
/ lint exit 0 / build 218 modules / **26 E2E**. Header re-measured at
**71px** after each pass. Nineteen mutations across the new guards, all
caught.


**PF-93 was inserted ahead of PF-86 deliberately.** It blocks PF-86/87/88:
all three are `Reveal`-heavy, and every one of them would have asked "how
do I give this card a hover transition?" and got the wrong answer straight
out of this file. Five edits, all deletions, plus the standing rule that
replaces the gate. Full record in Silent failures and Locked decisions.

**⚠️ The pre-flight for this sprint found the note that used to be here was
wrong in BOTH directions**, so it is corrected rather than deleted — the
claim was that "three of the four sections Sprint 12 builds (Projects,
Blog, Contact) still carry Phase 1 washes":

- **Projects never had one**, in either phase. The prototype's
  `<section id="projects">` (line 309) declares only `position` and
  `padding`, and Phase 1's declared only `padding`.
- **Blog's and Contact's were already removed** by the 2026-08-18 wash
  removal — which the Locked-decisions table in this same file records.
  Measured: `grep -n 'linear-gradient\|radial-gradient'` over
  `ProjectsSection.jsx BlogSection.jsx ContactSection.jsx` returns **zero**.

What IS true is that **the Phase 2 prototype gives Blog, Contact and the
footer a section background** — so PF-86/87/88 each have one to transcribe,
and then to leave out under the wash-removal decision. Grepped separately,
as that entry insists:

| prototype | line | background |
| --- | --- | --- |
| `#projects` | 309 | **none** |
| `#blog` | 414 | `linear-gradient(180deg,rgba(var(--gnd),.3),rgba(var(--ftr),.68) 50%,rgba(var(--gnd),.3))` |
| `#contact` | 489 | `radial-gradient(100% 80% at 50% 0%,rgba(var(--srf),.8),rgba(var(--gnd),.6) 70%)` |
| `<footer>` | 543 | `linear-gradient(180deg,rgba(var(--gnd),.4),rgba(var(--ftr),.86))` |

The separate-grep discipline still earned its keep: `background-size`
whole-file returns **7** matches, and four of them are the project cards'
`data-cardbg` layers, which a `background:` grep misses entirely. See the
PF-85 entry.

Still to triage before PF-87: the résumé subsystem's fate. The CORS
allowlist question was **decided and shipped in PF-85** (see below).

There is **no separate Sprint 11 retrospective document**, matching Sprint
10's rule. That section is the record; do not link to one.

### Infrastructure — databases, credentials, Cloudinary (2026-08-31)

Three pieces of work with no ticket between them, done after the Sprint
12 merge and recorded here because nothing else will lead anyone to
them. All of it verified by document count and live API response rather
than by name — the discipline the database entry in Silent failures has
been insisting on since 2026-08-18.

The database half closes the "QUEUED, NOT DONE" item in Outstanding
work. The Cloudinary half found a **production defect nobody was looking
for**, while investigating something else entirely.

**The four-database convention.**

| database | who reads it | set in |
| --- | --- | --- |
| `portfolio_prod` | the live site | Vercel's `MONGO_URI` (Production + Preview) |
| `portfolio_dev` | local development | `backend/.env` |
| `portfolio_test` | the Jest suite | `npm test`'s URI rewrite — **unchanged** |
| `portfolio_e2e` | the Playwright suite | `.env.e2e` — **unchanged** |

**No staging database — considered and rejected.** It would need a second
frontend deploy, a second backend deploy, a third set of environment
variables and a data copy kept in sync; for a solo portfolio that is
ceremony, and the kind that drifts out of date until it is actively
misleading.

**The moves, in order — and the order is the point, because two of them
were verified before anything downstream was touched:**

1. **`portfolio_dev` created** by `mongorestore` from the 2026-08-29
   22:48 backup (`~/mongo-backups/20260829-2248`), then counted: abouts 1 ·
   blogs 4 · contacts 2 · projects 4 · skills 26 · users 1 ·
   vocabularies 32 = **70**. `backend/.env` repointed `/test` →
   `/portfolio_dev`, confirmed live: `GET /api/health` →
   `database: "portfolio_dev"`, `GET /api/skills` → 26 with **Java last**,
   which also proves migration 004's ordering came across with the data.
2. **`test` renamed to `portfolio_prod`** via a **fresh** `mongodump` of
   `test` taken 2026-08-31 15:06 — deliberately not the 08-29 backup,
   since production may have moved since — plus `mongorestore` with
   `--nsFrom`/`--nsTo`. Verified collection by collection across **both**
   databases **before Vercel was touched**: abouts 1=1 · blogs 4=4 ·
   contacts 3=3 · projects 4=4 · skills 26=26 · users 1=1 ·
   vocabularies 32=32 = **71**.
3. **Vercel's `MONGO_URI` updated** (`my-portfolio_backend`, Production
   and Preview scope) `/test` → `/portfolio_prod`, redeployed with the
   build cache cleared. ⚠️ **Verified against the DEPLOYED backend, not
   localhost** — `GET /api/health` → `database: "portfolio_prod"`,
   `GET /api/skills` → 26, Java last. A localhost check proves nothing
   here: it reads `backend/.env`, which step 1 had already repointed, so
   it would have come back green with Vercel untouched.
4. **`test` LEFT IN PLACE**, untouched, as a two-week rollback. Nothing
   reads it as of the rename. **Drop after ~2026-09-14** — dated reminder
   in Outstanding work.
5. **`portfolio`, `portfolio_scratch` and `sample_mflix` DROPPED**
   through the Atlas UI's type-to-confirm. Confirmed gone with
   `db.adminCommand("listDatabases")`: exactly **seven** remain — `admin`,
   `local`, `portfolio_dev`, `portfolio_e2e`, `portfolio_prod`,
   `portfolio_test`, `test`.

⚠️ **`contacts` went 2 → 3 between the 08-29 backup and the 08-31 dump,
and the new row is a GENUINE VISITOR SUBMISSION.** That retires this
file's own "there is no genuine visitor mail in production" note — true
when written on 08-29/30, false now. `portfolio_dev` therefore carries
70 documents against production's 71, and **that difference is real data,
not drift to be reconciled**: dev is a snapshot, and re-syncing it should
never run in the other direction.

`backend/.env.example`'s comment block was rewritten in the same session.
The old one named `test` as production and warned against repointing to
`portfolio` — which no longer exists to repoint to, so the warning had
become a pointer at nothing.

**Credential rotation.**

The `portfolio_admin` Atlas user's password was **rotated 2026-08-31**,
because the connection string — password included — was pasted into a
chat session during this work. **Third incident of this shape**; it is
also the reason the Working agreement now carries a written rule about
it, which it did not before.

Rotated through Atlas Database Access, then propagated to all three
consumers and **re-verified with a live health check after each one**
rather than assumed from the edit: `backend/.env` (`portfolio_dev`),
`backend/.env.e2e` (`portfolio_e2e`), and Vercel's `MONGO_URI`
(`portfolio_prod`).

**⚠️ CLOUDINARY WAS NEVER CONFIGURED IN PRODUCTION.**

~~The deployed backend carries **zero** `CLOUDINARY_*` environment
variables, so every upload path is non-functional in production.~~ —
**FIXED 2026-08-31.** The diagnosis is kept in full rather than trimmed
to the verdict, because **how** it was found is the transferable part:
nobody reported it, no test could fail on it, and it was found while
looking for something else.

**It surfaced sideways.** The question being asked was the orphan one
below — whether replacing a project or blog image leaves stale files in
Cloudinary, given that the résumé subsystem already handles its own
replacement correctly. That question turned out to have a much larger
one sitting in front of it: **there was nothing in the bucket to
orphan.**

`my-portfolio_backend` on Vercel carried four environment variables —
`MONGO_URI`, `JWT_SECRET`, `NODE_ENV`, `JWT_EXPIRES_IN` — and **no
`CLOUDINARY_*` row of any kind.** Not the cloud name, not the key, not
the secret, not the folder.

**⚠️ THE CAUSE IS A PLATFORM MIGRATION, NOT A MISTAKE IN ANY TICKET.**
The PF-63 ticket doc (`E5_PF63_Upload_Cloudinary.md`, in the owner's
external ticket folder — **not in this repo**; per-ticket guides are
pasted into chat, per the Working agreement) carries a step titled **"Add the Cloudinary
Vars to Railway."** This backend ran on Railway before it moved to
Vercel, and that one platform-specific step was never redone after the
move.

Every other PF-63 step is repo work and survived intact —
`config/cloudinary.js`, `services/storage.js`, the routes, the tests,
all present and all passing. **Only the step whose target was a hosting
dashboard was lost, and a hosting dashboard is the one place no test,
no lint and no build can look.** Same class as `.env.production`'s
trailing period in PF-92: a wrong value outside the repo cannot fail
anything the gate runs.

**Four independent lines of evidence, which is what made it safe to
call rather than merely suspect:**

| probe | reading |
| --- | --- |
| Vercel's env var list | `MONGO_URI`, `JWT_SECRET`, `NODE_ENV`, `JWT_EXPIRES_IN` — **no `CLOUDINARY_*`** |
| Cloudinary Admin API, `GET /resources/image` and `/resources/raw`, `prefix=portfolio` | **0 assets**, of any type, ever |
| `portfolio_prod`'s own data | `avatarUrl` empty · `resume.url` and `resume.publicId` both empty · every post's `coverImage` null |
| `config/cloudinary.js` | `cloudinary.config()` reads exactly those vars; `isConfigured()` is false without them |

⚠️ **Any one alone is explainable** — an empty bucket only means nobody
uploaded, and empty fields only mean nobody filled them. The four
together fit one story and no other, which is the whole reason to
collect four.

**⚠️ THE TWO UPLOAD PATHS FAIL DIFFERENTLY, AND NEITHER FAILURE WAS
VISIBLE FROM OUTSIDE.** Worth knowing before anyone tests the repair:

| route | guard | what a visitor to the admin panel would have seen |
| --- | --- | --- |
| résumé (`aboutController.js:133`) | `isConfigured()` | a clean **503 "File storage is not configured on this server"** |
| **`POST /api/upload`** (`uploadController.js`) | **none** | whatever the SDK throws — no `isConfigured()` check anywhere in that path |

So "silently non-functional" is right about the outcome and wrong about
the mechanism. The résumé path was **designed to fail loudly** and would
have, into an admin panel nobody had used; the generic path — the one
project images go through — has no such guard and would have produced
an opaque error. Grepped: `isConfigured` has exactly two non-test
consumers, `storage.js`'s re-export and that one `aboutController` line.

⚠️ **`CLOUDINARY_FOLDER` is OPTIONAL, despite reading like a fourth
requirement.** `isConfigured()` checks only cloud name, key and secret;
`storage.js:14`'s `defaultFolder()` falls back to `'portfolio'`. It was
set anyway, to match `.env.example` and keep the deployed folder
explicit rather than implicit — but a future audit should not treat its
absence as a fault.

**FIXED 2026-08-31.** All four vars added to Vercel at **Production and
Preview** scope, matching `MONGO_URI`, and redeployed. **Verified with a
real end-to-end upload against the deployed backend, not a dry run:**
`POST /api/upload` with a valid admin JWT and a real PNG returned
**201** with a genuine `https://res.cloudinary.com/<cloud-name>/…` URL,
`publicId` `portfolio/projects/…`, and matching dimensions. On this
session's evidence that is **the first confirmed-working upload through
the deployed backend in this project's history.**

⚠️ **This does NOT close the orphan question that started it** — see the
`publicId` item in Outstanding work. Cloudinary working is what makes
that gap start mattering.

### Outstanding work — deferred deliberately, not lost

- ~~**⚠️ `ScrollToTop` covers the end of the copyright at ≤600px**~~ —
  **FIXED 2026-08-27**, owner chose hiding the button while the footer's
  bottom bar is in view, over padding the bar or shortening the
  copyright. Re-verified with `elementFromPoint`: **0/8 occluded samples**
  at 375 / 430 / 600, where it had been 2/8 · 2/8 · 1/8. Full account in
  the PF-90 close-out above.

  ⚠️ The button still floats over the Contact textarea at 375. Nothing is
  covered there — the field is larger than the button — so it was left
  alone, but it is the same control in the same position and any future
  change should be checked against both.

- **⚠️ THE 404 PAGE NEEDS ITS OWN TICKET, AND SOONER THAN THE ADMIN
  REBUILD.** Raised in PF-91, which excluded it deliberately: its fix is
  Phase 1 **token** work and PF-91's was Phase 2 **palette** work.

  | node | token | dark | light |
  | --- | --- | --- | --- |
  | the giant `404` numeral | `--border-bright` | **1.91 ✗** | 8.67 ✅ |
  | eyebrow "ERROR 404" | `--accent` | 6.79 ✅ | **2.44 ✗** |
  | body copy | `--text-body` | 7.90 ✅ | **2.10 ✗** |

  **⚠️ Why it outranks admin's 1.11, which is a worse number.** The
  numeral fails at **1.91 in DARK — the default theme, on a page any
  broken link reaches.** Admin's failure needs a deliberate theme toggle
  *and* a deliberate navigation to a route the owner alone visits. Reach
  beats severity here.

  ⚠️ **And it is NOT a pin-to-dark candidate**, unlike admin: it fails in
  the theme pinning would lock it into. It needs the real palette.

- **⚠️ `/admin` AND `/admin/login` ARE UNREADABLE IN LIGHT THEME, AND HAVE
  BEEN SINCE PF-67.** Found in PF-89's Step 1b sweep (2026-08-26),
  measured on the production build, **not fixed** — see the decision at
  the end of this entry, which reversed an earlier instruction.

  **The mechanism, and it is one line of cause.** `--bg` is the **ONE**
  Phase 1 token name that `tokens.css` also declares. `main.jsx` imports
  `tokens.css` after `global.css`, both at `:root`, so tokens.css wins —
  **and tokens.css's `--bg` flips with the theme** (`#050609` dark,
  `#EDE8DF` warm paper light). Every *other* Phase 1 token
  (`--text-primary`, `--text-body`, `--text-muted`, `--accent`,
  `--bg-surface`, `--border`, `--border-bright`) is declared **only** in
  `global.css`, which is a single **dark** palette that never flips.

  So **the ground flips and the ink does not.** Confirmed present in
  `e23d97b` (PF-67, the commit that created `tokens.css`) — `--bg` is at
  lines 23 and 56 of that very first version, in both themes.

  | node | dark | light |
  | --- | --- | --- |
  | `/admin` + `/admin/login` body ink (`--text-primary`) | 18.49 ✅ | **1.11 ✗** |
  | `/admin/login` eyebrow "PORTFOLIO CMS" (`--accent`) | 6.79 ✅ | **2.44 ✗** |

  1.11:1 is invisible, not merely low — the `<h1>` "Admin Sign In" is
  `#f1f5f9` on `#EDE8DF`. This is the light-theme bridge's bug **exactly
  inverted**: the bridge existed because Phase 1 ink sat on a Phase 2
  ground in three *sections*, and it was scoped away from admin on the
  reasoning that "admin panels' surfaces are the un-flipped dark
  `--bg-surface`" — which is true of the panels and **false of the page
  behind them**.

  **⚠️ WHY THREE SPRINTS OF WORK WALKED PAST IT.** You have to be in
  light mode **and then** open `/admin`. This site is developed in dark,
  and `/admin` is the one route the Phase 2 work never touched — PF-75's
  splash, PF-79's navbar and PF-88's footer are all mounted for
  `path="*"` **except** `/admin/*`. Nothing errors, no test fails, no
  console warning. It is the `ScrollToTop` finding again (PF-88's
  revisions) on a bigger surface: **light theme is where a Phase 1 token
  on a Phase 2 ground shows up, and it is the theme nobody develops in.**

  **⚠️ DO NOT PIN `/admin` TO DARK.** PF-89 proposed exactly that and the
  owner reversed it on 2026-08-26. `Admin.dc.html:16` carries a **full**
  light palette — every token redefined, including `--acc:#7E4800`,
  `--accInk:#ffffff`, `--ok:#0E7A55`, `--danger:#B4231F` — and
  `toggleTheme()` at line 796 with `pg-theme` shared across all three
  screens (verified: 2 occurrences of that key in each `.dc.html`).
  **Admin genuinely follows the site theme by design.** Pinning it dark
  would freeze behaviour the design explicitly rejects, and Sprint 14
  would undo it.

  **The real fix is Sprint 14 transcribing `Admin.dc.html:16`'s light
  palette, which requires deleting `global.css`'s `:root`** — the last
  Phase 1 stylesheet.

  **⚠️ ADMIN'S LIGHT THEME, THE `:root` DELETION AND THE
  `body { font-family }` CUTOVER ARE ONE PIECE OF WORK, NOT THREE.**
  `:root` is what every admin surface currently reads, so admin's light
  theme cannot land until it goes; and the font is deferred *only*
  because Phase 1 layouts still exist, which stops being true in the same
  ticket. Anyone scheduling these as three separate items will find each
  one blocked on the other two.

  **Two details from `Admin.dc.html` worth recording now, so Sprint 14
  does not transcribe past them:**

  - **⚠️ `--gnd` and `--srf` are BOTH `255,255,255` in the prototype's
    light theme, so a panel transcribed as `rgba(var(--srf),.5)` is
    invisible against the ground.** Admin panels are separated by
    **border and shadow** there, not by fill.

    ⚠️ **And this is NOT admin-specific — `Portfolio Revolution.dc.html`
    collapses them identically.** Checked rather than assumed, because
    the natural assumption is that the portfolio screen keeps them
    apart. Both screens: dark `--gnd:5,6,9` / `--srf:20,33,61`, light
    **both `255,255,255`**.

    **What DOES differ is this repo.** `tokens.css` light gives
    `--gnd: 251,248,243` and `--srf: 254,252,248` — separated where the
    design collapses them. An undocumented PF-67 deviation, found here.
    It does not rescue the panel: composited, `rgba(var(--srf),.5)` over
    `--gnd` lands at `253,250,246` against a `251,248,243` ground, a
    **2/2/3** per-channel delta. Invisible in the design, invisible in
    the repo — just for a slightly different reason.

  - **⚠️ Grain opacity is `.12` light / `.35` dark on admin** (line 791),
    against the portfolio's `.13`/`.45` (line 860), while `GrainOverlay`
    currently rests at **0.42** in both themes — see the Silent-failures
    entry on why 0.42 is the real resting value and not a flash. **Three
    values for one overlay across two screens; expected, not a bug.**
    Do not normalise them.

  **Two more Phase 1-token findings from the same sweep, reported and NOT
  fixed** — both are on Phase 1 surfaces that go with the same rebuild:

  | node | dark | light |
  | --- | --- | --- |
  | `NotFoundPage` eyebrow "ERROR 404" (`--accent`) | 6.79 ✅ | **2.44 ✗** |
  | `NotFoundPage` body copy (`--text-body`) | 7.90 ✅ | **2.10 ✗** |
  | `ErrorBoundary` error detail (`--text-muted`) | **2.67 ✗** | 6.21 ✅ |

  ⚠️ **The 404 is NOT a pin-to-dark candidate either, and for a different
  reason than admin**: its giant `404` numeral is `--border-bright`,
  which measures **1.91 dark** / 8.67 light. It fails in the theme
  pinning would lock it into. Genuinely mixed; needs the real palette,
  not a freeze.

  ⚠️ `ErrorBoundary` is the odd one out — it is a **Phase 2** surface
  (it wraps all six sections) failing in **dark**, the default theme. It
  was never reached by the light-theme bridge even while that existed,
  because it *wraps* each section rather than nesting inside it: when it
  catches, its fallback **replaces** `#projects` entirely, so it was
  never a descendant of the bridge's scoping elements. Proved in PF-89
  before deleting the bridge.

- ~~**⚠️ `blogViews.test.js` flakes on Jest's 5s default timeout**~~ —
  **FIXED in PF-87** via `jest.testTimeout: 30000`; three consecutive
  runs gave 242/242/242. `mongodb-memory-server` is still the real fix
  and still its own ticket. Original account kept below.

- **⚠️ `blogViews.test.js` flaked on Jest's 5s default timeout against
  Atlas — it was a NETWORK timeout, not an assertion failure.** Seen
  2026-08-22: three full-suite runs gave **242/242**, **239/242** and
  **241/242**, with a different count each time and always the same
  shape:

  ```
  ● Blog view counter (PF-64) › increments views by one
    thrown: "Exceeded timeout of 5000 ms for a test."
  ```

  The same file run alone is **7/7**. The tests talk to a real MongoDB
  Atlas cluster, so under full-suite load a round trip can exceed 5s and
  Jest kills the test before any assertion runs.

  **Why it matters beyond the noise: it presents as a red suite on a diff
  that never touched the backend**, which invites a hunt for a regression
  that is not there. Distinguish it by the message — a timeout with no
  `expect` diff — and confirm with `npm test -- blogViews`. Fixing it
  properly is a `jest.setTimeout()` bump or a local/in-memory Mongo for
  the suite; neither is in any current ticket.

- ~~**⚠️ `#contact`'s `scroll-margin-top` is 80px, not 71px**~~ — **FIXED
  in PF-87**, which rebuilt the section with `section.contact` at (0,1,1).
  Re-measured: all six sections **71px**, both CTAs land flush with the
  header. Original account below.

- **⚠️ `#contact`'s `scroll-margin-top` WAS 80px, not 71px — every navbar
  CONTACT click landed 9px low.** Found 2026-08-22 while verifying the
  route-aware navbar; **pre-existing, not introduced by it.** Measured on
  the production build:

  | section | `scroll-margin-top` |
  | --- | --- |
  | hero · about · skills · projects · blog | **71px** ✅ |
  | **contact** | **80px** ✗ |

  This is exactly the `[id]` cascade trap this file documents:
  `global.css:338`'s `[id] { scroll-margin-top: 5rem }` is (0,1,0), and
  `ContactSection` is still the Phase 1 component, so nothing overrides
  it. Every other section has been rebuilt since PF-80 and carries
  `section.<class> { scroll-margin-top: var(--header-h) }` at (0,1,1).

  **Not fixed here, deliberately.** PF-88 replaces that section whole, and
  the fix belongs in the rebuild rather than as a one-line patch to code
  about to be deleted. It is a 9px offset, not a broken anchor. Note this
  is the *third* consequence of Contact still being Phase 1, alongside the
  vacuous `Get In Touch` E2E test and `useInView`'s last consumer.

- **`?nosplash=1` persists in the address bar after an off-home nav
  click.** The prototype's own mechanism (see Locked decisions), so it
  ships as-is. Stripping it after mount — a `history.replaceState` once
  `ScrollToHash` has fired — is a small follow-up if it ever bothers
  anyone. It is cosmetic; nothing reads the param after the first render,
  because `HomePage` freezes `shouldShowSplash()` in a lazy initialiser.

- **`--acc2` / `--acc2rgb` now have ZERO component consumers.** The
  sun/moon toggle replaced the switch that was their only one. They stay
  declared in `tokens.css` because the prototype still uses them and the
  Blog and Admin screens are unbuilt — but they are orphaned tokens
  today, and a token sweep should not read them as live.


None of this is in Sprint 11's PR. Each was checked on 2026-08-19 rather
than copied forward:

- ~~**One vacuous E2E test — `"Get In Touch" CTA scrolls to contact
  section`**~~ — **REPLACED in PF-87**, and a FIFTH stale spec was found
  alongside it in `e2e/contact.spec.js` (see the PF-87 entry). Both
  mutation-tested. Original account below.

- **One vacuous E2E test — `"Get In Touch" CTA scrolls to contact section`**
  (`e2e/homepage.spec.js`). Asserts Playwright's own auto-scroll, not the
  app; reports `flaky` rather than failing. Full measurement in Silent
  failures. Fix it with Sprint 12's Contact rebuild, pointing it at a real
  Phase 2 CTA.
- ~~**`frontend/test-results/.last-run.json` is tracked**~~ — **CLOSED in
  PF-89** via `git rm --cached`. The file is still on disk and is now
  correctly untracked-and-ignored (`git check-ignore` names
  `frontend/.gitignore:38`). Original account below.

- **`frontend/test-results/.last-run.json` WAS tracked** even though
  `/test-results/` is in `frontend/.gitignore` — it was committed before the
  rule existed, and gitignore does not apply to already-tracked files.
  ⚠️ The claim that it "dirties the tree after every Playwright run" is
  overstated: it holds `{"status": …, "failedTests": []}`, so it only shows
  as modified when the OUTCOME changes. A full green run after a green run
  leaves the tree clean — verified in PF-85. Still worth `git rm --cached`.
- ~~**About's and Skills' card entrances are BROKEN**~~ — **FIXED in
  PF-93 (2026-08-21).** Four elements carried the `[data-reveal='in']`
  gate, not the two listed here — Hero's `.rolePill` and `.loudCta` too —
  and all four are fixed by deleting the declaration rather than gating
  it better. The remedy this entry called for ("dropping the hover easing
  back to the prototype's snap") turned out to be a third wrong answer:
  the prototype does not snap those cards either. Measurements and the
  standing rule are in Silent failures.

  ⚠️ **One reduced-motion behaviour surfaced while verifying this** — no
  `Reveal`-wrapped element lifted on hover at all under
  `prefers-reduced-motion`, while Projects' `.bigCard` (not wrapped) did.
  Cause proven by deleting rules from the live CSSOM in Chromium rather
  than reasoned from specificity: `Reveal.module.css`'s
  `html[data-motion='reduced'] .reveal { transform: none }` is (0,2,1) and
  beats `.statCard:hover` (0,2,0); deleting that one rule returned the lift
  to exactly `-4px`. PF-74's, and not introduced by PF-93.
  **Decided and fixed the same day** — see the Locked decision on ungated
  hover lifts, which has the split rule and the re-measured audit contract.
- ~~**⚠️ Terminal ink fails AA in light theme.**~~ — **CLOSED in PF-91.**
  The `➜` line and the chrome label are both `#8b949e` now (6.15 / 5.62,
  both themes); the `➜` line was the last theme token on a panel that
  does not theme. The card numerals are EXEMPT, not fixed — see the
  PF-91 exemptions in Locked decisions. Original account below.

- **⚠️ Terminal ink fails AA in light theme.** The panel is a fixed dark
  image (`#0d1117`) but two of its ink colours are theme tokens, so they
  darken while the panel does not. Measured against the panel:

  | line | dark | light |
  | --- | --- | --- |
  | ~~caret `▌` — `var(--acc)`~~ | ~~9.36~~ | ~~**2.54** ✗~~ **FIXED** |
  | `➜ http://localhost:5173` — `var(--faint)` | **3.33** ✗ | **3.12** ✗ |
  | `terminal — portfolio` — literal `#5c677d` | **3.04** ✗ | **3.04** ✗ |
  | the other 7 lines — literal hexes | 7.17–18.92 ✅ | identical ✅ |

  **The caret is fixed** (2026-08-21, owner-approved) — a literal
  `#FCA311` like its seven siblings, so dark is byte-identical and light
  goes 2.54 → **9.36**. See Locked decisions.

  **The other two are still open and batch into PF-91** as one pass over
  terminal ink, per the same decision — both are colour calls rather than
  a token-vs-literal swap, and `#5c677d` fails in *both* themes, so it is
  not a light-theme bug at all.
  Separately, the card numerals are `rgba(252,163,17,.28)` → **1.75** dark
  / **1.19** light against a 3:1 requirement for large text. Prototype's
  exact value; decorative, but screen readers still announce them.
- **`.cardPlaceholder`'s 479px height is a compromise, not a
  measurement.** No single value fits — filled project cards run 391–619px
  depending on width, description length and pill wrapping. Table in the
  PF-85 entry. Options: breakpoint it, drop the min-height, or leave it.
- ~~**`frontend/dist-verify/` is not gitignored**~~ — **CLOSED in PF-88.**
  This file's own live-verification recipe builds there, `eslint.config.js`
  has ignored `dist-*/` since PF-93, and git did not — so following the
  documented steps left a 410 kB bundle untracked and one `git add -A`
  away from being committed. `frontend/.gitignore` now carries `dist-*/`.
  One line, closed because the recipe that creates the problem is in
  this file.

- **The root `.gitignore` has no `node_modules` entry.** Running vitest
  from the repo root instead of `frontend/` leaves an untracked cache file
  that `git add -A` would stage. One line to fix.
- ~~**Hover easing is now inconsistent three ways**~~ — **RESOLVED in
  PF-93 (2026-08-21).** It read: About and Skills ease at 0.25s
  (owner-approved 2026-08-18), PF-85's big card snaps, PF-85's small
  cards ease at 1.05s. Withdrawing the 2026-08-18 deviation collapses the
  three into the prototype's own two. Measured after the fix:

  | | hover lift | duration |
  | --- | --- | --- |
  | About `.statCard` | `-4px` | 1.05s |
  | Skills `.card` | `-6px` | 1.05s |
  | Projects `.card` | `-8px` | 1.05s |
  | Hero `.rolePill`, `.loudCta` | `-2px` | 0.9s, bouncy (`pop`) |
  | Projects `.bigCard` | `-8px` | **0s — snaps** |

  The two remaining differences are both the design's: `pop` reveals get a
  different curve from `up` ones, and `.bigCard` carries no `data-reveal`
  at all so nothing eases it. Nothing left undecided here.
- **⚠️ The seeded blog posts have ONE `createdAt` and all read "1 MIN
  READ".** `seed.js` writes them with a single `insertMany`, so
  `timestamps: true` stamps all four identically
  (`2026-08-09T05:56:05.288Z`, read off the live API), and they are short
  enough that `readingTimeMinutes` rounds to 1 on every one. The design
  wants JUL/JUN/MAY/APR 2026 and 6/7/4/5 MIN. PF-86 renders both fields
  honestly, so the teaser currently reads `AUG 2026 · 1 MIN READ` four
  times, and the post ORDER is a four-way tie that PF-86 breaks on `_id`
  ascending purely to keep it deterministic. Fixing it is a seed change
  plus, against the live cluster, a production write like migration 004 —
  the owner's call. Details in the PF-86 entry.
- ~~**⚠️ Two inherited contrast failures in the Blog teaser**~~ —
  **CLOSED in PF-91** (Groups A and E). ⚠️ Note the compact-row meta was
  **4.30 dark**, and the separator pair turned out to be one mark
  implemented twice. Original account below.

- **⚠️ Two inherited contrast failures in the Blog teaser, reported and
  NOT fixed** (PF-86, 2026-08-21) — both are the prototype's own values,
  so they follow the PF-83 stat-label precedent of raise-then-change:

  | node | dark | light |
  | --- | --- | --- |
  | compact-row meta (`--muted2`, 10px) | **4.30** ✗ | 5.79 ✅ |
  | featured meta separator `·` | 5.20 ✅ | **1.44** ✗ |

  The first is PF-83's About finding again, same token at a small size on
  a translucent surface, dark-only; `--muted` is what fixed it there. The
  second is a token-vs-literal split *inside one section* — the featured
  separator is a literal `rgba(252,163,17,.7)` (prototype line 435) while
  the compact rows' is `var(--acc)` at `opacity:.65` (line 446), so only
  the featured one keeps dark theme's amber on light paper. Same shape as
  the terminal caret. Both batch naturally into PF-91.
- ~~**⚠️ FOUR contrast findings in Contact**~~ — **CLOSED in PF-91.**
  The field labels went to `--muted` in dark (7.00) and both status
  colours onto `var(--ok)`/`var(--danger)` (6.43 / 5.88 light). ⚠️ The
  location line was never failing — 4.55 dark — exactly as the entry
  below says. Original account below.

- **⚠️ FOUR contrast findings in Contact, reported and NOT fixed** (PF-87,
  2026-08-22). All the prototype's own values, so they follow the PF-83
  stat-label precedent and batch into PF-91:

  | node | dark | light |
  | --- | --- | --- |
  | location line (`--muted2`, 11.5px) | 4.55 ✅ marginal | 5.45 ✅ |
  | **form field labels** (`--muted2`, 10.5px) | **4.15** ✗ | 5.95 ✅ |
  | error text (`#f87171`, 11.5px) | 6.65 ✅ | **2.48** ✗ |
  | sent text (`#34d399`, 11.5px) | 9.57 ✅ | **1.72** ✗ |

  The field-label row is the **fourth** occurrence of `--muted2` failing
  dark at a small size on a translucent surface, and 4.15 is
  byte-identical to About's stat labels before PF-83 fixed them.
  `--muted` is the one-step-lighter answer each time. The two status
  hexes fail LIGHT because they were chosen for a dark panel and the form
  surface flips underneath them — the terminal-caret shape again.

  ⚠️ Note the ticket predicted the location line would fail and it
  PASSES; the labels it never mentions are the actual failure.

- ~~**⚠️ TWO contrast findings in the Footer**~~ — **CLOSED in PF-91**,
  and by then there were **six**, not two: the 2026-08-27 surface tint
  had newly failed the role line, the bio and the status dot, and pushed
  the copyright under in light as well. All six are in the PF-90
  close-out table and all six now pass. Original account below.

- **⚠️ TWO contrast findings in the Footer, reported and NOT fixed**
  (PF-88, 2026-08-24). Both are the prototype's own values, so they
  follow the PF-83 stat-label precedent and batch into PF-91:

  | node | dark | light |
  | --- | --- | --- |
  | **copyright** (`--faint`, 10.5px) | **3.56** ✗ | 4.97 ✅ |
  | **AVAILABLE FOR WORK** (10.5px) | 9.87 ✅ | **4.23** ✗ |

  The copyright is the **second** open `--faint` finding — the terminal
  panel's `➜` line measures 3.33 dark / 3.12 light — and the two want one
  decision rather than two.

  The badge is more interesting: the prototype ALREADY fixes it, at
  runtime. `applyTheme()` line 868 recolours every `[data-ok]` to
  `#0E7A55` in light, and PF-88 ports that — untreated `#34d399` measured
  **1.72** on Contact's light surface in PF-87. So the design moved this
  once and landed at 4.23, just short of the 4.5 that 10.5px needs.

  ⚠️ The PF-88 ticket predicted `--muted2` would fail for a fifth time
  here. It **passes**, 4.55 dark, for the same reason Contact's location
  line did: the role line and bio sit on the page ground rather than on a
  translucent card. **The trap is the surface, not the token.**

- **⚠️ The contact email and the site's H1 disagree.** H1 is **Parindra
  Gallage**, the email is **parindrachameekara@gmail.com**. The
  prototype has it this way so PF-87 shipped it as found, but it is worth
  the owner confirming rather than discovering live.

- **⚠️ `mix-blend-mode: screen` is invisible in light theme.** The
  featured card's sweep layer computes to a +1/+1/+0 per-channel change
  over the light card's paper — pixel-differenced, not reasoned. It works
  in dark. The design's own value, so reported rather than adjusted; the
  failure mode is that the effect simply does not exist in one theme.
- ~~**`frontend/src/assets/about-portrait.heic` is untracked**~~ —
  **WRONG, AND THIS ENTRY CONTRADICTED A LOCKED DECISION FOR TEN DAYS.**
  Reconciled 2026-08-30. It **is** tracked, and it went in with
  **`de5505d`** — verified with `git ls-files` and
  `git log --diff-filter=A`, not inferred. The Locked decision on the
  About portrait is the correct one: the HEIC is **kept tracked as the
  conversion source** for `about-portrait.jpg`.

  The "ZERO consumers" half is still true and is not a defect — re-checked,
  `grep -rn heic frontend/src frontend/e2e` returns nothing. A source
  asset has no importer by design; ⚠️ **never point an import at it**, as
  only Safari decodes HEIC and Vite emits it without complaint (see the
  Locked decision). **Do not delete it**, which is what this entry used to
  advise.

  ⚠️ The generalisable bit: two entries in this file disagreed, and the
  one in Outstanding work was the stale one. When a Locked decision and an
  Outstanding-work item conflict, check the tree — do not assume the newer
  prose wins.
- **⚠️ The live database still holds the OLD LinkedIn URL.** Corrected
  in `seed.js` and the `About` model default on 2026-08-25
  (`gallege` → `gallage`), but neither reaches production: `seed.js`
  wipes five collections before writing, and a Mongoose `default` only
  applies to new documents. The public site is unaffected — Contact and
  the footer both use their own constants — but `AdminAboutPanel` reads
  and writes `social.linkedin`, so the panel still shows the broken URL.
  One field, fixable through the panel or by a migration.

- ~~**`migrations/004-skill-order.js` has still NOT been run.**~~ —
  **IT HAS. Confirmed live in PF-92 (2026-08-29)**, on the deployed API
  and on the deployed page: `GET /api/skills` returns Java at
  **`order: 5`**, and the production build renders LANGUAGES as
  `JavaScript → Python → HTML5 → CSS3 → Java`. The entry below is the
  pre-migration reading and is kept only to show what changed.

  **The run, 2026-08-29:** `Updated: 9 · Already correct: 17 · Missing: 0
  · Extra: 0` — matching the `--dry-run` this file recorded on 2026-08-18
  exactly, which is the confirmation that nothing else had touched the
  collection in between.

  ⚠️ **Nobody recorded running it at the time**, which is why this file
  asserted the opposite for eleven days. A production write performed
  outside a ticket leaves no trace anywhere except the data — so re-read
  the live API before trusting any "has not been run" claim in this file.
  Original account: `GET /api/skills` returned LANGUAGES as
  `JavaScript → Python → Java → HTML5 → CSS3`, Java third.
- **⚠️ THE HERO'S `DOWNLOAD CV` IS UNWIRED, AND THE PROTOTYPE DRIVES
  BOTH CV LINKS.** Found in PF-92's Step 4. `applyResume()` (prototype
  line 675) is `document.querySelectorAll('[data-cv]')`, and there are
  **two** such elements — the hero CTA (line 119) and Contact's
  `↓ DOWNLOAD CV` (line 505). PF-87 wired only Contact's; the hero's is a
  hardcoded `href="#contact"` with a comment deferring it.

  Measured on the live page: both render `href="#contact"` with no
  `download`, but only Contact's carries the prototype's explanatory
  `title`. **Invisible today**, because `hasResume` is `false` and the two
  hrefs agree — **and it bites the moment a résumé is uploaded**, when
  Contact's becomes a real download and the hero's stays a dead anchor
  pointing at the section below it. Goes with Sprint 14's admin upload UI.

- ~~**⚠️ THE DATABASE RESTRUCTURE IS QUEUED, NOT DONE**~~ — **DONE
  2026-08-31.** All four moves executed and verified by document count
  and live API response; full account in Infrastructure above. Local
  development no longer touches production, which was the urgent half.
  Original account below.

  **⚠️ ONE MOVE IS DELIBERATELY INCOMPLETE: `test` still exists.** It is
  the frozen pre-rename production database, kept as a rollback. See the
  dated reminder below.

- **⚠️ THE DATABASE RESTRUCTURE WAS QUEUED, NOT DONE**, and it was
  deliberately deferred until after the Sprint 12 merge. Four moves:

  1. **create `portfolio_dev`** and point local development at it
  2. **rename `test` → `portfolio_prod`**
  3. **drop `portfolio`, `portfolio_scratch`, `sample_mflix`** (all dead —
     see the inventory in Silent failures)
  4. leave `portfolio_e2e` and `portfolio_test` alone

  **A full `mongodump` of every database was taken 2026-08-29** before any
  of this.

  **⚠️ THE REASON IT WAS URGENT: LOCAL DEVELOPMENT STILL CONNECTED TO
  PRODUCTION.** `backend/.env`'s `MONGO_URI` ended in `/test`, which the
  inventory above confirms was the live database. Every `npm run dev`, every
  admin-panel click, and every manual API call in development wrote to the
  same data the deployed site serves. **Sprint 13 hammers the admin panel**
  — create, edit and delete across six panels — which is exactly the
  workload that makes this dangerous.

  ⚠️ Note `npm test` was already safe (its wrapper rewrites the URI to
  `/portfolio_test`) and the E2E suite was already safe (`.env.e2e` names
  `portfolio_e2e`). **It was the dev server, and only the dev server, that
  had no isolation** — which is why this never showed up as a test problem.

- **⚠️ DROP THE `test` DATABASE AFTER ~2026-09-14.** It is the frozen
  pre-rename production data, kept for two weeks as a rollback after the
  2026-08-31 restructure. **Nothing reads it** — `backend/.env` names
  `portfolio_dev`, Vercel names `portfolio_prod`, `.env.e2e` names
  `portfolio_e2e`, and `npm test` rewrites to `portfolio_test`. Drop it
  through the Atlas UI once the two weeks pass with nothing surfaced;
  until then, leaving it costs nothing but a confusing seventh row in
  `listDatabases`.

  ⚠️ It is also the last database on this cluster whose name matches
  `global-setup.js`'s `/e2e|test/i` guard without being a test database.
  Dropping it removes the one remaining way an E2E run could be pointed
  at real data.

- **⚠️ IMAGE UPLOADS LEAK ORPHANS IN CLOUDINARY — THREE FIELDS STORE A
  URL WITH NO `publicId`.** Found 2026-08-31 while auditing the same
  subsystem that turned up the missing production config above.
  **Reported, not fixed — this is a schema change and wants its own
  ticket.**

  | model | field | stores |
  | --- | --- | --- |
  | `Project.js:35` | `imageUrl` | bare `String` |
  | `Project.js:52` | `backgroundImage.src` | bare `String` |
  | `Blog.js:107` | `coverImage` | bare `String` |
  | `About.js:69` | `avatarUrl` | bare `String` |
  | `About.js:94` | **`resume`** | `{ url, publicId, … }` — **the correct pattern** |

  Cloudinary can only delete by `public_id`. None of the first four
  records one, so replacing a project image, a blog cover or the avatar
  through the admin panel leaves the old file in the bucket **forever**,
  with nothing anywhere that could later identify it. `About.resume` is
  the same problem already solved correctly — `aboutController.js`
  uploads the new file first, deletes the old `publicId` only after that
  lands, and logs a warning rather than failing if the delete does
  (Locked decisions: *"a new upload hard-deletes the old"*).

  **⚠️ Zero accumulated risk TODAY, and that is a timing accident rather
  than a design.** All four fields are empty or null in `portfolio_prod`,
  and the bucket holds **0 assets** — because Cloudinary was never
  configured in production until 2026-08-31. The gap starts accruing the
  first time anyone uses the feature that was just repaired.

  **The fix is to follow `resume{}` exactly** on all four — a
  `publicId` beside each URL, plus the upload-then-delete ordering in
  whichever controller writes it. Do NOT fold it into an unrelated pass;
  it touches three schemas, their controllers, the admin panels that
  write them, and needs a decision about existing documents (there are
  none today, which makes now the cheapest possible moment).

  ⚠️ `Blog.coverImage` is worth a separate line: it is **leftover from an
  abandoned feature attempt** — added, then not pursued. Every live post
  has it `null` and `deletePost` never touches Cloudinary either way. If
  the ticket concludes it should be deleted rather than given a
  `publicId`, that is a legitimate outcome; it is not load-bearing.

- **⚠️ ONE PRODUCTION CONTACT RECORD FROM THE PF-92 GATE**, marked
  `PF-92 GATE TEST (safe to delete)`, `2026-08-29T17:49:25Z`. Delete it
  through the admin panel. Step 4 and Step 6 both instruct a real form
  submission, so each future run writes another one.

- **About/Hero API re-wiring.** Schema decision made (`numericValue` +
  `suffix`), ticket not written. Touches the Mongoose schema,
  `AdminAboutPanel`, and the availability gate's public reader.
- ~~**Résumé subsystem — a whole backend with no frontend at all**~~ —
  **PUBLIC HALF SHIPPED IN PF-87.** `ContactSection`'s DOWNLOAD CV is the
  subsystem's first frontend caller, via `apiUrl('/resume')`, and it
  reproduces the prototype's own two-branch `applyResume()` behaviour off
  `About.hasResume`. **The admin UPLOAD UI is still unbuilt** — Sprint 14,
  per the owner's 2026-08-19 decision — so `hasResume` is `false` live and
  the button ships inert with the prototype's explanatory title. Nothing
  needs changing on the frontend when a résumé is finally uploaded.
  Original account below.

- **Résumé subsystem — the ADMIN half still has no frontend.** Verified:
  7 backend files (`routes/resumeRoutes.js`, `services/storage.js`,
  `controllers/aboutController.js`, `models/About.js`, `app.js`, `seed.js`,
  `routes/aboutRoutes.js`) and **zero** frontend callers. The only two
  frontend matches for "resume" are a doc comment in `services/api.js` and
  the word "resumes" in a `StarfieldCanvas` test name. Needs a decision:
  build the admin UI and restore the public link in Sprint 12's Contact, or
  formally drop it and delete the backend.
- ~~**Three orphaned Phase 1 modules**~~ — **RESOLVED in PF-89
  (2026-08-26), but not three and not all the same way.** The list was
  stale in both directions, which is why the ticket made proving each
  count Step 1:

  | module | at the time of this entry | at PF-89 |
  | --- | --- | --- |
  | `useTypewriter` | orphan, 4 passing tests | **DELETED**, tests too |
  | `TerminalWindow` | orphan, no tests | **DELETED** |
  | `useInView` | not yet listed — PF-87 orphaned it after | **DELETED**, no tests |
  | `apiUrl` | listed as an orphan | **KEPT** — PF-87 made it `CV_HREF` |

  So the count was never three at any one moment. `apiUrl` had already
  stopped being an orphan when this entry still named it, and `useInView`
  had become one without being added. **A hand-maintained orphan list
  drifts in both directions**; the replacement is
  `styles/__tests__/cutover.test.js`, which fails if any of the three is
  reintroduced.

  ⚠️ **The JS bundle lost exactly 0 bytes** — 411.69 kB before and after.
  That is not a disappointing result, it is the proof: Rollup never
  included any of the three in the graph, so their unreachability is
  measured rather than argued. Only CSS moved, 65.20 → 64.86 kB, from the
  `[id]` rule and the light-theme bridge.
- ~~**`.env.production`'s API host is the placeholder**~~ — **FIXED**,
  `f0978ac` + `9f45897` (2026-08-29). It now reads
  `https://my-portfoliobackend-xi.vercel.app/api`, and PF-92 is the first
  live verification in this project served from a real build rather than
  through a proxy.

  ⚠️ `f0978ac` set it with a **trailing period** — `…/api.` — which is
  baked into the bundle and 404s every fetch; `9f45897` removed the one
  character. Full account in the PF-92 gate entry, including why nothing
  in the five-command gate can catch a wrong env value.
- ~~**CORS allowlist is narrow by design**~~ — **RESOLVED in PF-85**
  (2026-08-19). A localhost dev-port range is now allowed in
  non-production only; production stays exact-match. See Locked decisions.
  Note this does **not** help the stale-server-on-5174 E2E trap, which is
  a different failure — see Silent failures.
- **Two unoptimized assets** — `about-portrait.png` 2.3MB, `hero-ai.png`
  1.4MB. Prototype-sourced, so not a fidelity question; worth a WebP/AVIF
  pass before launch.
- **CI is on Node 20** with `actions/checkout@v4`, `setup-node@v4`,
  `upload-artifact@v4` (`.github/workflows/ci.yml`, three jobs).
  Non-blocking until GitHub pulls it from the runners.
- ~~**`frontend/.eslintignore` still exists**~~ — **RESOLVED 2026-08-21,
  during PF-93.** Its 8 patterns are now `globalIgnores([…])` in
  `eslint.config.js`, plus `dist-*/`, and the file is deleted. Closed here
  because it was blocking a real fix, not as a drive-by — see the
  lint-scope entry in Silent failures.

  Both halves measured rather than assumed:
  - **`ESLintIgnoreWarning` is gone**, and the probe is proven live by the
    control: **0** occurrences now → **1** with the file restored → **0**
    again after deleting it.
  - **The patterns are genuinely redundant**, confirmed per path with
    `new ESLint().isPathIgnored()`. All 8 honoured, `dist-verify/` too,
    while `src/`, `e2e/` and the three root configs still lint.
  - ⚠️ And the file was already ignoring **nothing** — 7 of its 8 patterns
    were dead at HEAD, since ESLint 9 does not read it and only `dist` was
    named in `globalIgnores`. Table in the Silent-failures entry.
- **`fbc983e` carries three unrelated things under one message** — PF-81's
  About section, a one-line `HeroSection` delay tweak, and the entire
  `utils/loginError.js` module plus its 66-line test file. Splitting it
  means force-pushing a shared branch, so it stays the owner's call.

PF-83 is 3 points in Jira and its own ticket recommends 6–7. That looks
right: no single piece is hard, but it audits eight tickets' worth of built
surface and designs two things (focus indicators, a skip link) with no
prototype precedent. Re-point it there if you want the two to agree.

PF-82 ran close to its 3 points on the frontend and then grew a backend
half the ticket did not anticipate: correcting `seed.js` does nothing for
an existing database, because `seed.js` deletes five collections before
it writes. Migration `004-skill-order.js` covers that. Call it 5.

PF-79 also carried three things beyond its own scope, all recorded below:
`ThemeToggle`'s visual transcription (PF-72 deferred it here in its own module
comment, so this was the deferral landing, not a re-style), the `motion.css`
root-selector fix, and `--header-h`. It is 5 points in Jira; its ticket
recommends 8, and that looks right — re-point it there if you want the two to
agree.

### Re-pointing, settled in one pass (PF-84)

Three tickets flagged themselves as under-pointed and never got a final
number, which left this file reading "recommend re-pointing" with no
resolution. Collected here so the question is answered once. **These are
recommendations against Jira, not repo state — nothing in the code depends
on them, and the board is the user's to change.**

| Ticket | Jira | Recommended | Why |
| --- | --- | --- | --- |
| PF-75 | 5 | 5 | already re-pointed from 3; the splash gate moved here |
| PF-76 | 8 | 8 | matched |
| PF-77 | 3 | 3 | matched |
| PF-78 | 4 | **7** | full markup + timer choreography + `initialReady` |
| PF-79 | 5 | **8** | carried `ThemeToggle`, the `motion.css` root fix, `--header-h` |
| PF-80 | 8 | **10** | 5 prototype corrections, the `Reveal` `style` merge, 5 carriers |
| PF-81 | 5 | **7** | first `patterns.module.css` consumer, plus the API regression call |
| PF-82 | 3 | **5** | grew a backend half — migration `004-skill-order.js` |
| PF-83 | 3 | **7** | audits eight tickets' surface, designs two things from nothing |
| PF-84 | 2 | **5** | least code of the sprint, most verification surface |

PF-88 is 3 points on the board and its own ticket recommends **6**. Six
is right, and possibly light: the transcription is a morning's work, and
REPLAY INTRO is the rest — it reaches into `SplashProvider`, `HomePage`,
`App.jsx`, `ScrollToHash` and `utils/`, and the marquee defect it
surfaced touched `Marquee` and the hero as well. Six of the fourteen
changed files are not the footer.

That totals **65** against Jira's 46. The gap is not estimation drift in
the usual sense — seven of the ten overruns are work the *ticket did not
know about*, found by checking the prototype or a browser rather than by
building what was described. Worth knowing when pointing Sprint 12: the
transcription is the small half.

Mobile nav treatment and the cursor-web budget lever are decided — see
Locked decisions. The canvas-palette question that was on this list earlier
turned out not to be a decision at all: `pal()` is called fresh inside the
`requestAnimationFrame` loop itself, every frame, not once at setup, so the
star field already tracks theme toggling live. PF-76 read that same live flag
through a ref updated by its own small effect, rather than putting `isLight`
in the draw loop's dependency array — which would have torn the loop down and
regenerated every star's position on each toggle.

What's ready to build with — **all of this is on `master` as of PR #5**.
Exact paths, because they are not guessable from the ticket names:

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
        base.css                 the 22 non-variant keyframes (NOT "shared by
                                 every screen" — only 4 are; see below)
        portfolio.css            flt-portfolio  drift-portfolio  sheen-portfolio
        blog.css                 flt-blog  sheen-blog          (no drift — correct)
        admin.css                flt-admin  drift-admin  sheen-admin  auroraA  auroraB
      motion.css                 reduced-motion layer — imported LAST, deliberately
      patterns.module.css        shared structural patterns, pulled in via composes:
    providers/
      ThemeProvider.jsx          ThemeContext.js    (context is its own module)
      MotionProvider.jsx         MotionContext.js
    hooks/
      useTheme.js                useReducedMotion.js
    components/
      motion/                    index.js barrel — Reveal, CountUp, Marquee
                                 Reveal.jsx + Reveal.module.css
                                 CountUp.jsx
                                 Marquee.jsx + Marquee.module.css
      layout/                    ThemeToggle.jsx + ThemeToggle.module.css
    utils/
      theme.js                   React-free: normalise, readTheme, applyTheme, …
      motion.js                  React-free: prefersReducedMotion, subscribe…
      nav.js                     React-free: navModel, isBlogPath, sectionHref
      replay.js                  React-free: beginReplay() — PF-88
```

The import order in `main.jsx`, which is a locked decision and silently breaks
if disturbed:

```js
import './styles/global.css';
import './styles/tokens.css';
import './styles/keyframes/index.css';
import './styles/animations.css';   // after keyframes/ — PF-79 follow-up
import './styles/motion.css';       // must be LAST
```

`animations.css` holds the `.kf-*` carriers that let a CSS Module reference a
global keyframe at all — see the entry in Silent failures, and read it before
writing any `animation` declaration in a `*.module.css`.

- **Tokens** (`frontend/src/styles/tokens.css`): flat tokens + 5 channel
  triplets, dual-theme via `html[data-theme]`.
- **Fonts**: `var(--font-display)` (Anton, weight 400 only), `var(--font-body)`
  (Space Grotesk), `var(--font-mono)` (JetBrains Mono), all declared in
  `tokens.css`. `body`'s `font-family` is still Phase 1's Inter until the
  cutover ticket. Served from the **Google Fonts CDN**, not self-hosted —
  there are no `.woff2` files in this repo, and `frontend/index.html` carries
  one merged `css2?family=` request plus a direct `<link rel="preload">` for
  Anton's woff2. `tokens.css` also defines an `'Anton Fallback'` `@font-face`
  (`size-adjust: 88%`, `ascent-override: 90%`, `descent-override: 22%`) so the
  swap doesn't reflow. Note `--font-mono` is declared in *both* `global.css`
  and `tokens.css`; tokens.css wins purely because it imports second.
- **33 keyframes** (`frontend/src/styles/keyframes/`) — **the design's 32,
  plus one addition.** `dot-ok` was added 2026-08-29 for the LIVE SITE
  green dot and is the only keyframe here with no prototype source;
  `keyframes.test.js` keeps it in its own `ADDITIONS` list precisely so
  the 32 below still means the design's own set. The rest of this entry
  describes those 32. `base.css` holds 22,
  `flt`/`drift`/`sheen` are per-screen variants, and there are **8 of them,
  not 9**: the Blog prototype has no `drift` animation at all, so
  `drift-blog` does not exist and never should. `auroraA`/`auroraB` are
  Admin-only and live in `admin.css`. 22 + 8 + 2 = 32, + `dot-ok` = 33
  defined in total.

  **⚠️ `base.css` is NOT "the 22 shared by every screen", which is what this
  entry used to say.** Counted against the three prototypes, only **4 of the
  22** appear in all of them — `riseIn`, `glowdot`, `glowpulse`, `spin`.
  Nine are portfolio-only (`dot`, `pulsering`, `boltp`, `breathe`, `orbdot`,
  `shimmerline`, `shimmer`, `flicker`, `blink`), five are admin-only
  (`fadeIn`, `typeIn`, `barGrow`, `ringPulse`, `floatY`), and four are shared
  by two screens but not three (`nudge`, `sweep`, `marq` in portfolio+blog;
  `scanline` in portfolio+admin). 4 + 9 + 5 + 4 = 22. The real rule is **"everything that is not a per-screen
  `flt`/`drift`/`sheen` variant or an Admin aurora"**, and by that rule every
  file is correctly placed. Do not "fix" the layout to match the old
  sentence — it would churn nine keyframes and break the 32-count test for
  nothing. Verified in PF-85's pre-flight by grepping each name across all
  three `.dc.html` files.

  `blink`'s definition was corrected in PF-85 to the prototype's own form,
  `0%,49%{opacity:1} 50%,100%{opacity:0}` (line 29). It had been normalised
  to `0%,100%{1} 50%{0}`. Under `step-end` — the only way the prototype and
  the terminal caret use it — the two are identical; under any interpolating
  timing function they are not, and `blink` is a shared library keyframe, so
  the next consumer may not pass `step-end`. `global.css:189` carries a third
  copy that already had the correct form, so the duplicates now agree; it
  goes at cutover. Guarded by a test that pins the FORM, not the equivalence.
- **Theming**: `useTheme()`, `<ThemeToggle />`
  (`components/layout/ThemeToggle.jsx`).
- **Motion**: `useReducedMotion()` for anything JS-driven; `motion.css`
  handles CSS-driven motion automatically.
- **Motion primitives**: `import { Reveal, CountUp, Marquee } from
  '../components/motion'` — `Reveal` needs `type="up"|"pop"|"rise"|"left"`
  matched to the prototype's `data-reveal="…"` for that element.
- **Layout**: CSS Modules for anything copied from the prototype, Tailwind for
  simple layout, `patterns.module.css` for structural patterns used more than
  once.

**Built by PF-75 — all of this is on `master`:**

```
frontend/src/
  providers/
    SplashContext.js       export const SplashContext  (defaults to { ready: true })
    SplashProvider.jsx     export function SplashProvider({ children, initialReady = true })
  hooks/
    useSplashReady.js      export function useSplashReady   → boolean, read side
    useSplashControls.js   export function useSplashControls → { ready, setReady }
  components/ambient/
    index.js               barrel — PageShell, StarfieldCanvas, CursorGlow, GrainOverlay
    PageShell.jsx          + .module.css   position:relative wrapper, no z-index
    StarfieldCanvas.jsx    + .module.css   z-index 0
    CursorGlow.jsx         + .module.css   z-index 1, 520×520
    GrainOverlay.jsx       + .module.css   z-index 70 — above the header
```

`Reveal` and `CountUp` **do** gate on splash-readiness now: both call
`useSplashReady()` and their `IntersectionObserver` effect returns early on
`if (immediate || !splashReady)`, with `splashReady` in the dependency array so
the effect re-arms when the splash lifts.

**All three ambient slots are filled as of PF-77** — `StarfieldCanvas` (PF-76),
`GrainOverlay` and `CursorGlow` (PF-77). None is a placeholder any more.

**Built by PF-78 — the readiness gate is live, not a no-op any more:**

```
frontend/src/
  utils/splash.js                shouldShowSplash()  — React-free, no session gate
  components/splash/
    index.js                     barrel — Splash
    Splash.jsx  + .module.css    z-index 100, above grain's 70
  assets/logo.png                copied from docs/design/assets/, imported by Splash
```

`SplashProvider` is mounted in `pages/HomePage.jsx`, not `main.jsx`, so `/admin`
and Blog never carry it. `ready` now starts **`false`** on the home page
whenever a splash is going to show, via the `initialReady` prop, and flips true
320ms into the splash's exit. Three things about that are load-bearing:

- **`initialReady`, not a `setReady(false)` effect.** The splash sets readiness
  false by *never letting it be true*, because an effect would run one commit
  after the `Reveal`s in the same tree already armed their observers under
  `ready: true`. The full sequence is in `SplashProvider.jsx`'s doc comment.
- **`HomePage` freezes the answer** — `const [showSplash] = useState(shouldShowSplash)`.
  `shouldShowSplash()` reads live `matchMedia`, so re-deriving it per render lets
  an OS reduced-motion toggle *mid-splash* unmount `Splash` in flight; the
  cleanup clears the pending `setReady(true)` and, since `initialReady` only
  seeds state, `ready` stays false forever and nothing on the page ever reveals.
  A lazy initialiser makes that unreachable. Do not "simplify" it to a bare call.
- **No `setReady(true)` on unmount as a safety net.** It looks like belt and
  braces and is a dev-only footgun: StrictMode's simulated remount runs effect
  cleanup immediately after mount, so the net would fire at ~0ms and open the
  gate with the splash still covering the screen — the exact bug, in the exact
  place you would be adding the guard.

No session-gating, deliberately: grep confirmed zero `sessionStorage` in the
prototype, so the splash runs on **every** load. Reduced motion and `?nosplash`
both skip it entirely — `?nosplash` is the prototype's own mechanism (line 897),
reduced motion is this project's decision, since the splash is almost nothing
but motion. The prototype's `startReveals(120)` skip delay is not reproduced;
with no splash mounted, `initialReady` is `true` and there is nothing to wait for.

The slots take `ref` as an ordinary prop (`function CursorGlow({ ref })`), not
via `forwardRef` — React 19 passes `ref` straight through, and these are the
repo's first ref-forwarding components. Each now merges that external ref with
an internal one via a `setRef` callback, since all three need direct element
access themselves. Note the silent-failure mode: a component that forgets to
destructure `ref` still renders perfectly and hands back `null`, which only
surfaces when something tries to use the element. Each component's own test
file carries that assertion — `StarfieldCanvas.test.jsx` since PF-76,
`GrainOverlay.test.jsx` and `CursorGlow.test.jsx` since PF-77. The shared
`ambientSlots.test.jsx` was deleted in PF-77; its last two subjects had both
grown real logic, and `GrainOverlay` calls `useTheme()`, which throws when
rendered outside its provider the way that shared file rendered them.

`CursorGlow` is the one ambient component needing no provider at all: it gates
on neither `useSplashReady()` nor `useReducedMotion()`, deliberately. There is
no loop to defer — just one style write per `pointermove` — the tracking is a
1:1 response to the user's own cursor rather than autoplaying motion, and its
only animation is a CSS `transition`, which `motion.css` already collapses
globally. `GrainOverlay` skips both gates for the same reason: it paints once.

**Built by PF-79 — the chrome is Phase 2 now:**

```
frontend/src/
  components/layout/
    Navbar.jsx  + .module.css   header z-index 60, overlay z-index 80
    ThemeToggle.jsx + .module.css   visuals now match the prototype
    __tests__/Navbar.test.jsx  __tests__/ThemeToggle.test.jsx
  styles/
    tokens.css                  + --header-h: 71px, + html{scroll-behavior}
    motion.css                  + the root-element scroll-behavior override
    __tests__/motion.test.js    new — guards that override
  utils/theme.js                + themeModeLabel()
```

`Navbar` is mounted by `App.jsx` for every route except `/admin/*`, which was
already true in Phase 1 and is unchanged. It is a **named** export; a default
export exists too but nothing imports it.

Four things worth knowing before touching it:

- **The scroll listener ports only the progress-bar third of the prototype's
  `bindScroll()`.** The reveal-sweep call is redundant with each `Reveal`'s own
  140ms interval (PF-74/75), and `data-para` parallax is PF-81's — no
  `[data-para]` element exists in the DOM yet. **PF-81 needs its own scroll
  listener**; do not expect to find a hook here for it.
- **The bar is set from a ref inside a rAF, and updated once at mount too** —
  matching the prototype's trailing `this.onScroll()`. Without that call the bar
  sits at 0% over a page the browser restored mid-scroll. Known limitation,
  inherited from the prototype and left alone deliberately: the mount reading
  uses the layout height *at mount*, so if the page grows or shrinks afterwards
  the bar is proportionally off until the first scroll event corrects it.
  Observed at ~22% where ~26% was right, on a reload with restored scroll. If
  this becomes visible enough to matter once real sections land, it is a design
  change (the prototype has the same behaviour) — raise it, don't just fix it.
- **`ThemeToggle` is used in both the desktop nav and the overlay**, so two
  elements with `data-testid="theme-toggle"` exist whenever the menu is open.
  Any test touching it while open must use `getAllByTestId`.
- **No active-link highlighting.** The prototype has none; Phase 1's navbar did.
  Dropping it is fidelity, and `Navbar.test.jsx` asserts all four links share one
  class so it cannot creep back.

**Built by PF-80 — the hero is Phase 2, and the page has real content now:**

```
frontend/src/
  components/sections/
    HeroSection.jsx  + .module.css   REPLACES the Phase 1 hero, same path
    __tests__/HeroSection.test.jsx   new per-module test directory
  utils/parallax.js                  computeParallaxTransform() — pure, shared
  utils/__tests__/parallax.test.js
  assets/hero-ai.png                 copied from docs/design/assets/
  styles/animations.css              + 5 carriers (see below)
  components/motion/Reveal.jsx       style prop now MERGED, not dropped
```

`HeroSection` renders a **fragment**, not a single element: the marquee follows
`</section>` in the prototype (line 187), and nesting it inside a
`min-height:100vh; display:flex; align-items:center` section lays it out as a
centred flex item instead of a full-bleed strip. Guarded by a test.

Five things worth knowing before touching it, all found by checking the
prototype rather than the ticket:

- **There are four drift blobs, not eight, and they live inside the portrait
  stage.** The PF-80 ticket's inventory listed four in the section background
  *and* four more around the portrait. The prototype has four total, all
  children of `[data-tilt]` (lines 138-141). `blobC` is at **z-index 4** in the
  prototype, above the portrait frame's 3, so it drifts in *front* of the image
  while the other three stay behind. Guarded by a test asserting the count and
  the containment.

  ⚠️ **THIS REPO SHIPS `blobC` AT z-index 2, NOT 4 — owner-requested
  2026-08-29.** In front of the portrait it read as a drifting mist over the
  photograph ("it should be always clear and perfect"); it is now behind the
  frame with its three siblings, unchanged in every other respect and still
  drifting. The sentence this entry used to carry — that flattening the
  z-index "loses that depth" — was the argument for keeping 4, and the owner
  overrode it. It is still true *of the prototype* and no longer describes
  what renders here. Hoisting the blobs to the SECTION is still wrong; that
  half stands. See the Locked-decisions entry, and the stacking guard in
  `HeroSection.test.jsx`.
- **React and FastAPI chips carry an accent border**, `rgba(252,163,17,.3)`,
  where the other six use `rgba(var(--ln),.16)`. Reads like a copy-paste slip
  in the prototype and is not — they are the two nearest the portrait's glow.
- **The hero owns its own parallax.** PF-79's record said parallax was entirely
  PF-81's, reasoning from a count of two `data-para` elements: the count was
  right, the attribution was not. Line 84 is the hero's grid at `0.12`; line
  202 is About's portrait at `0.05`. `computeParallaxTransform()` is shared;
  the scroll listener is not, matching `Reveal`'s own precedent. **PF-81 needs
  its own listener** — import the util, not a hook, because there isn't one.
- **Parallax gates on reduced motion; the portrait tilt does not.** Different
  categories, not an inconsistency. Parallax exists to move an element at a
  *different* rate from the scroll driving it, and that rate mismatch is the
  named vestibular trigger; tilt is a 1:1 pointer follow, same as `CursorGlow`,
  which is ungated for the same reason. Both directions are tested.
- **`data-lightplate` on the plate element is load-bearing.** The light-theme
  `opacity: 1` is *not* in `HeroSection.module.css` — it is in `tokens.css:150`.
  Attribute selectors are not scoped by CSS Modules, so that global rule reaches
  the element as-is. Drop the attribute and the plate silently never appears in
  light theme, with nothing wrong in either file read on its own. Guarded by a
  test. The prototype *also* writes this opacity from JS in `applyTheme()`
  (line 861); that write is genuinely redundant with the CSS rule, so it is not
  ported.

  **How that rule got there, since the honest version is more useful than the
  flattering one.** It was not groundwork laid for an element six days out.
  PF-67 (`e23d97b`, 2026-08-11) created `tokens.css` by transcribing the
  prototype's `<style>` block, and its light-mode section came across
  **wholesale** — both rules, verbatim, from the prototype's own lines 18-19:

  ```css
  /* ── Light-mode-only rules ───────────────────────────────── */
  html[data-theme="light"] [data-lightplate] { opacity: 1; }
  html[data-theme="light"] [data-terminal]   { box-shadow: 0 30px 60px rgba(20,33,61,.22); }
  ```

  Neither is a token. Both are component-coupled attribute selectors sitting in
  a stylesheet otherwise made of flat tokens and channel triplets — worth
  knowing before citing "it's in tokens.css" as though it were designed there.
  `data-lightplate` found its element in PF-80, six days later.
  **`data-terminal` has not. As of 2026-08-17 it has exactly one occurrence in
  the whole tree — the rule itself.** Nothing renders that attribute, in any
  file type. Checked, not assumed; re-check before relying on it either way.

  (Blame reads line 150 for a commit whose stat shows 115 insertions, which
  looks contradictory and is not: PF-67 created the file at 115 lines with this
  rule at line 99, and PF-68 and PF-79 grew it to 203, pushing the rule down.)

**Built by PF-82 — Skills is Phase 2, and it is the first section wired to
the API rather than transcribed off it:**

```
frontend/src/
  components/sections/
    SkillsSection.jsx  + .module.css   REPLACES the Phase 1 Skills, same path
    __tests__/SkillsSection.test.jsx   27 tests
  styles/
    patterns.module.css                − margin-bottom (see below)
backend/src/
  seed.js                              order corrected for 3 of 5 categories
  migrations/004-skill-order.js        NEW — the same fix for a live database
  __tests__/004-skill-order.test.js    8 tests, pins seed.js to the migration
```

**This section reverses the About precedent deliberately.** PF-81 took About
off the API because the prototype hardcodes its copy. Skills does the
opposite, because the `Skill` schema already matched: the same 26 names, the
same 5 categories, and an existing `order` field. Hardcoding here would have
created a third section the admin CMS cannot drive, for nothing. Checked, not
assumed — `seed.js`'s `SKILLS` was compared name by name against the
prototype's lines 253-307.

**⚠️ The 26 names always matched. Only the `order` did not**, which is exactly
what a count-based check misses — and the count is what DESIGN.md line 136
asserts ("26 chips matching the repo seed exactly"). Three groups were out of
step, all three confirmed against the prototype rather than taken from the
ticket:

| Category | Was | Now (prototype's order) |
| --- | --- | --- |
| `language` | Java 3rd | Java **last** |
| `frontend` | Next.js 2nd, Vite 3rd | Vite **2nd**, Next.js **last** |
| `database` | SQLAlchemy 4th | Mongoose **4th**, SQLAlchemy **last** |

`backend` and `devops` already matched and were left alone.

**⚠️ `seed.js` alone does not fix the live site, and this is the part the
ticket missed.** `seed.js` calls `deleteMany({})` on Project, Skill, Blog,
About **and User** before it writes, so it cannot be re-run against a live
database to pick up an ordering change — it would take the real contacts,
blog views and admin user with it. Hence
`backend/src/migrations/004-skill-order.js`, following the convention in that
directory's README: idempotent, non-destructive, `--dry-run` first, sets
`order` by exact name and touches nothing else.

**As of 2026-08-18 the migration has NOT been run.** A `--dry-run` against
the live database reported `Updated: 9  Already correct: 17  Missing: 0
Extra: 0` — so the live data is still in the old order and the deployed site
still renders Java third. Running it is a production write and was left to
the owner.

The order is now written down twice — `seed.js` for a fresh database,
`TARGET_ORDER` for an existing one — which is real duplication and drifts
silently, since each file reads fine alone and the only symptom is a fresh
environment disagreeing with production. `__tests__/004-skill-order.test.js`
pins them together by parsing `seed.js` as text (it calls `seed()` at module
scope, so it cannot be `require`d). Confirmed by mutation in both directions.

Five things worth knowing before touching the section:

- **`patterns.module.css`'s `.section-eyebrow` lost its `margin-bottom`, and
  About had to get 38px back locally.** PF-81 extracted the eyebrow after
  confirming the structure repeats 5×, but baked in About's 38px as if it
  were shared. It is not: the prototype's Skills eyebrow is 14px (line 246)
  against About's 38px (line 194). So the property was generalised from a
  single observation — the extraction's *first* real test, and it found one
  of three values wrong. **It could not be fixed with a local override**: a
  composed class and the class composing it both land on the element at
  (0,1,0), so the winner falls out of bundle emission order rather than
  intent. Removing the varying declaration is the only version that does not
  depend on which is emitted second. Guarded in three places —
  `patterns.test.js` asserts it is absent, and both section tests assert
  their own value. All four mutations caught.
- ~~**The card hover transition is a sanctioned deviation**~~ —
  **withdrawn in PF-93 (2026-08-21).** `.card` now declares no
  `transition` at all and takes `Reveal`'s, which is what the prototype
  renders too. See Locked decisions.
- **The pill's transition IS the prototype's, declared bare, and it is
  still bare after PF-93.** Unlike the card, the pill is not a `Reveal` —
  the prototype wraps only the card (line 253) and the pills arrive with
  it — so nothing supplies it a transition and it must keep its own.
  **This is the case the PF-93 rule does NOT cover**, and the distinction
  is the whole of it: never declare a transition on a Reveal-wrapped
  element, always declare one on a hoverable element that isn't.
  Wrapping pills individually would also stagger 26 entrances where the
  design has five; guarded.
- **First section of the sprint with no `@keyframes` at all.** Every effect
  is a hover `transition`, so `animations.css` gained nothing and there is no
  `composes: kf-*` anywhere in the module. A test asserts that stays true —
  a carrier appearing here would mean something was transcribed that the
  prototype does not have. Note the test reads the stylesheet with comments
  **stripped**, because the file documents `kf-*` in prose and a raw
  `not.toContain` matches the comment describing the thing.
- **The loading placeholder's height is measured, not derived.** An empty
  card collapses to its 48px of padding and the section grows ~157px per grid
  row when content lands. 205px is the filled card's real rendered height in
  Chromium, identical across cards (grid rows stretch) at
  1600/1440/1280/1024/900/600px. The two-column band at 768px and below
  settles at 162px instead, so the placeholder runs ~43px tall there; no
  single static value covers both. The first guess of 120px, reasoned from
  padding plus one pill row, was wrong by 85px — measured, then corrected.

**Loading and error states have zero prototype precedent** — it never fetches
anything — so both were decided here and both are owner-approved (2026-08-18):

- **Loading**: five empty placeholder cards, no skeleton content, no shimmer.
  With a 5-minute `staleTime` this is only ever on screen during a cold load.
  `aria-hidden`, and bare `<div>`s rather than `Reveal`s — a placeholder that
  animates in and is then replaced animates the same grid slot twice.
- **Error**: the section, its heading and its `#skills` anchor **stay**; only
  the card grid goes. The ticket specified `return null`, which was raised and
  rejected: `Navbar.jsx:10` links to `#skills`, so removing the section turns
  that link into a dead anchor with no feedback at all. The cause still
  reaches `console.error` — **from an effect keyed on the error, not from the
  render body**, so an unrelated re-render (a theme toggle) does not refill
  the console with duplicates.

**`SkillsSection` is a named export**, like every other section, and is
already wrapped in `<ErrorBoundary>` in `HomePage.jsx` — that was PF-80's
doing and needed no change here. **`ContactSection` remains the only bare
one.**

**Built by PF-83 — the a11y pass, and the first ticket with no new
prototype surface to transcribe at all:**

```
frontend/src/
  components/layout/
    SkipLink.jsx  + .module.css      NEW — no prototype precedent whatsoever
    __tests__/SkipLink.test.jsx      9 tests, postcss-based
    Navbar.jsx                       focus trap completed, logo alt
  components/sections/HeroSection.jsx   portrait alt
  components/splash/Splash.jsx          logo alt → "" (see below)
  styles/tokens.css                  + the global :focus-visible rule
  App.jsx                            + <SkipLink />, + <main id="main-content">
```

**⚠️ The ticket's focus rule carried a `border-radius: 4px` that had to be
dropped, and this is a new silent failure worth knowing.** Outlines already
follow the element's own border curve in every current engine, so a radius
in a `:focus-visible` rule does not shape the ring — it overwrites the
ELEMENT's radius while focused. The navbar CONTACT pill, ADMIN link, theme
toggle and both hero CTAs are all `border-radius: 999px`; 4px squares them
off the moment they take keyboard focus and only then, so a mouse user never
sees it and nothing errors. Confirmed in Chromium after the fix: all four
still report `999px` while focused. Guarded in `tokens.test.js`.

Six decisions worth knowing, all made here rather than transcribed:

- **The focus rule lives in `tokens.css`, not a new stylesheet.** That file
  already carries base element rules (`a`, `::selection`, the scrollbar,
  `html{scroll-behavior}`), and adding a sixth import would disturb the
  locked order in `main.jsx` for no gain.
- **Form controls are deliberately NOT in the selector list.** Contact's
  three inputs are the prototype's *only* focus styling (lines 518/522/527)
  and use a `border-color` shift, which works because they already have a
  border to shift. Sprint 12 should transcribe that; a global ring now would
  pre-empt it. Until then they keep the UA default — there was no
  `outline: none` anywhere in this repo when this was written, checked.
  ⚠️ **That stopped being true in PF-91 (2026-08-28)**, which added
  exactly one: `main[tabindex="-1"]:focus { outline: none }`. See the
  entry under PF-91 for why the scoping is what makes it safe, and why
  it must never be quoted to excuse an unscoped one.
- **`ThemeToggle` keeps its own 2px offset** from PF-72. `.toggle:focus-visible`
  is (0,2,0) and beats the new rule's (0,1,1). Intended, not an oversight — a
  30px switch wants a tighter ring than a text link.
- **The skip link is `position: fixed`, not the ticket's `absolute`.** An
  absolute one sits at the top of the DOCUMENT, and browsers scroll a
  newly-focused element into view — so tabbing to it from halfway down the
  page yanks the viewport to the top before the user asked to go there.
- **It reveals on `:focus`, not `:focus-visible`.** While hidden it is
  off-screen and unreachable by pointer, so the two have the same audience;
  they differ only in failure mode. If the `:focus-visible` heuristic ever
  declines to match, the link holds focus while parked off-screen and Tab
  reads as doing nothing.
- **Its focus ring is `--accInk`, not the global accent one.** The link's own
  fill is `var(--acc)`, so the inherited ring would be accent-on-accent and
  read as no ring at all.

**z-index 200 is the only value in this project above splash's 100**, and it
is load-bearing rather than defensive: verified in a browser that with the
splash up, Tab focuses the link, it renders at `top: 16px` **inside the
viewport**, and `elementFromPoint` at its centre returns the link itself
rather than the splash.

**⚠️ THREE elements shared `alt="Parindra Gallage"`, not the two the ticket
named.** The third is the splash logo, found by grepping `alt=` rather than
from the brief. They deliberately get different answers:

| Element | Now | Why |
| --- | --- | --- |
| Navbar logo | `Parindra Gallage — back to top` | the only link of the three; says where it goes |
| Hero portrait | `Portrait of Parindra Gallage` | the section's primary visual content |
| Splash logo | `""` (decorative) | its own `.nameBlock` sibling renders the name and role as real text one line below |

The hero one is a judgment call, not a settled fact — `alt=""` was the
alternative, on the reasoning that the adjacent `<h1>` already says the name.
Described instead because the portrait is content rather than ornament, and
because `AboutSection`'s portrait has read `"Parindra Gallage in the visor"`
since PF-81. Worth a pass with a real screen reader.

**The mobile-nav trap pulls focus back when it has ESCAPED the overlay**, not
only at the two edges. A trap that wraps only at first/last leaks if focus is
on `<body>` — the user clicked the browser chrome and tabbed back — because
neither edge test matches and the default Tab then walks the header behind
the overlay. The listener is on `document` for the same reason: an
overlay-scoped one never sees that keypress.

**⚠️ Writing the test for that found a jsdom trap.** `document.body.focus()`
is a **silent no-op** — `<body>` is not focusable — so `activeElement` stays
on whatever the open effect focused, and the test ends up asserting the
middle-of-the-set case while *looking* like it asserts the escape case. It
failed against correct code. `document.activeElement.blur()` genuinely
resets `activeElement` to `<body>`.

**All 18 new guards were mutation-tested and one was blind.** "Stops trapping
Tab after close" asserted that pressing Tab left focus alone — but React nulls
`overlayRef` on unmount, so a **leaked** listener also bails on `if (!root)`
and does nothing observable. Deleting the cleanup left it green. Rewritten to
spy on `document.removeEventListener`, which catches it. The listener is on
`document` and the Escape handler is on `window`, so the spy is unambiguous.

**The consolidated verification pass — measured in Chromium, not reasoned
from the stylesheets.** The numbers, since "verified" on its own is worth
nothing next session:

| Check | Result |
| --- | --- |
| `data-motion` under reduce | `reduced` |
| root `scroll-behavior` | `auto` — PF-79's root-selector fix has not regressed |
| Splash under reduce | not mounted |
| rAF calls in 1 idle second | **0** under reduce · **61** with motion allowed — ⚠️ **see the caveat below; this pair does NOT reproduce** |
| `getAnimations()` page-wide | **0** under reduce · **29** with motion allowed |
| About portrait parallax | `transform: none` under reduce |
| Tab order | skip → logo → 4 links → CONTACT → toggle → ADMIN, exactly as specified |
| Focus ring | present on all 10 stops; `999px` radii intact |
| Mouse click | `:focus-visible` false, no ring |
| Mobile overlay | 8 focusables, cycles both directions, never leaks, Escape returns focus to the hamburger |
| Headings | 1×H1, 5×H2, 8×H3, **no level skips** |
| `<img>` without alt | 0 |
| canvas / grain `aria-hidden` | both true |

**The 0-vs-61 and 0-vs-29 pairs matter more than the zeros.** A probe that
is simply broken also reports zero; running the same probe with motion
allowed is what distinguishes "gated correctly" from "measuring nothing".

⚠️ **CORRECTED IN PF-90: the rAF half of that pair does NOT discriminate,
and the 0-vs-61 reading is not reproducible.** A counter that measures rAF
by calling `requestAnimationFrame` **self-drives** — the probe keeps the
frame loop alive, so it counts its own callbacks and reads ~61 in *both*
modes. Measured in PF-90: **61 under reduce and 61 with motion allowed**,
on a page where `getAnimations()` correctly read 0 vs 42.

Whatever produced PF-83's 0, it was not a rAF counter behaving as this one
does; the number is left in the table above because it is what was
recorded, flagged rather than deleted.

**`getAnimations()` filtered on `playState === 'running'` is the
measurement that works** — 0 under reduce against a motion-allowed control,
which is the real content of the "matters more than the zeros" rule. The
principle is untouched: a broken probe also reports zero, so always run the
control. Only the *instrument* changed.

**⚠️ One real accessibility finding — raised, approved, and FIXED
2026-08-19.** About's four stat labels failed AA in dark theme only
(4.15:1 against a required 4.5:1). Inherited from the prototype rather
than introduced, so it was reported instead of quietly changed; the owner
approved the fix. Now 7.0:1, light theme untouched at 5.95:1, and **zero
AA failures across the in-scope surface in both themes**. Full record in
Locked decisions.

**Two things the ticket's checklist assumed that are no longer true**, both
already recorded elsewhere in this file — worth flagging so the next reader
does not go looking:

- **"Hero: parallax grid static"** — there is no parallax grid. It was
  removed whole in the 2026-08-18 background removal, along with the hero's
  scroll listener. Nothing to check.
- **"all 8 chips"** — the hero has **ten**, per the owner-requested
  deviations. All ten report 0 animations under reduce.

Also: the checklist says to reuse "whatever contrast-measurement utility the
Phase 1 fix already built". **There isn't one** — grepping for
contrast/luminance/wcag across the repo returns nothing but a comment. The
Phase 1 bridge's numbers were measured ad-hoc and never committed. PF-83's
audit scripts live in the session scratchpad, not the repo.

**PF-82 created no new orphans**, unlike PF-80 and PF-81. Checked rather than
assumed: `useInView` keeps three consumers (Projects, Blog, Contact) and every
Phase 1 class the old Skills used — `tech-tag`, `skeleton`, `section-label`,
`section-title`, `section-divider`, `glass` — is still used by other Phase 1
sections or admin panels.

**`HeroSection` is now wrapped in `<ErrorBoundary>` in `HomePage.jsx`**
(owner-approved during PF-80). Worth knowing why it matters more than it
looks: **there is no `ErrorBoundary` anywhere else in the chain** — not in
`App.jsx`, not around `<App />` in `main.jsx`. The only four in the whole app
were the ones in `HomePage.jsx`, and `App.jsx` uses React Router's legacy
`<BrowserRouter>`/`<Routes>` component API, which has no `errorElement` and no
error handling of any kind (a `createBrowserRouter` data router would). So a
bare Hero throw unmounted the entire root: verified by probe before the change,
`#root` came back **completely empty** — zero bytes, no navbar, no footer, no
sections — and the error escaped `render()` itself. After the wrap the same
throw leaves navbar, footer and all five other sections standing. Guarded by
`pages/__tests__/HomePage.test.jsx`, confirmed by mutation.
**`ContactSection` is still bare**, and is now the only one — same exposure,
untouched because PF-80's scope was Hero.

`animations.css` gained five carriers: `kf-dot`, `kf-glowdot`, `kf-nudge`,
`kf-drift-portfolio`, `kf-flt-portfolio`. The last two keep the screen suffix
because it is part of the real keyframe name — there is no unsuffixed `flt` or
`drift` to fall back on. Verified in the built bundle: every `animation-name:`
in `dist/assets/*.css` resolves to a real, unscoped keyframe, and all 15
animated hero elements report `getAnimations().length === 1` in Chromium with
the expected name and duration.

**`Reveal` now merges a caller's `style` instead of dropping it.** It used to
spread `{...rest}` over its own `style` attribute, so any caller passing
`style` silently lost `transitionDelay` — the element still revealed, just with
the whole group's stagger collapsed to zero and nothing to point at. PF-80 was
the first ticket to pass `style` at all, which is why it surfaced now. Two
tests cover it. The hero itself ended up not needing it: per-chip float timing
lives in the eight position modifier classes instead, which is closer to
"paste the prototype's value into CSS" anyway.

**Built by PF-81 — About is Phase 2, and `patterns.module.css` finally has a
consumer:**

```
frontend/src/
  components/sections/
    AboutSection.jsx  + .module.css   REPLACES the Phase 1 About, same path
    __tests__/AboutSection.test.jsx   19 tests
  styles/
    patterns.module.css               + section-eyebrow{,-label,-line}, outline-text
    __tests__/patterns.test.js        new — guards both extractions
    animations.css                    + kf-sweep carrier
  assets/about-portrait.png           copied from docs/design/assets/
```

**`patterns.module.css` had zero consumers before this ticket.** PF-70 created
it and nothing had ever imported it, so `composes: … from
'../../styles/patterns.module.css'` was unexercised in this build until now. It
works — verified in the built bundle, both classes land on the element
(`_3E2sqJ _66wQRQ`) and the stroke computes to 1.5px accent. Worth knowing
before assuming any *other* untouched part of that file is proven.

Note the file already had an `.eyebrow`, and it is **not** the numbered section
eyebrow — 11px/.14em/`--muted2` against the section one's 12px/.24em/accent.
Composing the wrong one renders a label that is grey and slightly tight rather
than absent, which is the kind of near-miss that survives review. Both are
commented in place and `patterns.test.js` pins them apart.

Six things worth knowing, all found by checking the prototype or a browser
rather than the ticket:

- **The asset is `about-portrait.png`, hyphen intact.** The ticket asserted
  `aboutportrait.png` and justified it with a "same hyphen-dropped naming as
  `hero-ai.png` → `heroai.png` in PF-80" precedent that does not exist —
  PF-80's file is `hero-ai.png`. The prototype's own `src` is
  `assets/about-portrait.png`. There is no hyphen-dropping convention here.
- **The two body paragraphs have different bottom margins — 18px and 20px.**
  Prototype lines 211 and 212. The ticket collapsed both into one `.body` at
  18px. Transcribed as found via `.bodySecond { composes: body;
  margin-bottom: 20px }`; verified 18px/20px in the built page. Reads like a
  slip in a design export, and rounding it is exactly the wrong-by-2px change
  this file keeps warning about.
- **`section.about`, not `.about`** — the ticket wrote the bare class, which
  loses `scroll-margin-top` to `global.css:338`'s `[id]` rule on a specificity
  tie and computes 80px for a 71px header. Same trap PF-80 documented, in the
  ticket that cites PF-80's check in its own checklist. Verified 71px in
  Chromium; guarded, and confirmed by mutation.
- ~~**The stat card's hover transition is gated on `[data-reveal='in']`**~~
  — **deleted outright in PF-93 (2026-08-21).** `.statCard` declares no
  `transition` at any selector now. The diagnosis this entry carried was
  right (a bare `transition` here ties with `.reveal` at (0,1,0) and wins
  on emission order, eating the entrance); the remedy was not, because
  `[data-reveal='in']` lands at the entrance's START. Standing rule and
  measurements in Silent failures.
  The hover *lift* is still a genuine order-dependent tie —
  `.statCard:hover` against `.reveal[data-reveal='in']{transform:none}`,
  both (0,2,0) — and still resolves correctly because the section module
  is emitted after Reveal's. Unaffected by the deletion and **re-measured
  in the production build afterwards** rather than assumed: the card
  reaches exactly `translateY(-4px)` and the border goes accent, now over
  1.05s instead of 0.25s. `.rolePill` has the identical shape and reaches
  exactly `-2px` on the `pop` curve.
- **`@supports not (-webkit-text-stroke: 1px)` must stay var()-free.** A
  declaration whose value contains a top-level `var()` is *assumed valid* by
  `@supports` rather than actually tested, so writing the accent token into the
  condition makes it answer true on the one engine the fallback exists for. The
  condition tests `1px`; the token stays in the rule body. Confirmed in
  Chromium that the fallback does **not** engage (fill computes
  `rgba(0,0,0,0)`, i.e. the stroked version is what shows).
- **`sweep` is first used here.** It was already in `base.css`'s shared 22 —
  only the `kf-sweep` carrier in `animations.css` is new. Verified in the built
  bundle: every `animation-name:` resolves to a real keyframe, and the element
  reports `getAnimations().length === 1` with name `sweep` at 8000ms.

**The prototype's static `scale(1.02)` on the portrait is overwritten by the
parallax effect's own `scale(1.1)`, and that is correct.**
`computeParallaxTransform()` writes the entire `transform` property and does
not merge; the prototype's `bindScroll()` does the identical unconditional
overwrite. So `1.02` is what the markup says and `1.1` is what has always
displayed, from the first frame. Under reduced motion the effect never runs and
`1.02` is the resting value — verified both ways in a browser. Do not try to
preserve `1.02` cleverly.

**⚠️ About no longer reads from the API, and that is a content-source
regression this ticket knowingly ships.** Phase 1's `AboutSection` pulled its
bio, stats, availability note and résumé link from `useAbout()`; the prototype
hardcodes all of it, so the Phase 2 transcription does too. The admin CMS's
About panel therefore no longer drives the public page — `AdminAboutPanel`
still reads and writes the same data, it just has no public reader any more.
**⚠️ Two claims that were here and were wrong — corrected 2026-08-17 after
actually reading the schema and the seed.** They are left visible rather than
silently swapped because both were written confidently and neither was checked:

- ~~"the prototype's copy and the API's shape do not line up field for field"~~
  They line up almost exactly. `seed.js`'s `ABOUT_DATA` carries the two body
  paragraphs verbatim, `availabilityNote` verbatim, and a `stats[]` of exactly
  the four cards including `{ label: 'Learning', value: 'Continuous' }`. The
  only real friction is that `value` is a **String** (`'5+'`), so `CountUp`'s
  numeric `to` + `suffix` has to be parsed out of it.
- ~~"PF-80 did the same thing to the hero"~~ It did not. Phase 1's `HeroSection`
  had **zero** API calls — verified at `fa25cfe~1`: its only hook was
  `useTypewriter` (a local hook with a hardcoded `ROLES` array) and its social
  links were hardcoded JSX. There was nothing to disconnect, and there is no
  Hero model, route, hook or admin panel anywhere in the repo.

About is therefore the **first and only** section a Phase 2 rebuild has taken
off the API. Re-wiring it still needs its own ticket, but the reason is
narrower than what was claimed here.

That replacement also orphaned **`apiUrl`** (`services/api.js`): `AboutSection`
was its only consumer, and it now has none. Same shape as the PF-80 orphans
below — left in place, since `services/api.js` is Phase 1 infrastructure that
gets revisited at cutover, and it is the natural way to build the résumé link
when Contact lands. `useInView` and `useAbout` are **not** orphaned: four Phase
1 sections still use the first, `AdminAboutPanel` still uses the second.

The résumé download is not lost with it. The prototype's hero CTA points at
`#contact` (line 119) and the real download lives in the contact section
(line 505) — both Sprint 12's.

**Built by PF-85 — Projects is Phase 2, and the first section to render a
schema field PF-52 built two sprints before anything could use it:**

```
frontend/src/
  components/sections/
    ProjectsSection.jsx  + .module.css   REPLACES the Phase 1 Projects, same path
    __tests__/ProjectsSection.test.jsx   34 tests, all 14 guards mutation-tested
  styles/
    keyframes/base.css                   blink corrected to the prototype's form
    animations.css                       + kf-blink carrier
    __tests__/keyframes.test.js          + a guard pinning blink's FORM
backend/src/
  config/corsOptions.js                  + dev-port range, non-production only
  __tests__/corsOptions.test.js          NEW — 31 tests, both environments
```

Reuses `useProjects()` unchanged — no second query. The API already sorts
`{ order: 1, createdAt: -1 }` (`projectController.js:8`), so **display order
is an admin field, not a code constant.**

**Layout rules, all owner decisions from 2026-08-19:**

- **The big card is `projects[0]` — the first by `order`, regardless of its
  `featured` flag.** Two projects are genuinely featured, but the prototype's
  numeral series starts at **02** precisely because the big card does not
  participate in it: the FEATURED badge occupies the slot the numeral would
  fill. So `featured` controls the BADGE and `order` controls the SLOT.
  Reordering is therefore an admin-panel edit, not a code change — the panel
  already exposes `order` ("Display order (0, 1, 2...)") and `featured`.
- **⚠️ When `projects[0].featured` is false, that slot renders NOTHING — not
  a "01".** The prototype has no `01` anywhere. Inventing one means inventing
  type styling with no design source: the small-card numeral is Anton 44px
  above a 21px heading, while the big card's heading is `clamp(26px,3.4vw,42px)`.
  The card is a flex column, so an absent child collapses its own gap. The
  state is reachable by one untick in the admin panel. Guarded.
- **Numerals are derived, `String(i + 2).padStart(2, '0')`.** Four projects
  give `02 03 04`, byte-identical to the prototype; a fifth added in the admin
  panel gives `05`. Delays likewise: `80 + i*70` → 80/150/220, continuing at
  290 rather than hardcoding three and special-casing the rest.

**The owner's data decision: ClearDrive keeps 10 tech pills.** The prototype
renders **9** for that card — it omits `Tailwind CSS` — while `seed.js` and
the live API carry 10. The other three cards match the seed exactly, name for
name and in order, so this is one stale entry in a design export rather than a
systematic difference. **The API wins here and that is deliberate**; a fidelity
pass must not cut the pill back. Same shape as PF-82's skill-order finding,
resolved the other way because there the prototype was right.

**The card background bridge — PF-52's schema field finally has a reader.**
The prototype's `applyProjectBgs()` (line 684) reads
`localStorage['pg-project-bgs']` keyed by project title; every card carries
`data-cardbg="<title>"` plus a `data-cardscrim` sibling. That localStorage
hop is a design-tool affordance, but the visual contract maps one-to-one onto
`Project.backgroundImage { src, opacity }`:

```js
bg.opacity     = vis                              // schema default 0.75
scrim.opacity  = Math.min(1, 0.45 + vis * 0.6)    // prototype line 704
// no src → both layers absent (the prototype sets both to opacity 0)
```

- **⚠️ `backgroundImage` is an OBJECT, not a string.** Guarding on the object
  itself is always truthy and emits `url("[object Object]")` on every card.
  Guard on `.src`. Guarded by a test asserting that string never appears.
- **⚠️ At the default 0.75 the scrim is `0.8999999999999999`, NOT `0.9`, and
  that is correct.** `0.45 + 0.75 * 0.6` is not exactly representable in IEEE
  754, and the prototype's own `String(Math.min(1, 0.45 + vis*0.6))` produces
  the identical string — verified in node. A test asserting `'0.9'` fails
  against correct code, which is how this was found. Rounding it would be a
  deviation from the design dressed up as tidiness.
- Every project's `src` is `''` today (`seed.js` sets it explicitly), so both
  layers are absent and the cards match the prototype exactly. Verified with
  a src hand-set: bg `0.75` / `cover` / `50% 50%` / z-index 0, scrim `0.9` /
  z-index 1, content `position: relative` / z-index 2.
- **Content clears both layers via one declarative rule**, not the prototype's
  per-child DOM sweep: `.card > *:not(.cardBg):not(.cardScrim)`. Both classes
  must stay in the `:not()` list — dropping either lifts a layer above the
  text, which nothing errors on and no element-counting test notices, because
  the text is still in the DOM and merely painted over. Guarded.

**The terminal panel is NOT `components/common/TerminalWindow.jsx`.** They
share a concept and almost nothing else — the Phase 1 component TYPES its
lines in over ~4.3s and drops the caret when it finishes, where the prototype
is a static snapshot with a permanent caret. Also radius 22px vs 0.875rem,
8 lines vs 9, 12.5px/2 vs 0.8rem/1.8, literal hexes vs Phase 1 tokens.
`TerminalWindow` was **DELETED in PF-89**; this entry is kept because
"reuse the existing terminal component" is the obvious-looking move and
it was wrong twice over.

It renders **unconditionally, including while projects are loading** — it is
hardcoded content with no API dependency, so gating it behind the query would
blank it for nothing. That has a useful side effect: the big-card placeholder
shares an `align-items: stretch` row with it, so it is stretched to the
terminal's height for free (see the placeholder note below).

**`data-terminal` IS attached (owner-approved, 2026-08-19), and the rule it
activates had never matched anything in this project's history.** `tokens.css`
carries `html[data-theme="light"] [data-terminal] { box-shadow: … }`, wholesale
from PF-67, and the prototype never puts the attribute on an element — one
occurrence in `Portfolio Revolution.dc.html`, one in `Blog.dc.html`, both the
rule itself. Attribute selectors are not scoped by CSS Modules, so the global
rule reaches the element as-is (same mechanism as `data-lightplate`). Measured
in Chromium on the same element, toggling the attribute live:

| | box-shadow |
| --- | --- |
| DARK, present | `rgba(0, 0, 0, 0.5) 0 30px 60px` |
| LIGHT, present | `rgba(20, 33, 61, 0.22) 0 30px 60px` |
| LIGHT, **removed** | `rgba(20, 33, 61, 0.5) 0 30px 60px` |
| LIGHT, restored | `rgba(20, 33, 61, 0.22)` |

Alpha only, light theme only — dark is byte-identical because the rule is
scoped to `html[data-theme="light"]`. Guarded, because a silently dropped
attribute is exactly the `data-lightplate` failure mode.

**The tech pill is declared LOCALLY, like Skills'.** Do not compose
`patterns.module.css`'s `.pill` — it is a third shape matching neither
prototype pill (`inline-flex`, `10px 18px`, plus a `gap` and `letter-spacing`
neither has), and it still has zero external consumers. The Projects and
Skills pills differ on five properties:

| | Skills (l.256) | Projects (l.325) |
| --- | --- | --- |
| `font-size` | 12px | **11px** |
| `padding` | 7px 12px | **6px 11px** |
| `background` | `rgba(252,163,17,.08)` | **none (transparent)** |
| `border` | `rgba(252,163,17,.22)` | **`rgba(var(--ln),.16)`** |
| `color` | `var(--text)` | **`var(--muted)`** |

They match on hover, transition, radius, cursor, display and family. Blog has
a **fourth** variant (10.5px, `.06em`, `5px 10px`) — PF-86 must not assume it
can reuse this one.

Declared **bare**, and that is correct: the pill is not `Reveal`-wrapped —
the prototype wraps the CARD (line 357) — so nothing supplies it a
transition and it must keep its own. Same case as
`patterns.module.css`'s `.pill:not([data-reveal])`. (This entry used to
say "with no `[data-reveal='in']` gate"; that gate no longer exists
anywhere — PF-93.)

**Two links on the big card, a case the prototype never shows.** Its big card
holds a single bare `<a>` with `margin-top:auto; align-self:flex-start`,
because the project in that slot had no `liveUrl`. ClearDrive has one, so
`.featuredLinkRow` composes the small card's row (`display:flex; flex-wrap:wrap;
gap:12px`, line 374) with the big card's `margin-top:auto` (line 333). Both
values are the prototype's. **No `align-self: flex-start`** — a full-width row
is what makes `flex-wrap` work; shrinking it to content breaks wrapping on a
narrow card. Measured: the row sits 37px above the card's bottom edge, i.e.
its 36px padding plus the border, exactly as the single link did.

**Placeholder heights are measured, and one of them has no correct value.**

- `.bigCardPlaceholder` is **289px**, the TERMINAL's own natural height. At
  ≥900px it is inert — the stretch row is already 289px because the terminal
  is real content — and it only bites at ≤768px where the row wraps and the
  placeholder would otherwise collapse to **2px** (its borders). Measured both
  ways with the API stalled.
- `.cardPlaceholder` is **479px**, and **no single value is right.** Unlike
  Skills, where every filled card is identical because the rows stretch over
  uniform content, a project card's height follows its description length and
  pill wrapping. Filled heights, measured:
  `1600 479 · 1440 479 · 1280 479 · 1024 619 · 900 479 · 768 594 · 600 391 · 375 594`.
  479 is exact at four of eight widths and off by +140 / +115 / −88 at the
  others. On the Outstanding work list.

**Live verification, measured in Chromium against the production build**,
served from a separate `dist-verify/` behind a same-origin proxy to the real
backend — `.env.production`'s API host is still the Railway placeholder, so a
plain `vite preview` would have had every fetch fail. Build with
`VITE_API_URL= npx vite build --outDir dist-verify`; the empty override makes
`services/api.js` fall through to its relative `/api` default.

| Check | Result |
| --- | --- |
| `scroll-margin-top` | **71px**, not 80 — the `[id]` tie avoided |
| section background | `none` / `rgba(0,0,0,0)` / `auto`, both themes |
| card order · numerals · badges | live order · `02 03 04` · **1** badge |
| tech pills total | **23** (7 + 10 + 2 + 4) |
| terminal | 8 static lines; height **404px** == big card, stretch works |
| caret | `getAnimations().length === 1`, name `blink`, 1000ms, `steps(1)` |
| big card hover | `transition-duration: 0s`, jumps to `translateY(-8px)` |
| small card hover | eases over 1.05s — **the prototype's behaviour, see below** |
| pill hover | accent fill, `accInk`, `translateY(-3px) scale(1.05)` |
| splash gate | **0 / 6** reveals mid-splash, **6 / 6** after it lifts |
| reduced motion | `data-motion=reduced`, caret **0** animations, caret opacity **1**, 0 in subtree |
| reordered (ClearDrive first) | big card = ClearDrive, both links, 10 pills, `02 03 04` |
| bundle keyframes | 36 defined, 19 referenced, **0 unresolved** |

**PF-85 created no new orphans**, and it removed none either: `TerminalWindow`,
`useTypewriter` and `apiUrl` are all still orphaned, still deliberate, still
cutover work.

**Built by PF-93 — the `Reveal` entrance regression, and the first ticket
in this project whose entire diff is deletions:**

```
frontend/src/
  components/sections/
    AboutSection.module.css       − .statCard[data-reveal='in']
    SkillsSection.module.css      − .card[data-reveal='in']
    HeroSection.module.css        − .rolePill[…] and .loudCta[…]
    ProjectsSection.module.css    comments only — two taught the dead gate
  styles/
    patterns.module.css           3 selectors → 1, keeping :not([data-reveal])
    __tests__/revealTransition.test.js   NEW — the structural guard
  components/sections/__tests__/  AboutSection · SkillsSection · HeroSection
  styles/__tests__/patterns.test.js     four gate assertions inverted
```

Five rules deleted, zero properties added. **Nothing else was touched** —
no JSX, no `Reveal.jsx`, no `Reveal.module.css`. That matters because the
whole fix depends on `.reveal`'s transition being correct already, and it
was: PF-74's `up`/`pop` branches were re-checked against prototype lines
954 and 962 **before** deleting anything, since the deletion stops
overriding them and a PF-74 error would have surfaced looking like PF-93's.

**The control row is the evidence, not the four fixes.** Projects' `.card`
was never gated, so its entrance should be byte-identical before and after.
Measured on the production build, same script both times:

```
  ms       BEFORE                    AFTER
   0       0.000 / 38px              0.000 / 38px
 100       0.024 / 37.27px           0.024 / 37.26px
 183       0.502 / 21.76px           0.502 / 21.75px
 367       0.891 / 6.30px            0.891 / 6.31px
 550       0.978 / 1.81px            0.978 / 1.81px
 opacity→1 766ms                     766ms
```

Sub-frame identical. A "fix" that also moved the control would mean the
deletion had reached something it shouldn't.

**⚠️ Withdrawing an approved deviation needed sign-off even though it
moves TOWARD the prototype**, and the PF-93 ticket granted it in advance
conditional on re-verifying the claim it rests on. That verification is
Step 1 of the ticket and it passed — `hideReveals()` writes the transition
inline, four `style.transition` writes exist in the whole prototype, and
nothing clears them on the normal path. Recorded because "it's closer to
the design" is not on its own a licence to change something the owner
signed off on.

**Built by PF-86 — the Blog teaser is Phase 2, and the first section whose
links had to be decided rather than transcribed:**

```
frontend/src/
  components/sections/
    BlogSection.jsx  + .module.css   REPLACES the Phase 1 Blog, same path
    __tests__/BlogSection.test.jsx   46 tests, every guard mutation-tested
```

**No other file changed.** `sweep` was already in `base.css` and `kf-sweep`
already in `animations.css` (PF-81's About portrait), so this is the
carrier's second consumer and neither file needed touching. Confirmed in
the built bundle: 36 keyframes defined, **0 unresolved**, and the sweep
layer reports `getAnimations()` → one running `sweep` at 9000ms.

Wired to `useBlogPosts()` — third API-driven section after Skills and
Projects. Already inside an `<ErrorBoundary>` in `HomePage.jsx`; checked,
not assumed. `ContactSection` is still the only bare one.

**⚠️ All five links point at `/blog`, and NEITHER `/blog` nor
`/blog/:slug` exists.** The prototype gives all four post links
`href="#blog"` — the section's own id, so a click scrolls to the section
you are already in. That is a design-tool artefact: Claude Design has no
post-detail screen to target, which is exactly why its fifth link goes to
`Blog.dc.html`, the one place it had somewhere real to point. Owner's
call, 2026-08-21: all five go to `/blog`, Sprint 13 narrows the post cards
to `/blog/${slug}`.

Three things worth knowing about that:

- **They render `NotFoundPage` today.** `App.jsx` has `/`, `/admin/login`,
  `/admin`, `/admin/*` and `*` — nothing else. This is not a regression:
  Phase 1's `BlogSection` linked to `/blog/${post.slug}` with a plain
  `<a href>` and has been hitting the 404 for as long as it has existed.
- **React Router `<Link>`, via `Reveal`'s `as` prop** (`as={Link} to=…`).
  `Reveal` renders `<Tag ref={ref} …>` and React Router v7 forwards `ref`,
  so this needed no change to `Reveal`. A plain `<a href="/blog">` would
  full-page reload, discarding the TanStack Query cache and replaying the
  splash.
- **The route target is one constant, `BLOG_ROUTE`.** Sprint 13 narrows
  the post cards by changing where three `to=` props read from, not by
  hunting five string literals.

**⚠️ The live seed makes the design's own ordering unreproducible, and
this is data rather than code.** `seed.js` writes all four posts with one
`insertMany`, so `timestamps: true` stamps them with an IDENTICAL
`createdAt` — `2026-08-09T05:56:05.288Z`, read off the live API, not
inferred. Two consequences:

| | prototype | live data |
| --- | --- | --- |
| dates | JUL · JUN · MAY · APR 2026 | **AUG 2026** ×4 |
| read times | 6 · 7 · 4 · 5 MIN | **1 MIN** ×4 |
| order | MERN, ClearDrive, Docker, JAX-RS | **undefined** — a four-way tie |

`readingTimeMinutes` is a real schema field, derived by `Blog.js`'s
pre-validate hook from a word count across `sections[]`; the seeded posts
are simply short enough to round to 1. Nothing is computed in the
component.

The tie is the part that bites: `sort({ createdAt: -1 })` over four equal
values is free to return any order, and the live API currently hands back
**JAX-RS first**, which would put it in the LATEST POST slot. So
`byRecency()` tiebreaks on **`_id` ascending**, which recovers insertion
order because an ObjectId's trailing counter increments within a single
`insertMany` — and insertion order is the prototype's own 01·02·03·04.
Verified against the production build: MERN featured, then ClearDrive,
Docker Compose, JAX-RS.

It is a degenerate-case fallback and nothing more — the moment two posts
have different `createdAt` values the date comparison decides and the
`_id` branch never runs. **Giving the seed real dates and read times is
the actual fix**, and it is on the Outstanding work list rather than done
here: it is a backend change outside this ticket and, against the live
cluster, a production write like migration 004.

Five things worth knowing before touching the section:

- **The section wash comes OUT, and unlike Projects this is a real
  removal.** The prototype's line 414 carries
  `linear-gradient(180deg, rgba(var(--gnd),.3) 0%, rgba(var(--ftr),.68)
  50%, rgba(var(--gnd),.3) 100%)`. Omitted under the 2026-08-18 site-wide
  decision and guarded as an **absence**, so a fidelity pass diffing
  against the prototype does not read it as un-transcribed. Faithful
  transcription is the trap here — the instinct that got PF-85 right gets
  this wrong.
- **The featured card's `background-size: 100% 320%` is card content, not
  a wash**, and a separate test asserts it survives. This is the
  `background-size`-grepped-separately lesson landing for real: a
  `background:` grep over the section finds the wash and misses the sweep
  layer entirely.
- **`align-items: start` on the outer grid, not `stretch`.** Projects'
  featured row uses `stretch` and this one must not — the right column is
  three short rows plus a link, and stretching it to the featured card's
  height spreads its 12px gaps out to fill the difference. Measured:
  featured 394px against a column of 629px, not stretched.
- **`min-width: 0` on the compact row's body is load-bearing, and the
  control proves it.** ⚠️ It takes a genuinely unbreakable token to see:
  a long title of ordinary words wraps, and a hyphenated slug breaks at
  its hyphens, so both show **zero difference** with the declaration
  removed — measured, after a first control that proved nothing. With a
  60-character unbroken token at 375px: `min-width: 0` holds the row at
  341px, and removing it grows the row to **787px**, past the card and
  the viewport. (The text still spills *inside* the card in that case;
  the prototype declares no `overflow-wrap` either, so that is left as
  found.) Realistic titles do not overflow at any width down to 320px.
- **The browse-all link renders while loading.** It is a fixed link with
  no dependency on the query, so gating it would blank it for nothing —
  same reasoning as PF-85's terminal panel.

**The tag pill is a FOURTH variant and composes nothing:**

| | patterns `.pill` | Skills | Projects | **Blog** |
| --- | --- | --- | --- | --- |
| `font-size` | 11px | 12px | 11px | **10.5px** |
| `padding` | 10px 18px | 7px 12px | 6px 11px | **5px 10px** |
| `letter-spacing` | .1em | — | — | **.06em** |
| `background` | none | `rgba(252,163,17,.08)` | none | as Skills |
| `border` | `rgba(var(--ln),.18)` | `rgba(252,163,17,.22)` | `rgba(var(--ln),.16)` | as Skills |

Closest to Skills' but scaled down on three properties, so composing it
would be a near-miss that renders slightly too large rather than visibly
wrong. `patterns.module.css`'s `.pill` still has no external consumer.

**⚠️ The pill is the case PF-93's rule does NOT cover, and this section is
where the distinction earns its keep.** Six elements here are
Reveal-wrapped — `.eyebrow`, `.heading`, `.count`, `.featuredCard`,
`.row`, `.browseAll` — and **none declares a `transition`**. The pill sits
*inside* the reveal target rather than being it, so the prototype's
`hideReveals()` never writes an inline transition over it and its own
declaration is what applies, in the export as much as here. Measured on
the production build:

| element | `transition-property` / duration | hover result |
| --- | --- | --- |
| `.featuredCard` | `opacity, transform` / `.85s, 1.05s` | eases to `translateY(-6px)`; border **snaps** at 30ms |
| `.row` | `opacity, transform` / `.85s, 1.05s` | eases to `translateX(8px)`; bg + border **snap** |
| `.browseAll` | `opacity, transform` / `.85s, 1.05s` | bg + border snap, no transform (the prototype's hover has none) |
| `.tagPill` | its own, `.25s` ×4 | `translateY(-3px) scale(1.05)`, accent fill |

All four values come from `.reveal` except the pill's. PF-93's repo-wide
scanner picks up all six new classes automatically — confirmed by
mutation, a `transition` added to `.featuredCard` fails it.

**Loading and error states follow Skills and Projects.** Error keeps the
section, the `<h2>` and the `#blog` anchor — `Navbar.jsx:12` links to it —
and drops only the grid, logging from an effect keyed on the error rather
than the render body. **The empty state also keeps the section**, where
Phase 1 returned `null`; that was the dead-anchor bug.

The post count is derived — `${posts.length} POSTS · NOTES FROM THE
BUILD`, of every published post rather than of the four on screen, so it
diverges the moment a fifth is published. **Rendered only when there is a
real number**: during a cold load or after a failed fetch it would
otherwise read "0 POSTS", which is wrong rather than merely absent.

**Placeholder heights are measured and, as in PF-85, neither has a single
correct value** — a card's height follows its excerpt length and how its
tags wrap. `offsetHeight` of the live elements:

| width | `.featuredCard` | the three `.row`s |
| --- | --- | --- |
| 1600 | 394 | 177 · 177 · 177 |
| 1440 | 394 | 177 · 177 · 177 |
| 1280 | 420 | 177 · 177 · 177 |
| 1024 | 395 | 255 · 197 · 198 |
| 900 | 404 | 271 · 214 · 214 |
| 768 | 422 | 292 · 235 · 214 |
| 600 | 332 | 172 · 172 · 172 |
| 375 | 421 | 270 · 235 · 214 |

394 and 177 are exact at the two widths the two-column design is drawn
for, and 177 at 1280 as well. Both are `min-height`, so an under-estimate
grows the section rather than clipping.

**Live verification, measured in Chromium against the production build**,
served from `dist-verify/` behind a same-origin proxy — `.env.production`
is still the Railway placeholder:

| Check | Result |
| --- | --- |
| `scroll-margin-top` | **71px**, not 80 — the `[id]` tie avoided |
| section background | `none` / `rgba(0,0,0,0)` / `auto` |
| outer grid | `align-items: start`; featured 394px vs column 629px, **not stretched** |
| sweep layer | `getAnimations()` → **1 running**, name `sweep`, **9000ms** |
| bundle keyframes | 36 defined, **0 unresolved** |
| the five links | all `/blog`, all `<a>`, **0** resolving to `#blog` |
| numerals | `01 02 03 04`, all four `aria-hidden` |
| badge | exactly **1** `LATEST POST` |
| post count | `4 POSTS · NOTES FROM THE BUILD` |
| order | MERN featured, then ClearDrive · Docker · JAX-RS |
| splash gate | **0/8** reveals mid-splash, **8/8** after it lifts |
| reduced motion | sweep **0 running / 0 total**; all four hovers still apply at ~1e-05s |
| long titles | no overflow at 1440 → 320px; chevron inside, no page h-scroll |

**⚠️ `mix-blend-mode: screen` in light theme reads as NOTHING, not as a
bright band** — the ticket asked which, and it is neither the sheen nor
the artefact. `screen` can only lighten, and amber `rgba(252,163,17,.14)`
at layer opacity `.5` gives an effective alpha of **0.07** over the light
card's near-white paper, which computes to a **+1/+1/+0** per-channel
change. Pixel-differenced against the same card with the layer hidden:
the flat padding margin shows **no lightening at all**, only ≤6/255 of
negative compositing noise. Dark theme is where it works — surface
`[8,10,17]` → `[17,19,25]`, a faint warm lift. **Reported, not adjusted**:
it is the design's own value, and the failure mode is invisibility rather
than a wrong-looking band.

**⚠️ Two inherited contrast failures, reported rather than fixed** — both
are the prototype's own values, so they follow the PF-83 stat-label
precedent: raise, get sign-off, then change. Measured against each node's
composited background:

| node | dark | light |
| --- | --- | --- |
| compact-row meta (`--muted2`, 10px) | **4.30** ✗ | 5.79 ✅ |
| featured meta separator `·` | 5.20 ✅ | **1.44** ✗ |

The first is *exactly* PF-83's About finding again — `--muted2` at a small
size on a translucent surface, failing dark-only, and `--muted` is the
one-step-lighter token that fixed it there. The second is a token-vs-
literal split inside one section: the featured separator is a literal
`rgba(252,163,17,.7)` (prototype line 435) while the compact rows' is
`var(--acc)` at `opacity:.65` (line 446), so the featured one keeps dark
theme's amber on light paper and the row one flips to `#7E4800`. Same
shape as the terminal caret fixed in PF-85's follow-up.

Everything else passes AA in both themes. The three decorative values —
the `.09` ghost numeral (1.11 / 1.05) and the `.3` row numerals (1.83 /
1.20) — are measured and reported per the ticket, not fixed; all are
`aria-hidden`, as Projects' `.28` numerals are.

**⚠️ The rate limiter cost a verification round, exactly as documented.**
Repeated production-build page loads exhausted the backend's 100
requests / 15 min / IP and `GET /api/blog` started returning **429**. It
presents as the section rendering its error state for no reason — which
did at least prove the error state works in a real browser. The
measurement scripts moved to Playwright `route.fulfill()` with a fixture,
which is what the Silent-failures entry already recommends.

**⚠️ And a new Playwright trap, worth adding to that habit: `page.route()`
matches handlers in REVERSE registration order.** A narrow
`**/api/blog` stub registered *before* a `**/api/**` catch-all is silently
overridden by the catch-all, which served `data: []` — so the section
rendered its loading placeholder and every probe read `undefined` off a
card that was not there. Register the catch-all first.

**PF-86 created no new orphans and removed none.** `TerminalWindow`,
`useTypewriter` and `apiUrl` are all still orphaned, still deliberate,
still cutover work.

~~`useInView` drops to **exactly one** consumer — `ContactSection`, PF-88's.~~
**It dropped to ZERO in PF-87** — see that entry. Fourth orphan, as predicted here.
Counted, not inferred: PF-82 recorded three (Projects, Blog, Contact),
PF-85 took Projects and this ticket takes Blog. So the moment Contact is
rebuilt, `useInView` and its test become the fourth orphan on the cutover
list, and it is worth expecting rather than rediscovering.

**Built by PF-87 — Contact is Phase 2, the main page is fully rebuilt, and
the résumé subsystem finally has a frontend:**

```
frontend/src/
  components/sections/
    ContactSection.jsx  + .module.css   REPLACES the Phase 1 Contact, same path
    __tests__/ContactSection.test.jsx   45 tests
  pages/HomePage.jsx                    + <ErrorBoundary> around Contact
  pages/__tests__/HomePage.test.jsx     + the guard for it
frontend/e2e/homepage.spec.js           vacuous test REPLACED, +3
backend/package.json                    jest.testTimeout 5000 → 30000
```

**⚠️ THE TICKET'S "the empty state has no design source" IS WRONG, AND THE
PROTOTYPE'S ANSWER IS BETTER THAN ALL THREE OPTIONS IT OFFERED.** The
ticket saw `<a href="#contact" download>` (line 505) and read it as
PF-86's `href="#blog"` again — a design tool with nowhere to point. It is
not. `applyResume()` (line 676) rewrites that anchor at runtime:

```js
if (r && r.dataUrl) { el.setAttribute('href', r.dataUrl); el.setAttribute('download', r.name); el.removeAttribute('title'); }
else { el.setAttribute('href', '#contact'); el.removeAttribute('download'); el.setAttribute('title', 'Upload a résumé in the admin panel to enable this'); }
```

So the markup href is the EMPTY STATE, not a dead anchor, and the design
does answer the question: always show the button, leave it inert, explain
why on hover. Ported one-to-one onto `About.hasResume` — the same move
PF-85 made mapping `applyProjectBgs()` onto `Project.backgroundImage`, and
for the same reason: the localStorage hop is a design-tool affordance but
the visual contract maps exactly.

**⚠️ Which means the ticket's instruction "Do not pick one — report and
let the owner decide" is superseded by "the prototype wins".** Nothing was
invented. Worth reading as a pattern: this is the THIRD time a `<a
href="#<own-section>">` in the prototype has looked like an artefact, and
the second time it turned out to have a runtime handler behind it. **Grep
the script block for the element's own attribute before calling an href
dead** — `data-cv` here, `data-cardbg` in PF-85.

**Case B is what is live** (checked, not assumed): `GET /api/about` returns
`hasResume: false` with every `resume.*` field empty, and `GET /api/resume`
returns **HTTP 404** `{"status":"fail","message":"No résumé is currently
available"}`. So the CV button ships in its inert state today and becomes
a real download the moment Sprint 14's upload UI is used — no frontend
change needed.

**⚠️ THE TICKET'S THIRD PROTOTYPE DEFECT DOES NOT EXIST.** Step 2.4 claims
the email anchor is unterminated (`</a` with no `>`). It is terminated —
verified at byte level, `3c 2f 61 3e` = `</a>`, at line 502. The known
prototype defects remain **two**: the undeclared `acc` (line 834) and the
unattached `data-terminal` (fixed in PF-85). Do not go looking for a third.

**`#contact`'s `scroll-margin-top` is FIXED — 80px → 71px.** The headline
of this ticket and the last live instance of the `[id]` cascade trap.
Measured in Chromium on the production build, all six sections:

| section | before | after |
| --- | --- | --- |
| hero · about · skills · projects · blog | 71px | 71px |
| **contact** | **80px** ✗ | **71px** ✅ |

Both CTAs that point here (`hero LOUD CTA`, navbar `CONTACT`) now land with
`location.hash === '#contact'` and the section top at **exactly 71px**,
flush with the header's bottom edge — clearance 0.

**`ContactSection` is wrapped in `<ErrorBoundary>`, so NO SECTION IS BARE
ANY MORE.** It was the last one, and the exposure was the whole root:
`App.jsx` uses React Router's legacy component API with no `errorElement`
and there is no boundary around `<App />` in `main.jsx`. Guarded in
`HomePage.test.jsx` with a conditionally-throwing stub, confirmed by
mutation.

**`useInView` is now the FOURTH ORPHAN, exactly as PF-86 predicted.**
Counted, not inferred: zero non-test consumers in `frontend/src`. It joins
`useTypewriter`, `TerminalWindow` and `apiUrl` — except `apiUrl` is no
longer one, see below. Its own test file still passes, which is the
green-suite-hides-dead-code shape this file documents; do not read that as
evidence of use.

**`apiUrl` is NO LONGER an orphan.** `CV_HREF = apiUrl('/resume')` is its
first consumer since PF-81 removed the last one, and its doc comment names
this exact case — anchors the browser fetches itself, on a different origin
in production. A literal `/api/resume` would work behind the dev proxy and
404 on the live site.

Six things worth knowing before touching the section:

- **BOTH the section wash and the accent glow come out.** The wash
  (`radial-gradient(100% 80% at 50% 0%, rgba(var(--srf),.8),
  rgba(var(--gnd),.6) 70%)`, line 489) went under the 2026-08-18 site-wide
  decision. The glow — a separate `aria-hidden` absolute child at
  `rgba(252,163,17,.16)`, line 490 — was BUILT, raised as an open
  question, and then **removed on sight by the owner (2026-08-22)**. Full
  reasoning in Locked decisions; the short version is that the argument
  for keeping it did not survive contact with `overflow: hidden`.
  `overflow: hidden` itself STAYS — the prototype's own value, and not
  "the other half" of the removal.
- **The eyebrow's `margin-bottom` is 20px — a THIRD value, not a fourth
  copy of 14px.** About 38px, Skills/Projects/Blog 14px, Contact 20px.
  This is the section that vindicates `patterns.module.css` carrying none.
- **The H2 is the only section heading with `letter-spacing` OR
  `word-spacing`** — `.03em` and `.12em`, both real, both trivially lost
  to a normalising pass. Verified rendered: 2.2464px / 8.9856px at 74.88px.
- **`type="text" inputmode="email"`, not `type="email"`.** The prototype's
  own choice, and it changes behaviour rather than semantics: `type=email`
  fires native validation whose bubble has no treatment in this design.
  The form carries `noValidate` so the two cannot drift apart.
- **Client validation is the prototype's, copy included** — `All three
  fields are required.` / `That email address looks off.` (lines
  1138-1139). ⚠️ It is deliberately NOT the whole contract: the backend
  additionally requires a message of **≥10 characters** and caps field
  lengths. A 9-character message passes the client and comes back 400 with
  the server's own sentence, which the catch surfaces. Duplicating the
  server's rules client-side would be a second source of truth.
- **The form clears on success ONLY.** No design source — the prototype's
  submit is a 900ms `setTimeout` and cannot fail. A network blip must not
  cost a visitor the message they came to write.

**⚠️ `outline: 2px solid transparent`, and forced-colors PROVES it was
needed.** The prototype ships a bare `outline: none` on all three fields,
which would have been this repo's first — PF-83 recorded "there is no
`outline: none` anywhere in this repo, checked" and left form controls out
of the global `:focus-visible` ring precisely so this ticket could
transcribe the prototype's own `border-color` treatment.

⚠️ **PF-91 (2026-08-28) added the repo's first and only `outline: none`,
so "zero anywhere" is no longer true — and the two cases are worth
reading together, because they resolve in OPPOSITE directions on the same
question.** Here, a form control needs an indicator, so the suppression
is refused and a transparent outline preserves the forced-colors
fallback. There, `<main>` carries `tabindex="-1"` and is therefore never
in the tab order at all — it is focused only to move the reading
position, so WCAG 2.4.7 does not reach it and a full-page ring in
forced-colors would be noise rather than information. **The discriminator
is whether a keyboard can OPERATE the element, not whether it can receive
focus.** That is exactly the distinction a later reader will collapse if
only one half is recorded.

Measured in Chromium's forced-colors emulation, all three fields:

| mode | outline | border |
| --- | --- | --- |
| normal | `rgba(0, 0, 0, 0) solid 2px` — invisible | `rgb(252, 163, 17)` — the design's indicator |
| **forced-colors active** | **`rgba(0, 230, 255, 0.8) solid 2px`** — system colour | overridden to the same |

So the transparent outline renders as nothing normally and is **restored
by the OS** when author colours are overridden. A bare `outline: none`
would have left the field with no focus indicator at all in that mode —
invisible to anyone testing normally. Guarded as "no bare `outline: none`
anywhere in the file", via postcss.

**⚠️ THIS SECTION DECLARES ZERO `transition`s, AND THAT IS TRANSCRIPTION
RATHER THAN THE PF-93 RULE.** Which elements are Reveal targets is less
obvious here than anywhere else: the prototype puts `data-reveal` on the
ROW DIVS, not on the links inside them. Eight targets — `.eyebrow`,
`.heading`, `.intro`, two `.ctaRow`s, `.socialRow`, `.location`, `.form`.

The links, inputs and submit are **children** of a target rather than
targets, so `hideReveals()` never writes to them either — and the
prototype declares `transition` on nothing in this section. So every hover
here **snaps**, in the export exactly as here. Measured on the production
build, all four at `transition-duration: 0s`:

| element | hover result |
| --- | --- |
| `.emailLink` | `translateY(-3px)`, accent fill, shadow → `0 22px 54px rgba(252,163,17,.5)` |
| `.cvLink` | `translateY(-3px)`, accent fill, `--accInk` |
| `.socialLink` | **no transform** — the prototype's hover has none; colour/border/bg only |
| `.submit` | `translateY(-2px)`, shadow → `0 20px 46px rgba(252,163,17,.45)` |

The absence of a transform on the social links is the design's, not an
omission. PF-93's repo-wide scanner picks up all eight new classes
automatically — confirmed by mutation, a `transition` on `.form` fails it
by name.

**⚠️ THREE AA FAILURES, REPORTED NOT FIXED — and one of them the ticket
did not ask about.** All measured against each node's composited backdrop
on the production build, both themes:

| node | dark | light |
| --- | --- | --- |
| location line (`--muted2`, 11.5px) | **4.55** ✅ (marginal) | 5.45 ✅ |
| **form field labels** (`--muted2`, 10.5px) | **4.15** ✗ | 5.95 ✅ |
| error text (`#f87171`, 11.5px) | 6.65 ✅ | **2.48** ✗ |
| sent text (`#34d399`, 11.5px) | 9.57 ✅ | **1.72** ✗ |

Three things about that table:

1. **The location line PASSES**, marginally, which is the opposite of what
   the ticket expected — it flagged `--muted2` at 11.5px as the likely
   failure. It sits on the page ground rather than on a translucent card,
   which is what saves it.
2. **The field labels are the actual `--muted2` failure, and the ticket
   never mentions them.** 4.15 dark is BYTE-IDENTICAL to About's stat
   labels before PF-83 fixed them — same token, same small size, same
   translucent surface. That is the **fourth** occurrence of this exact
   trap (About's stat labels, Blog's compact-row meta, the navbar's ADMIN
   link, now these), and `--muted` is the one-step-lighter answer every
   time.
3. **Both status colours fail in LIGHT theme**, badly, and for the reason
   the ticket predicted: they are literal hexes chosen for a dark panel
   and the form surface flips underneath them. `#34d399` at 1.72 is worse
   than `#f87171` at 2.48. Same token-vs-literal shape as the terminal
   caret fixed in PF-85's follow-up.

All four batch into PF-91, per the PF-83 stat-label precedent: raise, get
sign-off, then change.

**Live verification, measured in Chromium against the production build**,
served from `dist-verify/` behind a same-origin proxy — `.env.production`
is still the Railway placeholder:

| Check | Result |
| --- | --- |
| `scroll-margin-top`, all 6 sections | **71px** each — the live 80px bug is gone |
| header height | **71px**, unchanged |
| section background | `none` / `rgba(0,0,0,0)`, both themes |
| glow layer | **absent** — removed 2026-08-22; 0 decorative gradient layers in the section |
| all 6 sections | `background-image: none` / `rgba(0,0,0,0)`, both themes |
| H2 spacing | `2.2464px` letter · `8.9856px` word (= .03em / .12em) |
| eyebrow margin | **20px** |
| CV link (no résumé) | `href="#contact"`, no `download`, prototype's title |
| focus, normal | outline transparent, border → `rgb(252,163,17)` ×3 |
| focus, forced-colors | outline → **system cyan** ×3 — the fallback works |
| hover | all four snap at `0s`; social has no transform, correctly |
| all 8 reveals | inherit `.reveal`'s `opacity .85s / transform 1.05s` |
| splash gate | **0/8** reveals mid-splash, **8/8** after it lifts |
| reduced motion | `data-motion=reduced`, 0 running animations, all 8 at rest, hover **still lifts** `-3px` |
| mobile 375px | no horizontal overflow, form single-column 343px, textarea 118px |
| prototype declarations matched verbatim | **142**; the 4 unmatched are all composed from `patterns.module.css` |

**The gate, all five commands:** frontend **586 / 586** (41 files) · lint
**exit 0** over 115 files · build **218 modules**, 60.96 kB CSS / 412 kB JS
· backend **242 / 242** · E2E **29 / 29** (up from 26, and 1.1m vs 1.6m).
**39 mutations across every new guard, all caught** — 30 on the component and
module, 4 on the E2E replacements, 5 on the glow-removal absence guards.

**⚠️ Step 8's backend flake is FIXED, and the fix is one line.**
`backend/package.json` gains `jest.testTimeout: 30000`, up from Jest's 5s
default. Every suite here talks to a real Atlas cluster, so under
full-suite load a round trip can exceed 5s and Jest kills the test before
any assertion runs — a timeout with no `expect` diff, which reads as a
regression on a diff that never touched the backend.

Measured three consecutive full runs after the change: **242 · 242 · 242**,
against the **242 · 239 · 241** recorded on 2026-08-22. ⚠️ The ticket asks
which specs failed in the 239 run — that run predates this session and its
per-spec output was not kept; the only record is the shape in Outstanding
work (`blogViews.test.js › increments views by one`, "Exceeded timeout of
5000 ms"). Three green runs is the evidence offered instead, and it is
weaker than a named diagnosis: it shows the symptom gone, not that one
slow file rather than scattered slowness caused it. **The real fix is
still `mongodb-memory-server`**, which removes the class entirely and makes
the suite runnable offline — its own ticket, because it touches the
`npm test` wrapper whose URI rewrite is the only thing making `clearDB`'s
wipe safe.

**⚠️ THERE WAS A FIFTH STALE PHASE 1 E2E SPEC, IN A FILE THE TICKET NEVER
NAMES.** PF-87's Step 1 points only at `homepage.spec.js`'s vacuous
`"Get In Touch"` test. `e2e/contact.spec.js` — a whole file about the
contact form — is not mentioned anywhere in the ticket, and it surfaced
only by running the suite. It carried **both** documented failure shapes
at once:

| test | before | why |
| --- | --- | --- |
| `shows success state after valid submission` | **FAILED** | asserted Phase 1's copy `text=Message received`; Phase 2 says `✓ Message sent — I'll reply within 24 hours.` |
| `empty form cannot be submitted (HTML5 validation)` | **PASSED, vacuous** | Phase 1's inputs had `required`; Phase 2 has `noValidate` and validates in JS. Its two assertions — the name input is visible, Phase 1's success text is absent — are true whether validation runs or not, and stay true if it is deleted |
| `contact form is visible` | passed, legitimately | the three `name` attributes are unchanged |

Both rewritten against the real Phase 2 behaviour, plus two new tests
(malformed email, and that the email field carries no native validation).
The empty-submit test now counts POST requests, which is the assertion the
HTML5 version could not express — **mutation-tested by deleting the JS
validation, which the old test would have sailed through.**

`?nosplash` added to its `beforeEach` for the PF-84 reason: without it
every test waits out the ~5.65s splash. **The whole suite went 1.6m → 1.1m
while gaining three tests.**

**The generalisable bit: "grep the specs the ticket names" is not a
sweep.** PF-84 found four stale specs, this ticket's own Step 1 knew about
one of them, and a fifth sat in the file whose name matches the section
being replaced. Run the suite; do not grep for the tests you expect.

**⚠️ One real bug in this ticket's own code, caught by that E2E run and
not by any unit test.** The About query was destructured
`{ isError: aboutError }`, so the diagnostic logged the BOOLEAN:

```
[console.error] ContactSection: useAbout() failed true
```

It names the symptom and drops the cause — the failure mode the
`loginError.js` entry is about, in miniature. Fixed to destructure
`isError` and `error` separately. Worth noting no unit test caught it,
because every unit test asserts on the rendered fallback rather than on
what reached the console; the E2E run printed it in passing.

**PF-87 orphaned three Phase 1 CSS classes and un-orphaned one module.**
Counted with a grep over `src/**/*.jsx` discounting tests, not inferred:

| | before | after |
| --- | --- | --- |
| `useInView` | 1 (Contact) | **0** — fourth orphan |
| `.section-label` · `.section-title` · `.section-divider` | 1 each (Contact) | **0 each** — now only in `global.css` |
| `apiUrl` | 0 | **1** — no longer an orphan |
| `useAbout` | 1 (AdminAboutPanel) | 2 |

⚠️ `AboutSection` shows up in a naive `useAbout` grep and is NOT a
consumer — the match is a doc comment explaining why PF-81 took it off the
API. `contactService` keeps its second consumer, `AdminMessagesPanel`.

The three CSS classes go with `global.css` at cutover; they are dead
today. `.btn-primary` and `.btn-outline` are NOT orphaned — six and four
admin/page consumers respectively.

**⚠️ One thing still flagged for the owner rather than decided** — the
accent glow was the other, and it was answered the same day (see Locked
decisions):

- **The email address and the H1 disagree.** The page's H1 is **Parindra
  Gallage**; the contact email is **parindrachameekara@gmail.com**. Both
  are presumably correct and the prototype has it this way, so it ships as
  found — but it is the kind of thing better confirmed than discovered
  live.

**Built by PF-88 — the Footer is Phase 2, the main page is structurally
complete, and REPLAY INTRO is a real feature the file had written off:**

```
frontend/src/
  components/layout/
    Footer.jsx  + .module.css        REPLACES the Phase 1 footer, same path
    __tests__/Footer.test.jsx        23 cases
    ScrollToHash.jsx                 + a per-navigation guard (see below)
    __tests__/ScrollToHash.test.jsx  + 2 cases  (9 → 11)
  components/motion/
    Marquee.jsx                      + `copies` prop (owner-approved fix)
    __tests__/Marquee.test.jsx       + 4 cases  (5 → 9)
  components/sections/
    HeroSection.jsx                  copies={6} — the same fix, its band too
  providers/SplashProvider.jsx       + `resetKey`, a render-phase reset
    __tests__/SplashProvider.test.jsx  + 3 cases  (7 → 10)
  pages/HomePage.jsx                 + replayCount prop, keyed reveal subtree
    __tests__/HomePage.test.jsx      + 4 cases  (2 → 6)
  utils/replay.js                    NEW  beginReplay()
    __tests__/replay.test.js         NEW  5 cases
  utils/nav.js                       + sectionHref(), navModel() now uses it
    __tests__/nav.test.js            + 5 cases  (4 → 9)
  App.jsx                            owns replayCount; both consumers wired
frontend/e2e/
  footer.spec.js                     NEW  7 cases
  navigation.spec.js                 3 selectors → `header`; one poll fixed
  homepage.spec.js                   1 selector → `#hero` (see below)
frontend/.gitignore                  + dist-*/
```

**⚠️ REPLAY INTRO IS A REAL FEATURE, AND THIS FILE SAID OTHERWISE.** The
smooth-scroll locked decision called it "a design-tool 'replay splash'
affordance, not a site feature". Corrected in place above. Reading it as
an artefact and deleting the button would also have broken the layout —
the bottom bar is `1fr auto 1fr`, so the copyright loses its centring.

**Three documented decisions stood between the button and working, and
the third is the one that looks like success.**

1. **`HomePage` freezes the splash decision on purpose.** Recovering a
   setter must not reopen that. It doesn't: the lazy initialiser stays
   exactly as it was and `showSplash` is now a pure derivation,
   `initialShowSplash || replayCount > 0`. The hazard was re-deriving
   from live `matchMedia` during render, not a setter existing — and
   `replayCount` only ever rises from a click.
2. **`initialReady` only SEEDS.** So `SplashProvider` gained `resetKey`,
   which closes the gate again through a **render-phase state
   adjustment** — React's documented "adjusting state when a prop
   changes", a setState on the provider during its own render.
   ⚠️ **Not an effect.** The sections remount in the same commit that
   raises `resetKey`, so an effect would let a fresh `Reveal` arm its
   observer under `ready: true` and fire behind the splash — the exact
   race `SplashProvider`'s own doc comment describes, one layer up. Lint
   accepts it (`npx eslint` exit 0); `react-hooks/set-state-in-effect`
   is the rule that would have rejected the effect version.
3. **⚠️ THE REVEALS DO NOT REPLAY ON THEIR OWN.** `Reveal` sets
   `revealed` true once and never unsets it, so closing the gate leaves
   an already-revealed page revealed: **the splash plays over a fully
   revealed page and lifts on a static one.** No error, nothing red, and
   it looks like it works. Fixed by keying the revealed subtree, which
   reproduces the prototype's `hideReveals()` + `runSplash()` pair
   without touching a primitive six sections depend on.

**⚠️ WHAT IS INSIDE THE KEY IS THE WHOLE OF IT.** Three things are
deliberately outside, and each was verified rather than reasoned:

| outside the key | why |
| --- | --- |
| `StarfieldCanvas` · `CursorGlow` · `GrainOverlay` | keying the PROVIDER instead would remount the canvas and regenerate every star mid-replay — a visible flicker behind the splash. `StarfieldCanvas` reads `useSplashReady()`, so it cannot simply be hoisted out |
| `ScrollToHash` | a remount re-runs its jump for the current hash and fights the scroll-to-top the button just performed |
| the footer's **bottom bar** | it holds the button that was just activated; remounting it drops keyboard focus to `<body>` mid-sequence |

**⚠️ The footer's own four reveals are keyed SEPARATELY, in `Footer`.**
`hideReveals()` walks every `[data-reveal]` in the document and four of
them are in the footer — which `App.jsx` mounts as a **sibling** of the
routed page, so `HomePage`'s key cannot reach them. Without the second
key they stay revealed through a replay and are already shown when the
visitor scrolls back down. Hence `Footer` takes `replayCount` as well as
`onReplay`, and keys only its grid.

**`App.jsx` owns the counter**, because `<Footer />` and `<HomePage />`
are siblings there and that is their nearest common ancestor. Two props,
no context module. ⚠️ Nothing tests that wiring by rendering it —
`App.jsx` sits at `src/` root, which has no `__tests__` directory under
this repo's convention — so `Footer.test.jsx` carries two **source-level**
wiring guards that parse `App.jsx` with comments stripped. They were
mutation-tested; dropping either prop is otherwise completely silent.

**The replay sequence, traced in Chromium on the production build.**
Clicked from the footer at `scrollY 3389`, times from the click:

| ms | scrollY | splash | reveals `in` | canvas node |
| --- | --- | --- | --- | --- |
| 0 | 3389 | — | 49 / 49 | — |
| 78 | 3389 | **YES** | 4 / 51 | same |
| 505 | 690 | YES | 4 | same |
| 1207 | **0** | YES | 4 | same |
| 4702 | 0 | YES | 4 | same |
| 5215 | 0 | YES | **24** | same |
| 5815 | 0 | **gone** | 24 | same |

The four that stay `in` at 78ms are the **footer's** own, measured before
its separate key was added; with it they read `out out out out` at the
same moment and return to `in` only when the visitor scrolls back down.
Keyboard activation was checked in the same pass: focus is still on the
button after `Enter`.

**Under `prefers-reduced-motion` the button scrolls and stops.**
`scrollTo` args `{top: 0, behavior: 'auto'}`, no splash mounted, reveals
unchanged at 49, zero running animations in the footer. With motion
allowed the same click gives `behavior: 'smooth'`.

⚠️ **That `behavior` is the only real correctness decision in the whole
feature, and the prototype hardcodes it wrong for this audience.** A JS
`scrollTo` with an explicit `behavior` **ignores** the root's computed
`scroll-behavior`, so `motion.css`'s root-element override — the one that
exists because `html[data-motion="reduced"] *` cannot reach `<html>` —
does not reach it. Copying line 1147 verbatim animates a scroll for
exactly the users who asked it not to, invisibly to anyone not testing
with reduce on. That is why the two lines live in **`utils/replay.js`**
(`beginReplay()`) rather than inside `App.jsx`: React-free and directly
unit-testable, matching `utils/theme.js`, `motion.js`, `splash.js`,
`nav.js` and `parallax.js`.

`beginReplay()` deliberately does **not** consult `?nosplash`. That param
is the escape hatch for the AUTOMATIC splash on load, and `utils/nav.js`
appends it to every off-home link home — honouring it here would make
the button silently inert for anyone arriving from the blog.

**⚠️ `ScrollToHash` gained a per-navigation guard, and PF-88 is what made
it necessary.** `splashReady` is one of its dependencies, and replay now
closes and reopens that gate mid-session — so a visitor sitting at
`/#projects` who clicks replay got the scroll-to-top, the whole ~5.65s
splash, and then a silent yank back down to `#projects` the instant the
gate reopened. It now records the react-router navigation `key` it
actually scrolled for. Two details are load-bearing: keyed on `key` and
not `hash`, so clicking the same hash twice still re-scrolls; and marked
**inside the rAF, after the scroll**, because StrictMode cancels the
first mount's rAF and an early mark would leave the second mount
refusing to do it. Both mutation-tested.

**Step 3's route-awareness reuses `utils/nav.js`, as one new primitive.**
`sectionHref(pathname, id)` returns a bare `#id` on `/` and
`/?nosplash=1#id` everywhere else; `navModel()` now builds its own links
from it, so the convention is expressed once rather than twice. Verified
in Chromium from `/`, `/blog`, `/blog/a-post` and a 404 — and clicking
`Projects` from a 404 lands `#projects` at exactly **71px**, identical to
the navbar's own off-home link traced beside it.

**⚠️ THE FOOTER BREAKS EXISTING E2E SELECTORS, AND THE FAILURES READ AS
THE OPPOSITE OF WHAT THEY ARE.** Three fell out of the first full E2E
run, and only the first was predictable from the diff:

| spec | what broke | fix |
| --- | --- | --- |
| `navigation.spec.js` ×3 | `a[href="#about"]` now matches **2** elements — the footer repeats all six in-page anchors — so the strict locator throws, reading as "the navbar link disappeared" | scoped to `header` |
| `homepage.spec.js` | `getByText('Open to opportunities')` went from **1** match to **13**: the badge plus the marquee's twelve repeats. ⚠️ The band is `aria-hidden` and it did not help — `getByText` ignores `aria-hidden`, only `getByRole` respects it | scoped to `#hero` |
| `navigation.spec.js:78` | measured `#projects`'s `top` **once** after a fixed 1500ms wait; read **-355px** under full-suite load and 70.8 when run alone. Pre-existing, not caused here — but PF-88's taller footer makes the page slower to settle | `expect.poll` |

⚠️ **The `expect.poll` fix was itself wrong on the first attempt, in a way
worth recognising.** It polled `top > 69` and then took a SEPARATE
reading for `< 73`. The failure state is an **unscrolled** page, where
`top` is ~2664 — which satisfies `> 69` instantly, so the poll returned
on its first tick and the second assertion ate the failure. **Polling a
predicate that the failure state also satisfies is a vacuous poll**, the
same class of mistake as a vacuous assertion, and it looks like a
correctly-hardened test. The poll has to cover the whole condition:
`.poll(() => Math.round(top)).toBe(71)`.

Traced in isolation five times to confirm the underlying behaviour is
sound before hardening the test rather than the code — `694→2258→2558→
2596` scrollY over ~1s, settling at `top: 71` on every run:

```
RUN1  694/1973  2258/409  2558/109  2596/71  2596/71 …
RUN2  900/1767  2292/375  2565/102  2596/71  2596/71 …
```

The `the home page still uses bare hashes` regression test was extended
to assert the duplicate COUNT is 2, so the header-scoping's reason is
visible rather than looking like over-caution to the next reader who
might remove it.

**Six things worth knowing before touching the section:**

- **⚠️ THE MARQUEE STRIP IS NOT `rgba(252,163,17,.5)`, AND THE MARKUP
  ALONE WILL NOT TELL YOU.** `applyTheme()` (prototype line 867) rewrites
  every `[data-strip]` to `color: var(--acc)` with `opacity: .95` light /
  `.5` dark. In dark those are the same painted colour, which is exactly
  why reading the inline style looks complete; in **light** `--acc` is
  `#7E4800`, so the markup value would ship dark theme's amber onto light
  paper. Ported as a theme-scoped CSS rule. Measured: dark
  `rgb(252,163,17) @0.5`, light `rgb(126,72,0) @0.95`.
- **⚠️ SAME FOR `[data-ok]`, AND HERE IT IS AN ACCESSIBILITY FIX THE
  DESIGN ALREADY MADE.** Line 868 recolours every `[data-ok]` to
  `#0E7A55` in light and `#34d399` in dark. The PF-88 ticket predicted a
  light-theme contrast failure on `#34d399` and told us to report it —
  the prototype's own script block is the answer, and transcribing the
  markup alone would have shipped the failure. **This is the third time a
  prototype element's real behaviour lived in the script block rather
  than its `style` attribute** (`data-cardbg` in PF-85, `data-cv` in
  PF-87). Grep the script for the element's own attribute; do not read
  the markup and stop.
- **The section wash comes out** — `linear-gradient(180deg,
  rgba(var(--gnd),.4), rgba(var(--ftr),.86))`, line 543 — under the
  2026-08-18 site-wide decision, and after PF-87's glow removal it would
  have been the only banded surface left on the page. Guarded as an
  absence. **Two backgrounds here are NOT washes and stay**: the marquee
  band's `rgba(252,163,17,.06)` (a designed band element) and the STATUS
  card's `rgba(var(--srf),.5)` (a card surface, explicitly untouched by
  that decision). Both guarded as presences, so over-deleting fails too.
- **The footer logo takes `alt=""`.** The prototype's is
  `alt="Parindra Gallage"`; this is the **fourth** element that would
  otherwise carry that string, and it gets PF-83's splash-logo answer —
  the name and role render as real text beside it and it is not a link.
- **Everything hoverable here SNAPS, and that is transcription rather
  than the PF-93 rule.** `data-reveal` sits on the four COLUMN wrappers,
  so the links, buttons and CTA inside them are not reveal targets:
  `hideReveals()` never writes an inline transition over them and the
  prototype declares none of their own. Measured, all four at
  `transition-duration: 0s`. PF-93's scanner catches the wrapped case
  automatically; it **cannot** catch a missing transition on an unwrapped
  element, so that direction has its own named guard.
- **`Marquee` (PF-74) was reusable with one addition, not a rewrite.** It
  hard-codes no type scale — the hero's 2026-08-17 slimming lives in
  `HeroSection.module.css` — so the footer's band needed only its own
  module class. The one change it did need is the `copies` prop; see
  Locked decisions.

**Live verification, measured in Chromium against the production build**,
served from `dist-verify/` behind a same-origin proxy:

| Check | Result |
| --- | --- |
| footer `background-image` / `-color`, both themes | `none` / `rgba(0,0,0,0)` |
| footer `position` / `overflow` / `padding` | `relative` / `hidden` / `0px 0px 26px` |
| marquee band | bg `rgba(252,163,17,.06)`, 2 accent borders, `padding 10px 0`, `aria-hidden` |
| STATUS card | `rgba(20,33,61,.5)`, `padding 20px`, `radius 18px` |
| track animation | `getAnimations()` → **1 running**, name `marq`, **15000ms** |
| strip type | Anton, **26px**, uppercase, `padding-right 30px` — **not** the hero's slimmed 21px/24px |
| both strips end in | `charCodeAt` **160** (U+00A0) |
| `[data-strip]` | dark `rgb(252,163,17) @.5` · light `rgb(126,72,0) @.95` |
| `[data-ok]` ×2 | dark `rgb(52,211,153)` · light `rgb(14,122,85)` |
| inner | `max-width 1240px`, `padding 64px 40px 0` |
| grid | `repeat(auto-fit, …)` → 4 × 255.5px, `gap 46px`, `align-items: start` |
| reveal delays | `0s · .08s · .14s · .2s`, all four `data-type="up"` |
| reveal transitions | all four inherit `.reveal`'s `opacity .85s / transform 1.05s` |
| logo | 52×52, `radius 50%`, `object-fit: cover`, accent border, 26px glow, **`alt=""`** |
| bottom bar | `1fr auto 1fr`, 3 children, `margin-top 56px`, `padding-top 22px` |
| links from `/`, `/blog`, `/blog/:slug`, 404 | bare hashes on `/`, `/?nosplash=1#…` on all three others |
| `Projects` clicked from a 404 | lands `#projects` at **71px**, no splash replay |
| 375px | no horizontal overflow (375 vs 375), bar 3 columns, **zero overlapping pairs**, nothing escaping the footer box |

**⚠️ TWO AA FAILURES, REPORTED NOT FIXED** — measured against each node's
composited backdrop, both themes. They batch into PF-91 per the PF-83
stat-label precedent:

| node | dark | light |
| --- | --- | --- |
| **copyright** (`--faint`, 10.5px) | **3.56** ✗ | 4.97 ✅ |
| **AVAILABLE FOR WORK** (`#34d399`/`#0E7A55`, 10.5px) | 9.87 ✅ | **4.23** ✗ |
| role line + bio (`--muted2`, 10 / 13.5px) | 4.55 ✅ | 5.45 ✅ |
| column heading (`--acc`) | 10.02 ✅ | 6.12 ✅ |
| nav link · status lines · replay (`--muted`) | 7.68 / 7.00 / 7.68 ✅ | 6.35 / 6.94 / 6.35 ✅ |
| CTA ink on accent | 9.79 ✅ | 7.46 ✅ |

Three things about that table:

1. **`--faint` fails DARK**, which is the same token and the same
   direction as the terminal panel's `➜` line (3.33 dark / 3.12 light).
   Two open `--faint` findings now, and they want one decision.
2. **The green badge fails LIGHT at 4.23 even after the prototype's own
   `#0E7A55` fix** — close, but 10.5px is small text and AA wants 4.5.
   Worth knowing that the design already moved this once and did not
   quite land it; the untreated `#34d399` measured **1.72** on Contact's
   light form surface in PF-87.
3. **⚠️ `--muted2` PASSES here, at 4.55 dark**, which is the opposite of
   what the ticket predicted ("the fifth occurrence of that token").
   Same reason Contact's location line passed: these sit on the page
   ground rather than on a translucent card. The trap is the surface, not
   the token.

### PF-88 revisions — owner-requested, 2026-08-25

Eleven changes across four passes in one session, all asked for directly
after seeing the footer live. Recorded here because **seven of them
reverse or delete work PF-88 had just shipped**, and a fidelity pass that
cannot find them here will put every one of them back.

⚠️ **Several passes contradict earlier passes in the same session.** Where
that happens both halves are kept below, because the reasoning is the
useful part — the marquee band was told to copy the hero exactly, then
told to drop the hero's defining feature.

```
frontend/src/
  components/layout/
    Footer.jsx  + .module.css        band, grid, bottom bar, links
    ScrollToTop.jsx + .module.css    NEW module css; Phase 1 inline styles gone
    __tests__/ScrollToTop.test.jsx   NEW  10 cases
    __tests__/Footer.test.jsx        replay cases → absence + layout guards
  components/motion/
    __tests__/Marquee.test.jsx       + a duration guard  (9 → 10)
  components/sections/
    HeroSection.jsx                  duration 26 → 40
    ContactSection.jsx               LinkedIn URL
  pages/HomePage.jsx                 replayCount + keyed subtree REMOVED
  providers/SplashProvider.jsx       resetKey REMOVED
  App.jsx                            replay state REMOVED
  utils/replay.js                    DELETED  (+ its 5 tests)
backend/src/
  seed.js · models/About.js          LinkedIn URL
frontend/e2e/footer.spec.js          replay tests → band + zone + absence tests
```

**1. REPLAY INTRO is gone, and so is the machinery behind it.**
*"remove the replay intro button no one want to replay that splash when
in the website."* The button was most of PF-88; removing it orphaned
`utils/replay.js`, `SplashProvider`'s `resetKey`, `HomePage`'s
`replayCount` prop and its keyed reveal subtree, and `App.jsx`'s counter.
**All deleted rather than left in place** — a module whose last consumer
disappears keeps its own tests passing forever, the `useTypewriter` shape
this file documents at length. `HomePage.jsx` and `SplashProvider.jsx`
are back to their pre-PF-88 shape.

⚠️ **`ScrollToHash`'s per-navigation guard STAYS.** PF-88 added it because
replay toggled the readiness gate mid-session; nothing toggles it now, so
it never fires in production. Kept because it is *executed* code rather
than dead code — it records the navigation key on every hash scroll — and
because `setReady` is still exposed through `useSplashControls()`, so the
hazard returns the moment anything closes the gate again.

**2. SCROLL BACK UP is gone**, redundant with `ScrollToTop`. With both
outer cells removed the prototype's `1fr auto 1fr` bottom bar **loses its
grid entirely** rather than keeping two empty columns around a lone
centred line — `text-align: center` on a block does the same job without
an inert declaration the next reader treats as load-bearing.

**3. The copyright gained ALL RIGHTS RESERVED**, mid-line:
`© 2026 PARINDRA GALLAGE · ALL RIGHTS RESERVED · DESIGNED & BUILT FROM
SCRATCH`. ⚠️ That took it to **78 characters**, and the `max-width: 60ch`
first written for it wrapped it onto two lines at 1440px where there is
room for one — `ch` counts the glyph advance and ignores the line's
`.14em` letter-spacing, so 60ch is ~466px against a rendered ~606px. No
cap now. Measured one line down to 768px, two at 600–375, three at 320,
centred at every width.

**4. ⚠️ THE FOOTER BAND IS THE HERO'S — MINUS THE HERO'S DEFINING
FEATURE. Two passes, and the second reverses part of the first.**

*Pass 1: "exactly like the top one … reduce the speed and features
exactly like the above one."* This **reversed PF-88's own guard**, which
asserted the hero's 2026-08-17 slimming had NOT leaked into the footer.
It is now required to have.

*Pass 2: "the banner shows the end of the web page and start of the
footer so it should be full 100% horizontal and fit to footer."* So the
tilt does **not** come across.

| | prototype footer (line 544) | hero | shipped |
| --- | --- | --- | --- |
| ground | `rgba(252,163,17,.06)` + borders | solid `var(--acc)` | **solid `var(--acc)`** |
| text | `var(--acc)` @ .5 | `var(--accInk)` | **`var(--accInk)`** |
| size | `clamp(16px,2vw,26px)` | `clamp(13px,1.6vw,21px)` | **the hero's** |
| gap | 30px | 24px | **24px** |
| padding | 10px 0 | 8px 0 | **8px 0** |
| tilt | none | `rotate(-1.1deg) scale(1.03)` | **NONE — pass 2** |
| duration | 15s | 26s | **40s — see 5** |

The hero's band is a torn strip laid over the page; this one is a level
rule marking where the page ends and the footer begins. Measured: 0px gap
above it, width exactly the viewport, `transform: none`.

⚠️ **`.marqueeWrap` went with the tilt.** It existed ONLY to clear the
rotation the footer's `overflow: hidden` would otherwise cut —
`max(22px, 1.5vw)`, sized against a rise of `(bandWidth / 2) ×
sin(1.1deg)` = **0.99vw, proportional, not constant**. A flat 22px had
measured clear at 1440px, 2px at 1920px and **clipping by 4px at 2560px**
before the vw term was added. All moot now; do not reintroduce the
wrapper without the tilt.

⚠️ **This also retires the `[data-strip]` theme rule** the prototype
drives from `applyTheme()` line 867. It has nothing to act on — the text
is ink-on-accent and `--accInk` already flips. Measured: dark
`rgb(10,10,10)` on `rgb(252,163,17)`, light `rgb(255,255,255)` on
`rgb(126,72,0)`.

⚠️ **`copies` went UP, 12 → 16, and the direction is counter-intuitive.**
Dropping to the hero's smaller type shrank one copy from ~600px to
~485px, which *raises* the count `copies ≥ 2 × band / copy` demands. 16
covers a band to ~3880px where 12 covered ~2900px.

**5. Both bands slowed to 40s.** *"the top banner and the footer banner
strips reduce the speed of the text."* The prototype runs the footer at
15s and the hero at 26s; the footer was matched to 26 in pass 1 and then
**both** went to 40. ⚠️ `duration={40}` is a **literal** in both call
sites, not a shared constant — `Marquee.test.jsx` pins the two together
by reading `duration={n}` out of each file as source, and a named import
would slip past that regex while looking tidier.

**6. ⚠️ THE FOOTER IS THREE ZONES AND FULL-BLEED, not four equal columns
in a 1240px column.** *"the logo and the description and the available
for work capsule should be more left and navigate and elsewhere section
should be in the middle with a acceptable gap and status section (card)
should be more right."*

- `.grid` is `minmax(0, 1fr) auto minmax(0, 1fr)`, not the prototype's
  `repeat(auto-fit, minmax(min(100%,210px), 1fr))`. `minmax(0, …)` rather
  than `auto` on the outer tracks: an `auto` track is content-sized, so
  the centre pair would drift off centre whenever the identity text
  wrapped differently from the status card.
- NAVIGATE and ELSEWHERE are wrapped in `.linkGroup` with a **wider** gap
  than the grid's — at the grid's gap they read as two more equal
  columns. The wrapper is a plain div; each column keeps its own `Reveal`
  and its own stagger delay.
- **`.inner` lost `max-width: 1240px`.** Within it the four columns
  already spanned edge to edge, so there was no slack to redistribute —
  the only way further out is to drop the cap. This puts the footer logo
  at exactly the same x as the **header** logo, which went full-bleed on
  2026-08-22 for the same reason; the two were 100px apart at 1440px
  until now. Measured: both at 40px, at every width.
  ⚠️ **Accepted consequence, identical to the header's:** above ~1320px
  the footer no longer aligns with section content. Restoring the cap to
  "fix" the alignment is the thing that was rejected.

⚠️ **AN EXPLICIT THREE-TRACK GRID DOES NOT STACK, and the prototype's did
it for free.** `auto-fit` drops a column when the tracks stop fitting;
three explicit tracks never do — they get narrower. Measured before the
breakpoint was added: zone widths went 323/217/320 at 1024px to
**116/191/50 at 375px, with the status card crushed to 50px and the outer
zones OVERLAPPING below 430px.** No scrollbar, nothing in the console.
`@media (max-width: 899px)` stacks to one column; 899 is where three
zones stop being comfortable, not where they break.

**7. The band sits 46px above the content, not 64px — settled in two
steps.** *"the footer banner should be very close to the text area …
bring down the banner strip"*, which took `.inner`'s top padding from the
prototype's `clamp(38px, 6vw, 64px)` to `clamp(18px, 2.2vw, 30px)`. That
**overshot**, and the follow-up asked for the content a bit further below
the band again: `clamp(26px, 3.4vw, 46px)`. Horizontal and bottom values
untouched. Measured band-bottom to identity-top: 46 · 46 · 35 · 26 · 26px
at 1920 → 375.

⚠️ The instruction that settled it — *"bring more a bit to below the
strip banner"* — reads two opposite ways (more space, or more of the
tightening just applied) and was **asked rather than guessed**, because
the two readings move the band in opposite directions.

**8. `ScrollToTop` is on the Phase 2 token set, and glows.** *"go up to
top button according to the theme"*, then *"looking like hiding so add
glowing effect or something like that to recognise."*

It was Phase 1's, styled with **inline** Phase 1 tokens — `--bg-elevated`,
`--border-bright`, `--accent`, `--accent-glow`. Those live in
`global.css`'s `:root`, a **single dark palette that never flips** (the
same fact behind the Phase 1 light-theme bridge), so in light theme the
button floated dark surfaces and Phase 1's indigo `#818cf8` over warm
paper. Nothing errored. Measured after: dark `rgba(20,33,61,.82)` /
`rgb(252,163,17)`, light `rgba(254,252,248,.82)` / `rgb(126,72,0)`.

⚠️ **The prototype has NO such control**, so the treatment is borrowed
from `ThemeToggle`, the nearest Phase 2 precedent for a small round icon
button: 44×44, accent ink, accent border, a theme-scoped glow.

**9. ⚠️ THE HOVER FILLED THE BUTTON AND THE ARROW VANISHED — a
specificity tie, and the seventh in this project.** The first version
inverted to a solid accent disc with `--accInk` ink. On screen it was a
featureless amber circle with no arrow. Two causes, and only the first is
visible in a screenshot:

| | |
| --- | --- |
| the fill is too loud | a control that already glows reads as a *different element appearing* rather than the same one responding |
| **the ink never applied** | `:global(html[data-theme='dark']) .button` is **(0,2,1)** — element + attribute + class — while `.button:hover` is **(0,2,0)**. The theme rule won *while hovered*, so `color` stayed `var(--acc)`: amber ink on an amber fill |

**The rule that fixes it: every colour a hover changes must be declared
inside the same theme block**, where it lands at (0,3,1) and beats that
theme's own rest rule outright rather than racing it. The base `:hover`
carries `transform` only — a property no theme rule sets, so it cannot
lose. Hover now intensifies rather than inverts: brighter glow, full
accent border, a light accent wash, the lift. Measured arrow-vs-its-own-
hover-ground: **7.92:1 dark, 5.29:1 light.**

⚠️ **The glow is theme-scoped and that is the whole of it.** `--acc` is
amber in dark and **brown `#7E4800`** in light, so one unscoped
`box-shadow: 0 0 18px var(--acc)` paints a brown smudge on light paper —
valid CSS, no error, reads as a rendering artefact. Light gets a firmer
shadow instead of a glow, because a glow needs something darker than
itself to bloom against.

**10. The entrance moved to `kf-riseIn` with NO fill-mode.** Phase 1 used
`animation: fadeInUp .3s ease both` inline; `both` keeps a *finished*
animation in `getAnimations()` for the life of the page — the single
entry PF-83's reduced-motion audit had to explain away ("total is 1 in
both modes, running is 0"). **That footnote is now obsolete; the total is
0.**

**11. The LinkedIn URL was wrong everywhere: `gallege` → `gallage`.**
Five files — `ContactSection.jsx`, its test, `Footer.jsx`,
`backend/src/seed.js`, `backend/src/models/About.js`. ⚠️ **The live
database still holds the old URL** — see Outstanding work.

**The gate after all eleven:** frontend **627 / 627** (42 files) · lint
**exit 0** · build **220 modules**, 64.90 kB CSS / 411.69 kB JS · backend
**242 / 242** · E2E **37 / 37**.

**40 mutations across the session's new guards. Three found real gaps**,
all closed:

| mutation | what it exposed |
| --- | --- |
| band `duration` 40 → 26 | the two bands were pinned to nothing; now they are read from each other's source |
| `ScrollToTop` reverting to Phase 1 tokens | the component had **no test at all**; now 10 cases |
| unscoping the dark glow | the theme-scoping had no guard — the exact brown-smudge trap this file documents |

⚠️ **Two mutations *reported* clean and were invalid**, both worth
recognising because the failure shape is identical to a passing test:
`copies={16}` → `{12}` and `alt=""` → the prototype's alt both edited a
**comment** rather than the code, because the doc comments name those
values. The tests strip comments and were right; the mutation script was
wrong. Same trap this file documents, one level out — **mutate the code,
then confirm the file actually changed.**

### Link icons, the live dot, slower bands and a de-misted hero — owner-requested, 2026-08-29

Six changes in one pass, all asked for directly. **Five of the six are
additions or overrides the prototype does not have**, so every one is a
sanctioned deviation and this section is the only record a fidelity pass
will find. The sixth (the marquee slowdown) moves a value the owner had
already set twice.

```
frontend/src/
  components/icons/                     NEW  BrandIcons.jsx + index.js barrel
  test/leadsWithIcon.js                 NEW  shared assertion — see the trap below
  components/sections/
    AboutSection.jsx                    + MailIcon on EMAIL ME
    ProjectsSection.jsx                 + GitHubIcon, + the live dot
    ProjectsSection.module.css          + .liveDot
    ContactSection.jsx                  + Mail / GitHub / LinkedIn marks
    ContactSection.module.css           .socialLink -> inline-flex row
    HeroSection.jsx                     marquee duration 60 -> 84
    HeroSection.module.css              .blobC z-index 4 -> 2
  components/layout/
    Footer.jsx                          + Icon on all 5 ELSEWHERE rows; 50.5 -> 70.7
    Footer.module.css                   .link -> flex row at every width
  styles/
    keyframes/base.css                  + @keyframes dot-ok  (the 33rd)
    animations.css                      + .kf-dot-ok carrier
    __tests__/keyframes.test.js         BASE/VARIANTS + a new ADDITIONS list
  components/*/__tests__/               + 7 guards, all mutation-tested
frontend/e2e/footer.spec.js             band duration 50500 -> 70700
```

**1 — Brand marks on nine links.** About's `EMAIL ME`, Projects'
`VIEW ON GITHUB`, Contact's email / `GITHUB` / `LINKEDIN`, and all five
footer ELSEWHERE rows. Official marks for GitHub, LinkedIn, Facebook and
Instagram; Material Design's `email` envelope for the three `mailto:`
links.

- **⚠️ `public/icons.svg` EXISTS AND IS UNUSABLE — do not "reuse" it.**
  It has zero consumers (checked) and every path in it is a hardcoded
  `fill="#08060d"` or `stroke="#aa3bff"`, so a symbol would stay
  near-black on a near-black dark theme and would not follow a link's
  hover colour. Inline SVG with `currentColor` is the repo's own
  precedent (`ThemeToggle.jsx`), and it is what these follow. Measured:
  icon `fill` equals its link's computed `color` exactly, both themes.
- **Every icon is `aria-hidden`.** Each sits beside a label that already
  names the destination, so an exposed `<svg>` would give the link a
  second accessible name — and every `getByRole('link', { name })`
  lookup in the existing tests would stop resolving, which reads as "the
  link disappeared". Same call PF-83 made for the splash and footer
  logos.
- **The trailing `→` / `↗` characters STAY.** The mark was added *to*
  the label, not instead of its arrow. Trimming them to balance the row
  would be an unrequested transcription change; guarded.
- Two CSS changes only: Contact's `.socialLink` gained the inline-flex
  trio its two siblings already declared, and the footer's `.link`
  became a flex row at every width (it was already one below 899px, and
  those two duplicate declarations were removed from the media query
  rather than left inert). `.ctaSecondary`, `.emailLink` and
  `.githubLink` were already inline-flex rows with a gap and needed
  nothing.

**2 — A pulsing green dot on LIVE SITE**, so a deployed project reads as
live at a glance. Fill is `var(--ok)` — measured `rgb(52,211,153)` dark
/ `rgb(11,100,70)` light, i.e. it flips and inherits PF-91's contrast
work. **8.31:1 dark / 7.01:1 light** against the card, well past the
3:1 a non-text indicator needs.

**⚠️ THIS ADDED THE 33rd KEYFRAME, THE ONLY ONE THE PROTOTYPE DOES NOT
HAVE.** `@keyframes dot-ok` in `base.css`, plus a `.kf-dot-ok` carrier.
It could not reuse `dot`: that keyframe writes `rgba(252,163,17,...)`
into its own `box-shadow`, and **a rule cannot override a colour an
animation is writing**. Green is a literal `52,211,153` in both themes
exactly as `dot` uses literal amber in both; only the dot's fill flips,
because a glow needs to be lighter than what it blooms against and light
theme's `#0B6446` glowing would paint a dark smudge — the ScrollToTop
trap.

⚠️ **`keyframes.test.js` now carries THREE lists, not two.** `ADDITIONS`
is separate from `BASE` so the 32-count assertion keeps meaning what it
meant: `BASE + VARIANTS` is still exactly the design's set and is still
asserted as such, and anything defined outside all three lists fails.
Folding `dot-ok` into `BASE` would have let the next addition hide
inside a number nobody reads.

⚠️ **`.liveDot` declares a resting `box-shadow` as well as the
animation, and that is load-bearing under reduced motion.** `motion.css`
collapses every animation to 0.01ms with one iteration, and `dot-ok`
carries **no fill-mode** — deliberately, because `fill-mode: both` keeps
a finished animation in `getAnimations()` for the life of the page (the
`ScrollToTop` finding). So once it finishes the element falls back to
the static declaration. Measured under reduce: **0 animations** and the
glow still present at `rgba(52,211,153,.65) 0 0 6px 1px`. The dot still
says "live" for anyone who asked for no motion.

**3 — Both marquee bands slowed to 50 px/s**, from the 70 px/s the owner
set on 2026-08-27. The equal-SPEED contract is what makes the numbers
un-round:

| band | copies | copyW | distance | duration | px/s |
| --- | --- | --- | --- | --- | --- |
| hero | 8 | 1050.6 | 4202.2px | **84s** (was 60) | 50.03 |
| footer | 18 | 392.9 | 3536.4px | **70.7s** (was 50.5) | 50.02 |

Measured in the browser: `getAnimations()` reports **84000ms** and
**70700ms**. Copies are unchanged, so seamlessness is unaffected —
duration does not enter `copies >= 2 x band / copy`. `Marquee.test.jsx`
pins both numbers, re-derives both px/s, and now also asserts neither is
50.5 or 60, so the superseded pair cannot come back silently.
`e2e/footer.spec.js` pinned 50500 and went red on the first run — the
guard working, exactly as it did on 2026-08-27.

**4 — ⚠️ THE HERO PORTRAIT'S "MIST" WAS `.blobC`, AND THE OWNER'S OWN
GUESS ("image animation, I think") WAS RIGHT ABOUT THE MECHANISM.**

Reported as *"it seems like a mist or blurry thing in front of the
image; it should be always clear and perfect"*. `.blobC` is a
`blur(9px)` pale-blue radial haze that drifts on a 19s loop, and the
prototype puts it at **z-index 4** — above `.portraitFrame`'s 3, the
only one of the four blobs above the picture. CLAUDE.md's own PF-80
entry records that as intentional depth, so this overrides the design on
the owner's direct instruction.

**Moved to z-index 2, NOT deleted**, and the distinction is the point:
the request is about the portrait being clear, not about losing a blob.
It keeps its size, position, gradient, blur, 19s duration and 1.5s delay
and still drifts — behind the frame with its three siblings. Deleting it
would have satisfied "the image is clear" while quietly reducing the
design by a quarter of its ambient cluster, which is the over-deletion
trap `.scanTexture` and `.portraitFade` already record.

**Verified by HIT-TEST, not by screenshot**, per the clipped-vs-occluded
entry — a box measurement cannot see what is painted on top:

| | before | after |
| --- | --- | --- |
| 25 sample points over the portrait | blobC over the image | **24/25 return the IMAGE itself** |
| the 25th | — | a floating chip (`kf-flt-portfolio`) — deliberate content |
| all four blobs' computed `z-index` | 2 · 2 · **4** · 2 | **2 · 2 · 2 · 2** |

Same in both themes.

⚠️ **THE OTHER CANDIDATE WAS RULED OUT, NOT MISSED.** `.portraitImg`'s
two-layer `mask-image` also softens the picture, and it is the other
thing that could be called "misty". It was NOT changed: it is static and
at the EDGES, where the report was of something animated and *in front*
— and it is itself an owner-approved deviation from 2026-08-17. If the
edge fade is ever what is meant, that mask is the lever, and both radii
must stay at 50% (see the PF-80 entry for why over-50% reintroduces a
hard rim).

**⚠️ A NEW SILENT-FAILURE CLASS, FOUND BY MUTATION IN THIS PASS:
`link.firstElementChild === svg` DOES NOT TEST ORDERING.** Full entry in
Silent failures. Four guards were written that way, and moving the icon
*behind* its label left every one of them green — the label is a TEXT
node, which `firstElementChild` skips by definition. `test/leadsWithIcon.js`
is the fix and is now shared by all four files.

**Guards: 8 new tests, 11 mutations, all caught** once the two invalid
ones were redone:

| mutation | caught by |
| --- | --- |
| drop the About / Projects / Contact / Footer icon | its own presence guard |
| icon moved AFTER the label (×4) | `leadsWithIcon` — **and NOT by the first version** |
| Instagram reuses Facebook's mark | the footer's distinct-path-data check |
| Contact's LinkedIn reuses GitHub's mark | the same check in Contact |
| an icon leaks into the footer's NAVIGATE column | the counterweight assertion |
| `.blobC` back to z-index 4 | the blob stacking guard |
| `.blobC` deleted rather than moved | the same guard's "still four" half |
| terminal `.lineSuccess` onto `var(--ok)` | the narrowed PF-91 guard |
| `.liveDot` off `var(--ok)` onto a literal | its new counterweight |
| band duration reverted to 50.5 / 60 | `Marquee.test.jsx` |

⚠️ **PF-91's Group C/D guard had to be NARROWED, and the narrowing is a
correction rather than a weakening.** It walked the whole
`ProjectsSection.module.css` for `var(--ok)`, which the new `.liveDot`
trips. But the rule PF-91 settled is about a **surface**, not a file:
`--ok` flips and the terminal panel deliberately does not, so the token
is wrong there and right on the LIVE SITE link, which is ordinary themed
page surface. A whole-module walk conflated the two and would have
pushed the live dot onto a hardcoded literal — reintroducing exactly the
four-hardcoded-sites problem PF-91 removed. It is now scoped to the
terminal's own selectors, **asserts it matched more than 10 rules** (a
selector list that stops matching reports "no offenders" in the same
words as a clean panel), and has a counterweight test requiring
`.liveDot` to keep the token.

⚠️ **One invalid mutation reported clean and had to be redone** — the
"mutate the code, then confirm the file actually changed" trap, which
this file already records from the PF-88 revisions. A `perl -0pi` regex
did not match, so the run measured nothing. And separately, restoring a
mutated file with `git checkout` rather than from a backup copy silently
reverted a *real* edit in the same file — the hero's new marquee
duration. The full suite caught it. **Restore from a copy, never from
the index, while unstaged work is in the tree.**

**The gate:** frontend **691 / 691** (44 files) · lint **exit 0** ·
build **220 modules**, 67.76 kB CSS / 415.84 kB JS · E2E **38 / 38** ·
backend **242 / 242**.

⚠️ The E2E run printed **429**s from the rate limiter again — the
documented artefact of the suite's own repeated page loads. All 38
passed; no spec depends on that data.

### Built by PF-94 — the gate found a defect rather than confirming the work (2026-08-29)

```
frontend/src/
  components/layout/ScrollToHash.jsx          scroll ONCE -> quiescence poll
  components/layout/__tests__/ScrollToHash.test.jsx   11 -> 15 tests, + providers
  pages/__tests__/HomePage.test.jsx           + QueryClientProvider
frontend/e2e/navigation.spec.js               + 2 specs (38 -> 40)
frontend/eslint.config.js                     + playwright-report/, test-results/
```

**⚠️ THIS WAS FOUND BY PF-92's STEP 3, NOT BY A BUG REPORT**, and it is
the argument for that step existing. The checklist item is "all
navigation works from `/`, from a 404 URL, and lands at 71px". From `/`
everything landed at 71. From a 404, **`#blog` and `#contact` landed at
186px** — a 115px overshoot, stable through 8 seconds, on every run.

**The cause, measured on the production build rather than reasoned:**

| t | `#projects` height | `#blog` absolute pos | scrollY |
| --- | --- | --- | --- |
| 95ms | **1150** | 3933 | 0 — the scroll starts here |
| 693ms | **1264** | **4048** | 3636 — the scroll already finished |

Projects' loading placeholder is **~114px shorter** than its real
content, so everything below it drops when the query resolves.
`ScrollToHash` scrolled once, one rAF after the route commit, against
the placeholder layout, and nothing re-ran it. Only `#blog` and
`#contact` are affected — `#about`, `#skills` and `#projects` sit at or
above the shift.

Proven three ways before any code changed: cold 404 arrival **186**;
second click on the now-loaded page **71**; the same cold arrival with
the API stubbed to respond instantly **71**.

**Reach: two clicks from the home page.** PF-86 pointed five Blog-teaser
links at `/blog`, which has no route, so every navbar and footer link
from a 404 or `/blog` hit it.

**⚠️ NOTHING COVERED IT, AND THE COVERAGE LOOKED COMPLETE.** Both
pre-existing off-home specs — `navigation.spec.js:78` and
`footer.spec.js:38` — measure **`#projects`**, the last section ABOVE
the shifting grids. That is the one case that cannot fail. This is the
PF-84 shape in a new costume: green, and not testing the thing.

**The fix is a quiescence poll, not a timeout.** The loop stops when
three things hold together for two consecutive frames:
`useIsFetching() === 0` (covers the error path too — a failed query also
stops fetching), the target's document-absolute position unchanged, and
`scrollY` unchanged. A fixed delay would be a guess at the network, which
is the code-side of this file's own "a positional assertion after a fixed
wait is a timer, not a measurement".

Four things about it are load-bearing:

- **⚠️ IT RE-SCROLLS ON MOVEMENT, NOT ON BEING OFF-TARGET.** During a
  smooth scroll the target is off-target on every intermediate frame, so
  an off-target trigger re-issues `scrollIntoView()` each frame, restarts
  the animation from wherever it reached, and converges slowly or not at
  all. Movement-triggered means a page that never shifts is scrolled
  **exactly once** — which is also what satisfies "no double-scroll when
  the API is instant".
- **⚠️ THE POLL BASELINE LIVES IN A REF, NOT A LOCAL.** `isFetching` is a
  dependency, so the effect tears down and re-runs several times per
  navigation. A local baseline resets to `null` on each restart, and a
  null baseline means "first frame" — so every restart re-issued a
  redundant scroll mid-animation. Caught by the unit test as 2 calls
  where 1 was correct.
- **Position polling, NOT a ResizeObserver.** The observer answers "did
  something change SIZE"; what breaks the landing is the target changing
  POSITION. They differ whenever a sibling above grows while another
  shrinks equally — the document height never changes and the observer
  never fires, yet the target has moved.
- **A `done` flag is checked at the top of every frame**, not only
  `cancelAnimationFrame`. A cancelled frame is not guaranteed not to run,
  and a frame that runs after the user has taken over is exactly the yank
  this must not produce.

**The user outranks the anchor.** `wheel`/`touchstart`/`keydown` release
the loop permanently for that navigation. ⚠️ Deliberately NOT `scroll` —
the smooth scroll this component starts fires `scroll` every frame, so a
scroll listener would cancel the very fix it protects.

**PF-88's per-navigation guard survives unchanged in purpose**:
`settledForKey` is now set when the page comes to rest or the user takes
over, rather than after the single scroll.

**Verified on the production build**, all ten cells at **71px** (two were
186):

| from | about | skills | projects | blog | contact |
| --- | --- | --- | --- | --- | --- |
| `/` | 71 | 71 | 71 | 71 | 71 |
| a 404 | 71 | 71 | 71 | **71** | **71** |

Plus the three required conditions and two regressions: API instant/cached
**71** with a single uninterrupted scroll; API returning 500 on everything
**71** (shorter page, error states rendering); reduced motion **71**,
`data-motion=reduced`, 0 running animations against a 79 control; and a
splash-gated cold load of `/#blog` held at scrollY 0 mid-splash then landed
71, so PF-88's gate is intact.

**⚠️ `ScrollToHash` NOW REQUIRES A `QueryClientProvider`.** It always had
one in the app (`main.jsx` wraps `<App />`), but `ScrollToHash.test.jsx`
and `HomePage.test.jsx` rendered it bare. Both now wrap it. A bare render
throws "No QueryClient set", which reads like a data-layer bug and is not
one — the same shape as the `MemoryRouter` requirement added 2026-08-22.

**⚠️ `flushRaf` in the test harness had to become a DRAIN.** The component
no longer scrolls once; it re-schedules until quiescent, so a one-shot
flush leaves the loop suspended mid-poll and `settledForKey` never set.
Every "does not re-scroll" assertion in that file depends on the settle
having actually happened, and would report a **false PASS** against a
component that merely stalled.

**Mutation-tested, all caught by exactly the intended test:** drop
`isFetching === 0` from the settle condition; re-scroll every frame;
remove the release listeners; and the whole pre-PF-94 component, which
fails the two tests describing the defect and nothing else.

### PF-92 — the Sprint 12 gate

**Run fresh, not aggregated from the ticket reports**, per the ticket's own
instruction and PF-84's precedent.

| Check | Result |
| --- | --- |
| Frontend (`npm test`) | **695 / 695**, 44 files |
| Lint (`npm run lint -- --max-warnings=0`) | **exit 0**, 125 files |
| Build (`npm run build`) | **222 modules**, 67.76 kB CSS / 416.90 kB JS (gzip 129.78) |
| Backend (`npm test`) | **242 / 242**, 22 suites — none of the four failure shapes |
| E2E (`npm run test:e2e`) | **40 / 40**, 0 flaky |
| Commits ahead of `origin/master` | **22** |
| Diff vs `origin/master` | 87 files, +16,913 / −1,652 |

**⚠️ THE FIRST UNPROXIED PRODUCTION VERIFICATION IN THIS PROJECT'S
HISTORY.** Every live check before this ran through a same-origin proxy
because `.env.production` pointed at a Railway host that never existed.

| Check | Result |
| --- | --- |
| All four API calls | **200**, real content, no CORS errors |
| Skills LANGUAGES order | `JavaScript → Python → HTML5 → CSS3 → Java` — **Java last** |
| Contact form vs deployed backend | **201**, success state, fields cleared |
| Résumé link | inert empty state, `hasResume: false` live |

**⚠️ `npm run preview` SERVES ON 4173, WHICH THE PRODUCTION BACKEND WILL
NEVER ALLOW.** The ticket's Step 4 says to run `npm run build && npm run
preview` and check for CORS errors; that fails every fetch, and it is
**not** a site defect. `corsOptions.js`'s `ALLOWED_ORIGINS` is exact-match
on 5173 / 5174 / the Vercel URL, and the dev-port range is
non-production-only while the deployed backend runs `NODE_ENV=production`.
Measured per origin against the live API:

| origin | `access-control-allow-origin` |
| --- | --- |
| `http://localhost:4173` | **absent — blocked** |
| `http://localhost:5173` | returned — allowed |
| `https://my-portfoliofrontend-henna.vercel.app` | returned — allowed |

`localhost:5173` is exact-matched **before** the `NODE_ENV` gate, so
`npm run preview -- --port 5173` is the way to run this check. Amend the
ticket rather than widening the allowlist.

**⚠️ `.env.production` SHIPPED A TRAILING PERIOD.** `f0978ac` set
`VITE_API_URL=…/api.` — one character, baked into the bundle, and every
production fetch 404s (`/api./skills` → **404**, `/api/skills` → 200).
Fixed in `9f45897`. Worth recognising as a class: a wrong env value cannot
fail the build, cannot fail a test, and cannot fail lint — the only thing
that catches it is a real cross-origin request.

**⚠️ ONE PRODUCTION RECORD WAS WRITTEN BY THIS GATE.** The contact-form
check is a real POST to the live database, marked
`PF-92 GATE TEST (safe to delete)` and dated `2026-08-29T17:49:25Z`.
Delete it through the admin panel. Any future run of Step 4 writes another.

**Step 2's E2E audit.** Every spec's subject still exists and every locator
is still unique — checked against the live page, not read. The ones that
would have broken are already scoped: unscoped `getByText('Open to
opportunities')` matches **19** elements (the badge plus the hero band's
repeats) and the spec scopes to `#hero`; `a[href="#about"]` matches **2**
and the spec asserts exactly 2.

**Deployed state at the time of the gate:** the live bundle was
`index-BSS7WisO.js` — Sprint 11 — and is now **`index-Cz0l0KZq.js`**,
byte-identical to the local build containing PF-94. So Vercel has
deployed this branch's work **before the PR was opened or merged**. Step
6's "confirm the bundle hash changed" is therefore already satisfied, but
not by the route the ticket assumes; the rest of Step 6 has not been run
against it.

### Mobile pass — owner-requested, 2026-08-25

*"whole ui mobile optimization should be fine as butter."* An audit at
320 · 360 · 375 · 390 · 414 · 430 · 480 · 600 · 768px, then six fixes.
Guarded by `styles/__tests__/mobile.test.js` — a **cross-cutting** file,
in `styles/__tests__/` per the `revealTransition.test.js` precedent,
because none of it belongs to one module.

**What was already right, and is worth knowing before touching it:**
`document.documentElement.scrollWidth` equals the viewport at **every**
width tested, before and after. There has never been a horizontal
scrollbar on this site. Zero overlapping text pairs at every width, too.

⚠️ **AND THAT IS EXACTLY WHY THE REAL BUGS SURVIVED.** Every problem
found was invisible to the checks that usually catch layout faults —
each one is clipped by an ancestor, so nothing scrolls, nothing errors,
and the page measures perfectly while looking broken.

**1. ⚠️ THE CONTACT FORM'S EMAIL FIELD RAN OFF THE SCREEN, on exactly the
phones people own.** An `<input>` has an intrinsic width of ~202px and a
grid item's default `min-width: auto` refuses to shrink below its
min-content size, so when the form row went to two columns the fields
stayed 202px in a 151px track:

| viewport | row | track | field | result |
| --- | --- | --- | --- | --- |
| 375 | 1 col | 301px | 301px | ok |
| **390** | 2 col | 151px | **202px** | **+14px past the edge** |
| **400** | 2 col | 156px | **202px** | **+9px** |
| **414** | 2 col | 162px | **202px** | **+2px** |
| 430 | 2 col | 170px | 202px | ok — it fits again |

**Broken only between ~380 and ~424px** — a band that contains the
iPhone 14/15 Pro (393) and the 14 Plus (414) and **excludes both widths
anyone tests first, 375 and 430.** `justify-self: stretch` was already
sizing the field correctly; the floor was overriding it. Fixed with
`min-width: 0` on `.input` **and** `.field` — both levels, or the floor
just moves up a box.

**2. Tap targets. Five were under 44px; the two that mattered most were
found last.**

| control | was | now |
| --- | --- | --- |
| hamburger | 32×32 | **44×44** (6px padding, bars still 32px) |
| **overlay nav links** | **32px** | **44px** |
| overlay close | 40px | 44px |
| footer nav links ×10 | 22px | 44px, below 900px |
| hero `LOUD` CTA · footer `START A PROJECT` | 36 / 42px | 44px, on touch widths |

⚠️ **THE OVERLAY LINKS WERE MISSED BY TWO FULL AUDIT PASSES, because an
automated sweep never opens the menu.** Every other target on the site
was measured and fixed while the only way to navigate on a phone sat at
32px. **Open the menu before trusting a mobile audit.**

Three implementation notes that are not obvious:
- **The hamburger's 6px padding keeps the content box at 32px**, so the
  bars stay 32px wide and the `translateY(7px)` rotation math is
  untouched. 44 is also the number that keeps `--header-h` at **71px** —
  the header's height is its tallest child, and the logo and theme
  toggle are both 44. Re-measured: 71px, and `#about`'s
  `scroll-margin-top` still 71px.
- **Every grown box paid for itself out of its gap.** The overlay's went
  20px → 8px and the footer column's 12px → 0, so the space *between
  labels* is unchanged. Growing one without shrinking the other turns a
  tap-target fix into a visible layout change.
- **`min-height`, never more padding.** 12px top and bottom on the hero
  CTA looked like exactly 44 and measured **43.6** — the line box is
  19.6px, not the whole 20 it appears to be. A `min-height` cannot be
  wrong by a rounding error.

**3. ⚠️ TWO HERO CHIPS WERE CLIPPED MID-WORD AT EVERY WIDTH BELOW
1024px, and no measurement found it.** `.chipFastapi` sits at
`right: -6%` and `.chipNext` at `left: -5%`, deliberately — the cluster
reads as *surrounding* the portrait frame rather than sitting inside it.
That works while the stage is narrower than the viewport, which it is at
1024px and up. Below that the stage IS the column, so both landed past
the edge:

| viewport | FastAPI | Next.js |
| --- | --- | --- |
| 375 | −5px | −1px |
| 600 | −9px | −4px |
| 900 | −14px | −5px |
| 1024 | clean | clean |

Pulled to `0` below 1024px — they still touch the stage edge, so the
cluster keeps its shape; only the overhang goes. **Found by looking at a
screenshot**, after two numeric passes reported the page clean.

**⚠️ The generalisable lesson, and it is the whole of this pass:
`scrollWidth === clientWidth` proves nothing about whether a page looks
right on a phone.** Three separate defects — a form field off-screen,
two chips sliced in half, and the primary navigation at 32px — all sat
behind an ancestor that clips, a media query that never fires in a
sweep, or a width band nobody tests. Measure, then **open the menus and
look at the screenshots.**

**The gate after the mobile pass:** frontend **633 / 633** (43 files) ·
lint **exit 0** · build **220 modules** · E2E **37 / 37**. Eight
mutations across the new guards, all caught.

⚠️ **PF-91 did NOT raise these, and that is a decision rather than an
omission.** The ticket scoped to contrast, and after its fixes **all 42
pass AA at their existing sizes** — the failures were ink, not scale.
Raising the type is still the site-wide design decision described below,
and it is still unmade. It no longer has an accessibility argument behind
it, only a legibility one.

⚠️ **Reported, not changed: 42 text nodes render below 11px** (10px and
10.5px mono labels — stat labels, eyebrows, badges, the copyright).
Every one is the prototype's own type scale, and body copy is 13.5–16px
throughout. Raising them is a site-wide design decision, not a mobile
fix, so it batches with PF-91.

⚠️ **The rate limiter cost a verification round again**, exactly as the
Silent-failures entry predicts: repeated automated page loads exhausted
100 requests / 15 min / IP and the API started returning **429**, which
presents as three sections rendering their error state for no reason.
Restarting the backend clears it (`express-rate-limit`'s default store is
in-memory), and the fix is to capture the four responses ONCE and serve
them with `page.route()` + `route.fulfill()` thereafter — registering the
catch-all FIRST, per the reverse-order trap in the same entry.

**PF-88 created ONE new orphan pair and changed no other count.**
Counted rather than inferred, discounting each module's own file and its
own test:

| | before | after |
| --- | --- | --- |
| `--content-px` · `--content-max` | 1 each (the Phase 1 footer) | **0 each** — declared in `global.css`, read by nothing |
| `useInView` · `useTypewriter` · `TerminalWindow` | 0 | 0 — ~~still deliberate cutover work~~ **all three DELETED in PF-89** |
| `apiUrl` | 1 (Contact) | 1 |

Verified at `HEAD` that the Phase 1 footer really was their last
consumer — `git grep` for either name outside `global.css` returns
nothing else. They go with `global.css` at cutover; same shape as
`--acc2`/`--acc2rgb`, which the sun/moon toggle orphaned. A token sweep
should not read either pair as live.

**The gate, all five commands:** frontend **627 / 627** (42 files) · lint
**exit 0** · build **220 modules**, 64.21 kB CSS / 412.77 kB JS · backend
**242 / 242** (22 suites, 163s) · E2E **36 / 36** (1.3m, up from 29).
No flaky, no skipped.

**42 mutations across every new guard, all caught**, including the two
highest-value ones the ticket names: removing `key={replayCount}` (the
splash still mounts, every other test in the file still passes, and only
the reveal-reset assertion fails) and keying `SplashProvider` instead
(the star field's canvas node is replaced).

**⚠️ The backend suite failed 25 tests before it passed 242, and NONE of
it was code.** PF-88 touches zero backend files. The first run went
**25 failed / 217 passed in 1366 seconds** with individual suites taking
110-640s; the second, after the network settled, went **242 / 242 in
163s** — an 8× speedup. Classified rather than assumed: **zero `expect`
diffs** in the failing run, 54 `Operation buffering timed out` and 34
`Exceeded timeout of 30000 ms`. That is the shape the `blogViews` entry
in Outstanding work describes, at scale. See the new SRV-DNS entry in
Silent failures for the root cause.

**Built by PF-89 — the Phase 1 cutover, and the second ticket in this
project whose diff is mostly deletions:**

```
frontend/src/
  hooks/useTypewriter.js               DELETED  (+ its 4-test file)
  hooks/useInView.js                   DELETED  (no tests existed)
  components/common/TerminalWindow.jsx DELETED  (no tests existed)
  styles/global.css                    − [id] { scroll-margin-top: 5rem }
  styles/tokens.css                    − the light-theme bridge
  styles/__tests__/tokens.test.js      4 bridge guards → 2 (see below)
  styles/__tests__/cutover.test.js     NEW  10 cases, the guard that outlives it
  test/setup.js · utils/theme.js       prose naming the deleted modules
  components/sections/ProjectsSection.jsx    same
frontend/e2e/homepage.spec.js          same
frontend/test-results/.last-run.json   git rm --cached
```

**⚠️ THE TICKET SAID THE TEST COUNT WOULD DROP. IT ROSE, 633 → 637**, and
the arithmetic is worth stating so nobody reads it as the deletions not
having happened: **−4** (useTypewriter's, deleted with the hook), **−4**
bridge guards, **+2** replacing them, **+10** new cutover guards. The
ticket's own suggested commit message needs that one line corrected.

**The `[id]` rule was DELETED, not narrowed, and that deviates from the
ticket.** Step 2 says: if any anchor target exists outside the six Phase
2 sections, narrow rather than delete. One does — `<main id="main-content">`,
the skip-link target, on **every** route. But the instruction's stated
rationale ("the anchor just lands under the header") is provably false
for it. Measured on the production build:

| page | `#main-content` document position | skip-link scroll | `main` top after |
| --- | --- | --- | --- |
| home | **0** | 1500 → **0** | 0 |
| 404 | **0** | 426 → **0** | 0 |
| `/admin/login` | **0** | 0 → 0 | 0 |

`<main>` is the first in-flow element on every route — the header and the
skip link are both `position: fixed` — so it sits at document position 0,
the browser clamps the scroll target at 0, and **`scroll-margin-top` is
unreachable there.** Narrowing would have shipped an inert declaration,
which this file's own `margin-left: auto` entry calls worse than none:
the next reader treats it as load-bearing and builds around it.

Its only other targets were `#root` (Vite's mount point, never an anchor)
and `#pub`/`#featured`, two admin checkboxes on a page with **no fixed
header at all** — so the rule was actively wrong there, adding 80px of
scroll offset for a header that is not rendered on `/admin/*`.

**⚠️ ONE GUARD THE TICKET SAID TO DELETE WAS KEPT, AND THE TICKET'S
REASONING FOR DELETING IT WAS WRONG ON THE FACTS.** Step 6 says to remove
all five bridge guards "including the one that fails if the rule is
widened", on the grounds that it "protects a rule that no longer exists".
There were **four**, not five — and the fourth never asserted anything
about the bridge. It asserts that `tokens.css`'s `html[data-theme="light"]`
block does **not** redefine Phase 1 property names. That hazard is
completely untouched by the bridge's removal, because `/admin` still
reads `global.css`'s `:root` for every one of them: hoisting the removed
declarations up into the unscoped block — the obvious "simplification" —
would put near-paper ink on the admin panels' dark surfaces. Kept, plus a
second asserting no bridge rule survives anywhere. Both hardened to strip
comments first, because `tokens.css` now documents the **removed** bridge
in prose, naming every property the test forbids — the comment-matching
trap, arriving by the exact route this file warns about.

**The bridge's consumer count was proved, not assumed.** Grepping
`text-primary|--accent` across `components/sections/` and `styles/`
(discounting `tokens.css` and `global.css`) returns **zero**. Custom
properties inherit, so the block's only possible consumers were
descendants of `#projects`/`#blog`/`#contact` — and `ErrorBoundary` is
**not** one, despite reading `--text-muted`, because it *wraps* the
section rather than nesting inside it: its fallback replaces `#projects`
entirely.

**⚠️ THE VERIFICATION THAT ACTUALLY SETTLED THIS WAS A COMPUTED-STYLE
CENSUS, NOT SCREENSHOTS.** A deletion ticket cannot be verified by
looking at the result, and the pixel diff said so loudly: home-dark
differed by **19.7%** before vs after. That number is meaningless without
its control — **two runs against the SAME build differ by 13.8–24.0%**,
because `StarfieldCanvas`, the marquee and `GrainOverlay` are all
non-deterministic. The before/after diff sits *inside* the noise floor,
in both directions.

So the real instrument was a census of every tracked computed property on
every element, under `prefers-reduced-motion`, across three pages × two
themes — **1,252 elements**:

| combination | elements | differ |
| --- | --- | --- |
| dark/home · light/home | 467 · 466 | **3 · 3** |
| dark/404 · light/404 | 121 · 120 | **2 · 2** |
| dark/adminlogin · light/adminlogin | 39 · 39 | **2 · 2** |

Every one is `scrollMarginTop: 80px → 0px` on `#root` and
`#main-content`. The third on each home run is a single `<div>` whose
data-URI background changed length — `GrainOverlay`, which fills
`Math.random()` noise and writes it with `toDataURL()`. **A same-build
control differs on exactly that div and nothing else**, which is what
makes it noise rather than a finding. `/admin` and `/admin/login` are
**pixel-identical**, both themes.

All six sections still land at exactly **71px**.

**The gate, all five commands:** frontend **637 / 637** (43 files) · lint
**exit 0** over **121** files · build **220 modules**, 64.86 kB CSS /
411.69 kB JS · backend **242 / 242** (22 suites) · E2E **37 / 37**.

**⚠️ THE JS BUNDLE LOST EXACTLY 0 BYTES — 411.69 kB before and after.**
That is the headline result, not a disappointment: Rollup never included
any of the three deleted modules in the graph, so their unreachability is
**measured** rather than argued. Module count is identical at 220 for the
same reason. Only CSS moved, 65.20 → 64.86 kB (−340 B), from the `[id]`
rule plus the bridge.

**Seven mutations across the new and surviving guards, all caught** —
restore `useInView.js`, import `TerminalWindow` from a live component,
put the `[id]` rule back, unqualify `section.blog` → `.blog`, restore
`useTypewriter.test.js` alone, hoist a Phase 1 token into the unscoped
light block, and restore the bridge rule.

**`styles/__tests__/cutover.test.js` is the THIRD cross-cutting guard**,
after PF-93's `revealTransition.test.js` and PF-88's `mobile.test.js`,
and it follows their placement rather than inventing a `src/__tests__/`.
It belongs to no module because the modules it is about are gone. Three
things in it are load-bearing:

- **It asserts it scanned >80 files.** A scanner that globs nothing
  reports "no offenders" in exactly the same words as a clean tree —
  the same self-check as `revealTransition`'s ">20 pairs".
- **It strips comments before searching.** Four surviving files now
  document these identifiers in prose, at the place the code used to be.
- **`import.meta.url`, not `__dirname`.** The first version used
  `__dirname`; it passes under Vitest, which supplies one, and **fails
  lint** — `eslint`'s browser globals for `src/**` give ESM no
  `__dirname`. Caught by the gate's lint step, which is the entry above
  about `npm run lint` earning its widened scope.

**⚠️ Four Phase 1 CSS classes are PROVEN DEAD and were deliberately NOT
deleted**, plus four more the ticket never named:

| class | jsx consumers |
| --- | --- |
| `.section-label` · `.section-title` · `.section-divider` · `.tech-tag` | **0** — the ticket's own list |
| `.section-wrapper` · `.gradient-text` · `.animate-blink` · `.card-hover` | **0** — found alongside |
| `.grid-bg` | 1 — `NotFoundPage` |
| `.skeleton` · `.glass` · `.btn-primary` · `.btn-outline` | 5 · 12 · 7 · 8 — all admin |

All eight left in `global.css` on purpose. Step 6's table is the deletion
list and names modules only; `global.css` comes out **whole** with the
admin rebuild, and a partial trim destroys the signal that nothing in
that file has been audited yet. `.animate-blink` is worth recognising —
it was the typewriter's caret, and it is the CSS half of the module
deleted here.

**⚠️ `.marqueeWrap` is NOT retired, and the PF-89 ticket says it is.**
The *footer's* went with the tilt during PF-88's revisions; the **hero
still has one** (`HeroSection.module.css:705`), where it clears the
hero band's `rotate(-1.1deg)`. `Footer.test.jsx` already guards that the
hero's values did not leak into the footer. Do not delete it. A
whole-repo sweep of every `*.module.css` against its sibling `.jsx`
found no other orphaned class; the hero's chip and dot classes only
*look* orphaned because they are selected dynamically.

**PF-89 created no new orphans.** `apiUrl` keeps its single consumer
(`ContactSection`'s `CV_HREF`), `useAbout` keeps two, and the
`--content-px`/`--content-max` and `--acc2`/`--acc2rgb` pairs are
unchanged at zero — all four go with `global.css` and the Blog/Admin
rebuilds respectively.

**Not in scope, stated rather than omitted:** `body { font-family }`
stays Inter. `/admin/*` and `NotFoundPage` are still Phase 1 layouts and
switching the site font changes how both render — a visible change with
no ticket behind it. See the admin light-theme entry in Outstanding work
for why the font, `global.css`'s `:root` and admin's light palette are
**one** piece of work rather than three.

**One a11y observation, reported not fixed:** after the skip link is
activated, `document.activeElement` is `<body>` — `<main>` carries no
`tabindex="-1"`, so the browser scrolls to it without moving focus
there, and the next Tab resumes from the top of the document rather than
from the content. The classic skip-link gotcha. PF-83's territory, not a
cutover finding.

**Built by PF-90 — the state audit, and the first ticket to find a defect
in the BUILD rather than in the source:**

```
frontend/src/
  components/layout/Navbar.module.css   backdrop-filter order (header + overlay)
  styles/global.css                     backdrop-filter order (.glass)
                                        + @source not for test files
  styles/__tests__/prefixedPairs.test.js    NEW — 5 cases, 5 mutations
  components/layout/ScrollToTop.jsx     hides while the footer bar is in view
  components/layout/Footer.jsx          + data-footer-bottom; copies 16->18,
                                        duration 40->50.5
  components/layout/Footer.module.css   band Option A; bottomBar C3;
                                        + the navbar surface + blur
  components/sections/HeroSection.jsx   copies 6->8, duration 40->60
  components/sections/HeroSection.module.css   band Option A
  components/layout/__tests__/ScrollToTop.test.jsx   + 6 cases, + MemoryRouter
  components/layout/__tests__/Footer.test.jsx       background guard INVERTED,
                                        + navbar-parity guard, copies 18
  components/motion/__tests__/Marquee.test.jsx      equal-duration assertion
                                        INVERTED to equal-SPEED
  components/sections/__tests__/HeroSection.test.jsx   band values, copies 8
```

**Everything else in this ticket is measurement.**

**⚠️ THE HEADLINE: THE HEADER AND MOBILE MENU HAD NO BACKDROP BLUR IN
CHROME, AND THE SOURCE WAS CORRECT THE WHOLE TIME.** The blur is the
prototype's own (`backdrop-filter:blur(16px)`, unprefixed, 2 occurrences),
`Navbar.module.css` transcribed it faithfully, CLAUDE.md's locked decision
documented it — and esbuild dropped it at minification. Full mechanism in
Silent failures. Fixed by reordering; **81 bytes**.

**This is the first defect here that no amount of reading the source could
find.** Every previous silent failure in this file is visible in a source
file if you know what to look for. This one requires reading the **built**
bundle, and the repo's own habit — "verify against generated output or a
real browser" — is what caught it.

### The Step 1 state matrix — every cell, both themes

| State | dark | light |
| --- | --- | --- |
| Mobile menu open — 8 focusables, all ≥44px | ✅ | ✅ |
| Menu trap cycles both directions, never leaks | ✅ | ✅ |
| Escape returns focus to the hamburger | ✅ | ✅ |
| Menu **legibility** | ✅ | **✗ → FIXED** (the blur) |
| Each field focused — accent border + transparent 2px outline | ✅ | ✅ |
| Form error, empty submit (`role="alert"`) | ✅ | ✅ renders |
| Form error, malformed email | ✅ | ✅ renders |
| Form success + fields cleared | ✅ | ✅ |
| Skills / Projects / Blog **loading** placeholders | ✅ | ✅ |
| Skills / Projects / Blog **error** — section, `<h2>`, `#anchor`, 71px survive | ✅ | ✅ |
| Reduced motion — 0 running animations, 0 reveals off-rest, no splash | ✅ | ✅ |
| Résumé empty state — `href="#contact"`, no `download`, title tooltip | ✅ | ✅ |
| 404 page | ✅ | ✅ renders |
| `/admin/login` | ✅ | **✗ confirmed broken, NOT fixed** |

**Error states drop only the grid**, measured: section height 788/1150/991
→ **362** for Skills/Projects/Blog, with heading, `#anchor` and
`scroll-margin-top: 71px` intact in both themes.

**Reduced motion was measured against a motion-allowed CONTROL**, per the
0-vs-61 precedent: **0** running animations under reduce against **42**
allowed, 0/64 reveals off-rest against 64/64, splash absent against
mounted. ⚠️ **The rAF count is NOT a usable probe here** — a rAF-based
counter self-drives and reads ~61 in both modes. `getAnimations()` filtered
on `playState === 'running'` is the honest instrument.

**`/admin/login` re-confirmed at 1.11:1** — `#f1f5f9` on a `rgb(237,232,223)`
div, and the backdrop chain was walked to prove the ink really does sit on
the flipping `--bg` rather than on an un-flipped panel. Sprint 14's, per the
existing entry. Dark has its own 5 failures at 2.67 (`--text-muted`).

**No NEW AA failures anywhere on the home page.** A full sweep of every
leaf text node against its composited backdrop returns exactly the known
PF-91 batch: Blog meta 4.30 dark, Contact labels 4.14 dark, footer
copyright 3.56 dark, Blog separator 1.44 light, AVAILABLE FOR WORK 4.24
light — plus the form status colours (2.48 / 1.72 light) measured in their
live states.

⚠️ **Two probe artifacts were caught before being reported as findings**,
and both are worth recognising because each *looked* exactly like a real
failure:

- **A backdrop walk that skips the element's OWN background** reported the
  skip link at 1.02:1 and 404's "Back to Home" at 1.06:1. Both are filled
  buttons; including their own fill gives **9.79 / 7.46** and **6.43**. Both
  pass.
- **Outline type has a transparent FILL**, so `color` reads
  `rgba(0,0,0,0)` and any contrast routine returns 1:1. Five headings
  ("I am", "Toolkit", "Built", "Notes", "something loud!") tripped this.
  They are painted by a 1.5px `-webkit-text-stroke` measuring **10.02 dark
  / 6.12 light**. Both pass.

### Step 2 — what a screenshot showed that a measurement did not

`scrollWidth === clientWidth` at every width, before and after, exactly as
the mobile pass recorded. The two real findings came from looking.

**⚠️ `ScrollToTop` COVERS THE COPYRIGHT AT ≤600px — VISIBLE, REPORTED, NOT
FIXED.** "DESIGNED & BUILT FROM SCRATCH" renders as "…FROM SCRA". The text
is **not** clipped — `scrollWidth === clientWidth` and the box sits 16px
inside the viewport at every width — it is **occluded** by the fixed
z-40 button. `elementFromPoint` at the text's own coordinates returns the
BUTTON:

| width | overlap area | occluded samples |
| --- | --- | --- |
| 320 | 1449px² | 3/8 |
| 375 | 1445px² | 2/8 |
| 430 | 1498px² | 2/8 |
| 600 | 1755px² | 1/8 |
| 768 · 1440 | **0** | **0/8** |

Any fix moves something visible, so it awaits sign-off — see Outstanding
work. The screenshots live in the session scratch, not the repo (PF-83
precedent); reproduce with a 375px viewport scrolled to the footer.

⚠️ **My own first reading of that screenshot was WRONG in an instructive
way**: it looked like horizontal clipping, and the measurement said no
overflow. The measurement was right. **"Clipped" and "covered" look
identical in a screenshot and are opposite defects** — one is an overflow
bug, the other a stacking bug. `elementFromPoint` distinguishes them; no
box measurement can.

**The hero at 375 needed a second look for the opposite reason.** The
first capture showed no portrait and ghosted chips, which reads as a
rendering failure. It was the reveal gate working correctly — at 375 the
portrait sits below the fold, so its `Reveal` had not fired when the
element screenshot was taken. Scrolled in: portrait renders, all **10**
chips legible, **none** clipped, PF-88's chip fix holding. **An element
screenshot of a below-the-fold reveal target captures its hidden state.**

Also looked at and clean: section boundaries at 375/768 both themes, footer
three zones at 375/430/1024, marquee bands mid-cycle at 375 and **3440**
(seamless, consistent with the 12-copy/~3600px coverage), the 380–424px
form-field band (fields now shrink to 151–167px, zero overflow).

### Step 3.1 — the `--srf` / `--gnd` light divergence, measured not changed

⚠️ **The ticket calls it "undocumented since PF-67". It is documented in
`tokens.css` itself**, with a stated rationale — "Warm whites, not pure
white — #FFF against #EDE8DF paper reads cold and discordant." What it was
missing is a record HERE, which is what this entry supplies. It is a
deliberate PF-67 judgement, not a transcription slip.

⚠️ **All THREE prototypes collapse the pair** (`--gnd:255,255,255;
--srf:255,255,255`), not the two the ticket names — Admin does too.

Measured on the production build, light theme, card over `--bg` #EDE8DF
(ground `237,232,223`):

| | card | delta vs ground | card-vs-ground contrast |
| --- | --- | --- | --- |
| design `rgba(255,255,255,.52)` | 246,244,240 | 9 / 12 / 17 | 1.111 |
| **repo** `rgba(254,252,248,.52)` | **246,242,236** | **9 / 10 / 13** | **1.094** |

Direction confirmed: **our light cards separate from the page slightly less
than the design's, and they are warmer** (blue channel 236 vs 240). Max
channel difference **4**. The ticket's predicted `246,243,236` is one off in
green; the arithmetic gives 242.40.

**Not changed** — it is a site-wide visual decision. Recorded as a
sanctioned deviation by this entry.

### Step 3.2 — the hero portrait's light-theme mask

Full account folded into the PF-80 entry above, where the wrong sentence
was. Short version: the prototype **does** mask this image, in light only,
from `applyTheme()` line 862; `data-heroimg` appears **zero** times in
`frontend/src`; PF-80's two-layer mask stands and is owner-approved; the
two are now captured side by side for whenever the owner wants to compare.

### The close-out (2026-08-27)

**1 — `ScrollToTop` now hides while the footer's bottom bar is in view.**
Owner decision, chosen over padding the bar (which moves a transcribed
layout to accommodate a floating control) and over shortening the
copyright (which would reverse the owner's own "ALL RIGHTS RESERVED"
addition). Hiding is what the control *means*: at the bottom of the page
the footer's own navigation is right there.

`Footer` renders `data-footer-bottom` on the bar; `ScrollToTop` observes
it. Three implementation points are load-bearing and all three are in the
component's doc comment: **IntersectionObserver, never a scroll offset**
(the bar's position moves with content length); **unmount, never
`opacity: 0`** (a focusable invisible button is the skip-link failure mode
in reverse); and the observer is **keyed on `pathname` with the reading
DERIVED during render**, because `App.jsx` renders no footer on
`/admin/*` — a visitor at the footer who clicks ADMIN would otherwise
leave a stale "in view" reading and hide the button for the whole admin
session. Deriving also keeps it clear of
`react-hooks/set-state-in-effect`, which a reset would violate.

⚠️ **`ScrollToTop` now calls `useLocation()`, so it needs a Router
context.** In the app it has always been inside `App.jsx`'s
`<BrowserRouter>`, but its tests rendered it bare and now wrap in
`MemoryRouter`. A bare render fails with "useLocation() may be used only
in the context of a `<Router>` component", which reads like a routing bug
and is not one — the same trap `HomePage.test.jsx` hit.

Verified in the browser with **`elementFromPoint` at the copyright's own
coordinates**, not by screenshot, since that is the only probe that
separates clipped from occluded:

| width | occluded samples before | after |
| --- | --- | --- |
| 375 · 430 · 600 | 2/8 · 2/8 · 1/8 | **0/8** each |
| 768 · 1440 | 0/8 | 0/8 |

Also: visible mid-page and gone at the bar at 375 and 1440 in **both**
themes, returns on scrolling back up, **45 Tab stops never land on it**
while hidden, and its `riseIn` entrance collapses to **0.01ms** under
`emulateMedia({reducedMotion:'reduce'})` against a **300ms**
motion-allowed control.

**3 — The prefixed-pair sweep: `backdrop-filter` was the ONLY live
instance.** Checked in the BUILT css, per pair, not in the source:

| pair | source order | built | verdict |
| --- | --- | --- | --- |
| `backdrop-filter` ×3 (header, overlay, `.glass`) | standard first | webkit-only | **was broken — fixed** |
| `backdrop-filter` (ScrollToTop, ThemeToggle) | prefix first | both | safe |
| **`mask-image`** (hero portrait) | prefix first | **both** | safe |
| **`mask-composite`** (hero portrait) | prefix first | **both** | safe |
| `background-clip` (`.gradient-text`) | prefix first | both | safe |
| `-webkit-text-fill-color`, `-webkit-text-stroke`, `-webkit-font-smoothing`, `::-webkit-scrollbar` | prefix-only | — | no standard form; not a pair |

⚠️ **The hero portrait mask was the one that could have been live and
visible**, and it is fine — `mask-composite` computes `intersect,
intersect` on the real element. Proved with a **rendered** three-panel
control (a red square masked by a circle and a band): `intersect` paints
only the circle, `add` and the default paint the whole square. That
control is the instrument, because `CSS.supports()` returns `true` for a
property that computes to `none`.

`backdropFilter.test.js` became **`prefixedPairs.test.js`** — it now
fails on ANY standard-before-prefixed pair in any `*.css` under `src/`,
so a new pair in a new file is covered without anyone remembering.
Mutation-tested five ways: hero `mask-image`, hero `mask-composite`,
`.gradient-text` `background-clip`, the original navbar bug — all caught;
plus a comment containing `mask-image: none; backdrop-filter: blur(9px)`
correctly **not** caught, which is the control proving it parses rather
than text-searches.

### Footer revisions — ALL FOUR SHIPPED (2026-08-27, owner-selected)

Owner asked for measured options rather than one guess, then chose:
**2a Option A · 2b 70 px/s with independent durations · 2c C3 · 2d ship
it.** All four are applied. The rejected options are kept below because
the reasoning is the useful part — each was measured, and "why not B"
is a question that will be asked again.

**Baseline, measured (`offsetHeight`, not `getBoundingClientRect`):**

| band | h @1440 | font | line-height | padding | gap | copyW | copies | px/s @40s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hero | **50px** | 21px | 33.6px | 8px | 24px | 1297 | 6 | 97.3 |
| footer | **52px** | 21px | 33.6px | 8px | 24px | 484.7 | 16 | 96.9 |

⚠️ **Line-height dominates: 33.6 of the 49.6px interior.** Padding is
16px of it, which is why padding alone barely moves the band and why the
hero's 2026-08-17 slimming needed font *and* padding together.

**2a — thinner, two options, measured:**

| | font | pad | gap | hero h | footer h | change |
| --- | --- | --- | --- | --- | --- | --- |
| current | `clamp(13px,1.6vw,21px)` | 8px | 24px | 50 | 52 | — |
| **A ← SHIPPED** | `clamp(11px,1.25vw,17px)` | 6px | 20px | **39** | **41** | −21% |
| ~~B~~ rejected | `clamp(10px,1.0vw,14px)` | 5px | 16px | 32 | 34 | −35% |

⚠️ **BOTH OPTIONS BREAK SEAMLESSNESS AT THE SHIPPED COPY COUNTS**, because
a smaller font shrinks `copyW` and the requirement is
`copies ≥ 2 × band / copy`. Copies needed to keep 3440 coverage:

| | hero copies | footer copies |
| --- | --- | --- |
| current | 6 (shipped **6** — exactly at the limit) | 16 (shipped **16** — exactly at the limit) |
| **A** | **8** | **18** |
| **B** | **8** | **22** |

The current bands sit *exactly* on their limit at 3440, so any thinning
requires a copies bump. Both must stay EVEN.

**2b — slower, with px/s stated because duration alone is not speed.**
Distance per cycle is `copies/2 × copyW`, so raising `copies` for
seamlessness makes a band **faster** at the same duration:

| geometry | distance @1440 | px/s @40s | 55s | 70s |
| --- | --- | --- | --- | --- |
| current hero (6) | 3891 | 97.3 | 70.7 | 55.6 |
| current footer (16) | 3877.6 | 96.9 | 70.5 | 55.4 |
| A hero (8) | 4202.4 | **105.1** | 76.4 | 60.0 |
| A footer (18) | 3536.1 | 88.4 | 64.3 | 50.5 |
| B hero (8) | 3458.8 | 86.5 | 62.9 | 49.4 |
| B footer (22) | 3554.1 | 88.9 | 64.6 | 50.8 |

On the CURRENT geometry the two bands are already matched (97.3 / 96.9),
and one duration serves both: **55s ≈ 70 px/s**, **70s ≈ 55 px/s**. Under
option A they diverge (105 vs 88) and would need different durations to
stay matched — worth knowing before combining 2a and 2b.

**2c — compaction. Provenance first, so it is clear what is being
overruled:**

| value | current @1440 | whose |
| --- | --- | --- |
| footer `padding-bottom` | 26px | **prototype's** |
| `.inner` `padding-top` | 46px | **owner deviation** (prototype: `clamp(38px,6vw,64px)`) |
| `.inner` `padding-x` | 40px | prototype's |
| `.grid` `gap` | 46px | **prototype's** |
| `.bottomBar` `margin-top` | 56px | **prototype's** `clamp(34px,5vw,56px)` |
| `.bottomBar` `padding-top` | 22px | **prototype's** |
| `.inner` `max-width` | none | owner deviation (prototype: 1240px) |

Measured options, all with **zero horizontal overflow at 320–1440** and
zone widths unchanged:

| | inner-top | bar-top | gap | footer h @1440 | @375 | above:below |
| --- | --- | --- | --- | --- | --- | --- |
| current | 46 | 56 | 46 | 426 | 926 | 0.82 : 1 |
| **C1** | 34 | 32 | 46 | **390** (−8%) | 906 | 1.06 : 1 |
| **C2** | 26 | 22 | 36 | **372** (−13%) | 890 | 1.18 : 1 |
| **C3 ← SHIPPED** | **46 (unchanged)** | 20 | 46 | **390** (−8%) | 906 | **2.30 : 1** |

⚠️ **C3 is the one that actually answers "zones pushed DOWN".** C1 and C2
compact from both sides, so the block keeps roughly its current position
between band and rule. C3 saves the same 36px as C1 but takes it all from
*below* the zones, so they sit markedly closer to the bottom rule — which
is what was asked for. C1/C2 are the "just make it smaller" readings.

**2d — the navbar surface on the footer. ⚠️ THE BRIEF'S PREMISE IS WRONG
IN THE OWNER'S FAVOUR.**

The brief says `--ftr` is `233,227,216` in light, predicts a 4/5/7
channel difference against `--bg`, and warns the footer may read as
nearly the same colour as the page. **`--ftr` light is actually
`226,212,190`** — `tokens.css:108`, commented "tan chrome". So:

| | composited surface | delta vs ground | |
| --- | --- | --- | --- |
| brief's assumed `233,227,216` | 234,228,217 | −3 / −4 / −6 | would indeed be near-invisible |
| **real `226,212,190`** | **228,215,195** | **−9 / −17 / −28** | clearly a distinct band |

Pixel-sampled from the rendered page rather than only computed: the empty
footer surface goes **`rgb(226,223,216)` → `rgb(222,210,192)`** in light,
and **`rgb(16,20,26)` → `rgb(19,24,38)`** in dark. It reads as warm tan
chrome in light and navy chrome in dark, matching the navbar. **It does
NOT read as "no change".**

- **The marquee bands need nothing.** Their fill is `var(--acc)` at full
  opacity (owner's 2026-08-25 pass made them solid ink-on-accent), so the
  footer surface behind them is irrelevant — measured identical before
  and after, `rgb(252,163,17)` dark / `rgb(126,72,0)` light.
- **The STATUS card survives**, contrary to the brief's worry. Light:
  composited `rgb(246,242,236)` → `rgb(241,234,222)`, still **+13/+19/+27**
  clear of the new footer surface. It is a lighter panel on a tan ground
  rather than a near-invisible one on paper.
- **Star-field cost, measured as luminance RMS in an empty patch:**
  **0.00253 → 0.00107 dark (−58%)**, **0.01963 → 0.01138 light (−42%)**.
  Roughly half the visible texture behind the footer goes. `GrainOverlay`
  is z-70, above the footer, so what is lost is the star field (z-0).
- ⚠️ **AA GOT WORSE. ⚠️ THESE ARE PF-91'S NUMBERS — the pre-2026-08-27
  figures elsewhere in this file describe a footer that no longer
  exists.** Re-measured against the SHIPPED backdrop, every text node in
  the footer, both themes (`19 pass / 3 fail` in each):

  | node | token / size | dark | light |
  | --- | --- | --- | --- |
  | **copyright** | `--faint` 10.5px | 3.56 → **3.36** ✗ | 4.97 → **4.28** ✗ *newly failing* |
  | **role line** "FULL-STACK DEVELOPER" | `--muted2` 10px | ok → **4.30** ✗ *newly failing* | 4.69 ✅ |
  | **bio copy** | `--muted2` 13.5px | ok → **4.30** ✗ *newly failing* | 4.69 ✅ |
  | **AVAILABLE FOR WORK** | `#0E7A55` 10.5px | 9.12 ✅ | 4.24 → **3.67** ✗ |
  | **status dot ●** (ok) | `#0E7A55` 12px | 9.19 ✅ | ok → **4.47** ✗ *marginal* |
  | nav links · column headings · STATUS · CTA | — | 7.25–9.79 ✅ | 5.26–7.46 ✅ |

  ⚠️ The light badge sits on `rgb(217,215,192)` — its own tint over the
  new footer surface, not the footer surface itself — which is why it
  moves further than the copyright does.

  The mechanism is the one this file already documents: `--muted2` and
  `--faint` on a **translucent surface** rather than the page ground.
  Adding a surface is exactly what flips them, and it is the fifth and
  sixth occurrence of that trap.

**This REVERSES the 2026-08-18 wash-removal scope**, and the draft
Locked-decisions entry should say so rather than read as a fresh value:
that decision strips section washes so the star field reads continuously,
and this puts a band back at the bottom. The narrowing that makes it
coherent is **chrome vs section** — the navbar already carries exactly
this surface at the top, so the footer taking it makes the two ends of
the page matching chrome rather than making the footer a sixth banded
section. That is the owner's call to make, and it is a real narrowing
rather than a loophole.

Include the blur, and order `-webkit-backdrop-filter` FIRST — the guard
added in this ticket enforces it.

**Owner's reasons, recorded because they are judgement rather than
measurement:** B was rejected as "thin enough to read as a hairline rule
rather than a band, and the type gets small enough that the copy stops
registering as text at a glance." C3 was chosen because "it is the only
one that answers what I asked for: the zones move DOWN, toward the bottom
rule, rather than the whole block shrinking in place." 70 px/s over the
55s option because "a thin band moving fast reads as busier than a thick
one at the same speed."

**⚠️ THE TWO BANDS NOW RUN AT DIFFERENT DURATIONS, ON PURPOSE — and the
test that used to assert they were EQUAL had to be inverted.** Equal
duration was right while their copy widths were close; after Option A
they are not, and one duration would have given 105 vs 88 px/s. The
contract is equal SPEED:

| band | copies | copyW | distance = copies/2 × copyW | duration | px/s |
| --- | --- | --- | --- | --- | --- |
| hero | 8 | 1050.6 | 4202.2px | **60s** | **70.04** |
| footer | 18 | 392.9 | 3536.4px | **50.5s** | **70.03** |

Measured on the production build, not computed. `Marquee.test.jsx` now
pins each number *and* re-derives both px/s from the measured copy
widths, so making them equal again fails. ⚠️ Its regex had to become
`[\d.]+` — the footer's duration is **50.5**, not an integer.

**⚠️ COPIES WENT UP, WHICH IS THE COUNTER-INTUITIVE HALF.** Thinning a
band *raises* its copy requirement: a smaller font shrinks `copyW`, and
`copies ≥ 2 × band / copy` moves against you. Hero **6 → 8**, footer
**16 → 18**. Both were sitting exactly on their limit at 3440 before, so
shipping Option A at the old counts would have reopened the hole the
counts exist to close. Re-verified seamless at **3440 · 2560 · 1920 ·
1440 · 1024 · 899 · 768 · 430 · 375 · 320**.

**Post-ship verification:** hero **39px** / footer **41px** at 1440
(30/32 below 1024) · `--header-h` **71px** at every width · `#about`
`scroll-margin-top` **71px** · **zero** horizontal overflow 320–3440 ·
bottom bar single centred child, **no collision** at any width.

**2e** was folded into the above rather than left pending.

### The footer scroll-to-top link — restored (2026-08-27, owner-requested)

*"when i hit the bottom the small button is disappearing so now add
right bottom of the footer a scroll top to button according to the
theme."*

**A direct consequence of part 1**, and a fair catch: hiding the
floating `ScrollToTop` while the bottom bar is in view fixed the
copyright occlusion and, at the very bottom of the page, left no way
back up at all.

**⚠️ NOT INVENTED — the prototype has this control** at line 601, and
it was deleted on 2026-08-25 as "redundant with ScrollToTop". That was
true then and stopped being true the moment that button learned to hide
here. So this is a restoration, and the values are transcribed:

```
justify-self:end; font-size:10.5px; letter-spacing:.14em;
color:var(--muted); border:1px solid rgba(var(--ln),.18);
border-radius:999px; padding:10px 16px
hover -> color / border-color: var(--acc)
```

`justify-self: end` is what puts it bottom-**right**, which is both where
the owner asked for it and where the design already had it. "According to
the theme" needed no work: every value is a token, so it follows the
theme for free — measured `rgb(147,160,184)` dark / `rgb(69,83,109)`
light, text contrast **7.25 / 5.46**, both passing.

**⚠️ ONE DEVIATION: the LABEL.** The prototype reads
`SCROLL BACK UP ↑`; this ships **`SCROLL TO TOP ↑`**, the owner's own
wording. Everything else is the design's, so a fidelity pass will flag
the label and nothing else — expected, and this is the record.

**⚠️ THE `1fr auto 1fr` GRID CAME BACK, reversing part of the
2026-08-25 change.** That change removed the grid with the reasoning
"with both outer cells gone there is nothing left to balance … two empty
`1fr` columns around a lone centred line is an inert declaration the next
reader treats as load-bearing." The reasoning was right and its premise
is gone: the right-hand cell is populated again. **The empty first cell
is now genuinely load-bearing — it is the counterweight.** Neither
`text-align: center` nor `space-between` can centre a line against a
158px pill on one side only; measured off-centre **0px** at 1440/1024
with the grid, **79px** without it.

**An `<a href="#hero">`, not a `<button>` + `scrollTo`** — via
`sectionHref(pathname, 'hero')`, so it is route-aware like every other
footer link. A plain anchor inherits the root's `scroll-behavior`, which
`motion.css` flips to `auto` under reduced motion; a JS `scrollTo` with
an explicit `behavior` does **not**, which is the whole reason
`utils/replay.js` existed and why `ScrollToTop` has to read the media
query by hand. Traced both ways: **4921 → 0** with motion allowed
(`scroll-behavior: smooth`) and **5244 → 0** under reduce
(`scroll-behavior: auto`), `location.hash` `#hero` in both.

**⚠️ IT STACKS BELOW 900px, AND BOTH HALVES ARE MEASURED:**

| | ≥900px | ≤899px |
| --- | --- | --- |
| bar | `1fr auto 1fr`, pill flush right | one column, everything centred |
| pill | 158 × **39px** (the prototype's) | 158 × **44px** |
| copyright off-centre | 0 | 0 (was 79 before stacking) |

`1fr auto 1fr` only centres while the copyright fits ONE LINE. It wraps
from 768px down — `ALL RIGHTS RESERVED` took it to 78 characters — and
the `auto` column keeps its 158px, so the two `1fr` columns stop being
equal to the eye. **899px, not 768px**, so the footer changes shape once
rather than twice: it matches `.grid`'s own breakpoint.

**44px is the tap target, not a look.** The prototype's 10px padding on
10.5px type measures **39px**, four short — and on a phone this is the
only way back to the top. Applied at the stacked breakpoint only; 39px
is the design's value and a pointer does not need 44.

⚠️ **No `transition` is declared, and that is transcription rather than
the PF-93 rule.** This bar sits outside the four `data-reveal` column
wrappers, so `hideReveals()` never writes an inline transition over it
and the prototype declares none of its own. Measured `0s` — it snaps, in
the export exactly as here.

**Reported, not fixed:** the pill's border is `rgba(var(--ln),.18)`,
measuring **1.58 dark / 1.41 light** against its ground — below the 3:1
a UI boundary wants. It is the prototype's own value, and the control's
identification does not rest on it (the label is 7.25 / 5.46). Batches
into PF-91 with the rest.

**Guards: 5 new unit cases + 2 new E2E cases**, and **three existing
absence guards had to be SPLIT** rather than deleted — REPLAY INTRO
stays guarded as absent, the scroll-to-top link flips to a presence
guard. Keeping the pair in one test is deliberate: they were removed
together and only one came back, which is exactly what a fidelity pass
gets wrong in both directions.

⚠️ **Two test-authoring traps hit while writing those, both already
documented in this file, both hit anyway:**

- **`declsFor` collapses a base rule with its `@media` override**, so
  the base assertions read the MOBILE values and failed against correct
  code. `baseDeclsFor` exists for exactly this and its own doc comment
  describes the trap. Use it, plus `mediaDeclsFor` for the breakpoint.
- **`forClass('scrollUp')` also matches `.scrollUp:hover`**, so the
  hover's `color: var(--acc)` overwrote the resting `var(--muted)` and
  the rest colour read as wrong when it was not. Match the selector
  exactly when a rule has pseudo-class siblings.

⚠️ **And one mutation REPORTED CLEAN AND WAS INVALID** — the
"mutate the code, then confirm the file actually changed" trap, which
this file already records from the PF-88 revisions. Dropping the 44px
tap target appeared uncaught; `Footer.module.css` has **three**
`min-height: 44px` declarations (nav links and the CTA from the mobile
pass, plus this one) and a first-match replace hit the wrong rule.
Mutating the right line fails the guard correctly. **Six mutations, all
caught** once the invalid one was redone.



**⚠️ ONE E2E SPEC PINNED THE OLD DURATION AND WENT RED.**
`e2e/footer.spec.js:122` asserted `duration === [40000]`; it is now
`[50500]`. Worth recording because it is the *good* kind of failure —
the guard existed precisely so a band's timing could not change
unnoticed, and it caught the change on the first run. Updated with the
reason rather than the number alone, since "make the two equal again" is
the natural next edit and is now wrong.

Three unit guards went red for the same reason and were inverted rather
than relaxed: `Footer.test.jsx`'s "declares NO background on the
`<footer>` rule" (now asserts the navbar surface is present AND the
prototype's gradient still absent, plus a new guard that the footer's
surface matches the header's property for property), its strip count
16 → 18, `HeroSection.test.jsx`'s band values and copy count 6 → 8, and
`Marquee.test.jsx`'s equal-duration assertion → equal-SPEED.

⚠️ **Writing those, I hit the raw-text-matches-a-comment trap in the
guard against it.** A new negative assertion —
`expect(ruleBody('.marqueeText')).not.toContain('clamp(20px, 2.6vw, 34px)')`
— failed against correct code, because the rule documents the
prototype's own value in prose directly above itself. Fixed by stripping
comments first. That is the eighth occurrence, and the first inside a
test written by someone who had just re-read the entry warning about
it. On the shipped state (part 1 only)
`--header-h` re-measured **71px** at 320–3440, `#about`'s
`scroll-margin-top` **71px**, zero horizontal overflow, and both marquee
bands seamless at 3440 / 1440 / 375.

### The gate

frontend **648 / 648** (44 files) · lint **exit 0** over **122** files ·
build **220 modules**, **66.42 kB** CSS / 412.01 kB JS · backend
**242 / 242** (second run; see the fourth variant above) · E2E
**37 / 37**.

Final gate after the footer revisions AND the restored scroll-to-top
link: frontend **651 / 651** (44 files) · lint **exit 0** over 122 files ·
build **220 modules**, 66.98 kB CSS / 412.20 kB JS · backend
**242 / 242** (183s) · E2E **38 / 38**.

⚠️ **The backend needed a re-run, and the first result was NOT the
documented network flake.** Run 1: **3 failed / 239 passed in 525s**, all
three from `auth.test.js`'s `beforeEach` with
`E11000 duplicate key error … dup key: { email: "admin@test.com" }`. Run 2:
**242 / 242 in 179s**. Distinguishing it matters: the documented flake is a
*timeout with no `expect` diff*; this is a *leftover document* — zero
timeouts, zero assertion diffs, a unique-index collision, under
`--runInBand` where suites are serial. `auth.test.js` alone passes 10/10
and has not been touched since Sprint 7. PF-90 changes no backend file.
**Test-isolation residue in `portfolio_test`, transient, and a third
distinct backend failure shape to recognise.**

⚠️ The E2E run printed **429**s from its own backend's rate limiter — the
documented trap, triggered by the suite's own repeated page loads. All 37
passed regardless; no spec depends on that data.

**PF-90 created no orphans and removed none.**

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

This project has been bitten repeatedly. Assume any of these can happen with no
error message:

- **Mistyped CSS custom property** → declaration dropped, element inherits
- **Mistyped `animation-name`** → element simply does not animate. `drift-blog`
  is the trap here: it looks like it should exist by symmetry, and it does not.
- **⚠️ Naming a keyframe inside a `*.module.css` breaks it — always.** The most
  expensive silent failure found so far, and **not a typo class**: correctly
  spelled names fail too. CSS Modules scopes `@keyframes` names, and it rewrites
  the name inside an `animation` / `animation-name` declaration to match. The
  library lives in `styles/keyframes/*.css`, which are **not** modules, so those
  names stay global — and the two never meet.

  **The wrong pattern**, which looks completely ordinary:

  ```css
  /* Splash.module.css */
  .ringOuter { animation: pulsering 6s ease-in-out infinite; }
  ```

  **What it actually compiles to.** Real build output, not a description —
  dev naming first, then the same rule in production:

  ```css
  .Splash-module__ringOuter{…;animation:6s ease-in-out infinite Splash-module__pulsering;…}
  /* production: animation:6s ease-in-out infinite EWAVTs */
  ```

  …while the only matching rule in the whole bundle is `@keyframes pulsering`.
  So it resolves to **a scoped name that matches nothing** — not to empty, and
  not to the real keyframe. The declaration is valid CSS and present in the
  sheet; it just names an animation that does not exist, and per spec no
  animation is applied.

  **The fix — `composes: kf-<name> from global`:**

  ```css
  /* styles/animations.css — a plain global sheet, NOT a module */
  .kf-pulsering { animation-name: pulsering; }

  /* Splash.module.css */
  .ringOuter {
    composes: kf-pulsering from global;   /* must be the first declaration */
    animation-duration: 6s;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }
  ```

  ```css
  /* emitted: two classes on the element, name supplied by the global one */
  .Splash-module__ringOuter{…;animation-duration:6s;animation-timing-function:ease-in-out;…}
  .kf-pulsering{animation-name:pulsering}
  ```

  **Why the indirection works when a direct reference in the same file does
  not:** `composes` does not write a name into the module at all — it adds a
  second class to the element, and the name is declared in `animations.css`,
  which is not a module and so is never rewritten. The module keeps only the
  timing values, which the compiler has no reason to touch.

  **Longhands, never the shorthand.** `animation: 6s ease-in-out infinite` with
  the name omitted resets `animation-name` to `none` and undoes the composed
  class. That is why the timing is spelled out property by property.

  There is no per-declaration escape hatch: `:global(name)` in a value position
  fails to parse (`CssSyntaxError: Double colon`), and `:global .foo {}` works
  only by making the class global too.

  **Detection — do not trust computed style.** `getComputedStyle` reports
  `animationName: "Splash-module__pulsering"` and `animationPlayState: "running"`
  for an animation that does not exist. The only reliable tell is
  **`element.getAnimations().length === 0`**.

  **Scope when found (2026-08-17)**, from the live site, reported as "the splash
  has no motion" — it had none. **16 declarations, every one shipped**, across
  three tickets: 14 in `Splash.module.css` (PF-78), 1 on the navbar's CONTACT
  pill (`glowpulse`, PF-79), 1 on `Marquee`'s track (`marq`, PF-74). All 16
  fixed in `e087712`; the splash is 14 of them at discovery and 12 today, since
  the two scan lines were later removed. Guarded by
  `styles/__tests__/animations.test.js`, which fails on any module naming a
  keyframe and prints the offending file — confirmed by mutation.

  **This is the second global-stylesheet interaction to fail silently in Sprint
  11**, and the pair is worth reading together: here a global `@keyframes` that
  a scoped rule could not reach, and in PF-79 a global `motion.css` rule that
  could not reach the root element (see the `html[data-motion="reduced"] *`
  entry below). Both were correct-looking CSS that simply never applied. When a
  rule spans the module/global boundary, verify it in a browser rather than by
  reading it. (Distinct from the `tokens.css`-after-`global.css` ordering rule
  in Locked decisions — that one is global-vs-global cascade order, no modules
  involved.)
- **⚠️ A bare `transition:` on a `Reveal`-wrapped element silently eats the
  entrance easing.** Found independently **twice** — `.rolePill` (PF-80) and
  `.statCard` (PF-81) — before anyone wrote it down, which is why it is a
  standing rule here rather than a note inside one section's entry.

  `Reveal` puts its own class on the element it renders and drives the
  entrance with `transition`. A section class on that same element declares
  a hover `transition`. **One element, one `transition` property — they
  cannot merge, so one wins outright.**

  **The wrong pattern**, which looks completely ordinary:

  ```css
  /* AboutSection.module.css */
  .statCard { padding: 22px 18px; transition: border-color .25s, transform .25s; }
  .statCard:hover { border-color: var(--acc); transform: translateY(-4px); }
  ```

  **What it silently produces.** `.statCard` is (0,1,0). `Reveal.module.css`'s
  `.reveal` is also **(0,1,0)** — an exact tie, broken by stylesheet order,
  and a section module is emitted after `Reveal`'s. So the section wins and
  the element's transition becomes `border-color .25s, transform .25s`.
  `Reveal`'s `opacity .85s / transform 1.05s cubic-bezier(.16,1,.3,1)`
  entrance is **gone** — the card still appears, because `opacity` and
  `transform` still change, but it snaps in over 0.25s on the wrong curve
  instead of easing over 1.05s. Nothing errors. Nothing fails a test. It
  reads as "the reveal animation looks a bit off", which is exactly how
  both prior occurrences were found: in a browser, by eye.

  **THE RULE — never declare a `transition` on a `Reveal`-wrapped element.
  Not gated. Not at all.** Settled in PF-93 (2026-08-21) after the previous
  remedy shipped broken on four elements. Delete the declaration; `Reveal`
  already owns the property and keeps owning it after the entrance, so a
  hover lift eases for free.

  **⚠️ THE GATE THIS FILE TAUGHT FROM 2026-08-17 TO 2026-08-21 DOES NOT
  WORK.** It was:

  ```css
  .statCard[data-reveal='in'] {          /* (0,2,0) — beats .reveal outright */
    transition: border-color .25s, transform .25s;
  }
  ```

  The specificity arithmetic is right and the premise underneath it was
  wrong. This file claimed `Reveal` sets `data-reveal="in"` "at the moment
  the entrance completes". It does not: `setRevealed(true)` fires from the
  IntersectionObserver callback the moment the element **intersects** —
  `Reveal.jsx:57`, the *start* of the entrance. It has to, because
  `.reveal[data-reveal='in']` is `opacity: 1; transform: none`, i.e. the
  state being transitioned **to**; an attribute set at completion could not
  drive the entrance at all.

  So the gate matched immediately and each element animated its ENTRANCE on
  the hover values. Measured in Chromium on the production build, sampled
  from the frame `data-reveal` flipped to `in`:

  | element | opacity reaches 1 | transform settles | should be |
  | --- | --- | --- | --- |
  | About `.statCard` | **0ms** | **283ms** | ~733ms / ~700ms |
  | Skills `.card` | **0ms** | **300ms** | ~750ms / ~700ms |
  | Hero `.rolePill` | **0ms** | **448ms** | ~700ms / ~1017ms |
  | Hero `.loudCta` | **0ms** | **301ms** | ~550ms / ~867ms |
  | Projects `.card` *(never gated)* | 766ms | 732ms | — control |

  **`opacity` reaching 1 at 0ms means those elements did not fade in at
  all** — `opacity` was in none of the hover lists, so it had no transition
  whatsoever and jumped. The right-hand column is the same measurement
  after PF-93 deleted all four gates; the control row is byte-identical
  before and after, which is what proves the deletion touched nothing else.

  **Why deletion is the right remedy and not merely the easy one — the
  prototype does exactly this.** `hideReveals()` (line 950) writes

  ```js
  el.style.transition = 'opacity .85s cubic-bezier(.16,1,.3,1), transform 1.05s cubic-bezier(.16,1,.3,1)';
  if (t === 'pop') el.style.transition = 'opacity .5s ease, transform .9s cubic-bezier(.34,1.56,.4,1)';
  ```

  as an **inline** style on every `[data-reveal]` element, and `showEl()`
  (line 966) changes only `opacity` and `transform` — it never clears it.
  Grepped: exactly **four** `style.transition` writes in the whole script,
  three of them in `hideReveals()` and the fourth in a safety net that
  fires at `1700ms + delay` and only when the element is still under 0.9
  opacity, i.e. only when transitions were blocked outright. So one
  declaration covers the entrance and every later property change on that
  element for the life of the page. Declaring none in CSS reproduces that,
  because `.reveal` never leaves the element either.

  **Consequence to record rather than "fix": hover `border-color`,
  `background` and `box-shadow` all SNAP,** because only `opacity` and
  `transform` are in `Reveal`'s list. That is the design's behaviour, not a
  shortfall. Measured after the fix — `border-color` changes at 6-31ms on
  all four while the lift is still easing.

  **The values differ by `data-type`, and that is correct**, not drift:

  | type | inherits | used by |
  | --- | --- | --- |
  | `up` / `rise` / `left` | `opacity .85s`, `transform 1.05s cubic-bezier(.16,1,.3,1)` | `.statCard`, Skills `.card`, Projects `.card` |
  | `pop` | `opacity .5s ease`, `transform .9s cubic-bezier(.34,1.56,.4,1)` | `.rolePill`, `.loudCta` |

  Both sets are the prototype's own, from lines 954 and 962, and
  `Reveal.module.css` transcribes both correctly — verified in PF-93
  before deleting anything, since the deletion stops overriding whatever
  PF-74 wrote and would have made a PF-74 error look like PF-93's.

  **Not every element with a `transition` is wrong — only Reveal-wrapped
  ones.** A class that is never passed to a `<Reveal>` has nothing
  supplying it a transition and must keep its own. Both cases are live:

  | | Reveal-wrapped? | declares a transition? |
  | --- | --- | --- |
  | Skills `.card`, About `.statCard` | yes | **no** — Reveal owns it |
  | Skills `.pill`, Projects `.techPill` | no | **yes** — prototype lines 256/325 |
  | `patterns.module.css` `.pill` | either | `:not([data-reveal])` only |
  | Projects `.bigCard` | **no** (its parent grid is) | no — so its hover **snaps** |

  That last row is the prototype's own asymmetry, not an oversight: its big
  card (line 318) carries no `data-reveal`, so `hideReveals()` never
  reached it and its hover snaps, while the small cards (line 357) are
  wrapped and ease over 1.05s. Measured after PF-93: big card
  `transition: all 0s`, jumps to `-8px` at 7ms; small card eases to `-8px`
  over the 1.05s curve.

  **`patterns.module.css`'s `.pill` keeps exactly one selector**, and the
  `:not()` is the whole of it:

  ```css
  .pill:not([data-reveal]) {   /* (0,2,0) — a pill used as an ordinary button */
    transition: color .2s, border-color .2s, background .2s, transform .2s;
  }
  ```

  Deleting all three selectors would have traded one silent failure for
  another: a plain pill has no `data-reveal` attribute and nothing else
  animating it, so it would lose its hover transition entirely. The two
  `[data-reveal='in']` selectors that used to sit beside it were the
  pre-emptive version of the broken gate; they never had a consumer, so
  nothing was visibly wrong — but a shared file teaching the wrong pattern
  is how it would have spread.

  **Detection.** `getComputedStyle(el).transitionDuration` during the
  entrance reads the hover value instead of `1.05s`. Under Vitest this is
  invisible — CSS Modules are compiled but no stylesheet is applied
  (`document.styleSheets.length === 0`) — so assert the stylesheet as text,
  and **parse it with `postcss` rather than searching raw text**: every
  assertion here searches for a string that also appears in the comment
  explaining the deletion. See the raw-text-matching-a-comment entry.

  **Guarded five ways since PF-93, all mutation-tested in both directions:**

  | guard | file |
  | --- | --- |
  | `.statCard` declares no `transition`, at any selector | `AboutSection.test.jsx` |
  | `.card` declares no `transition`, at any selector | `SkillsSection.test.jsx` |
  | `.rolePill` / `.loudCta` declare no `transition` | `HeroSection.test.jsx` |
  | `.pill` has exactly one transition rule, and it is the `:not()` | `patterns.test.js` |
  | **no Reveal-wrapped class anywhere declares one** | `styles/__tests__/revealTransition.test.js` |

  The last is the one that matters long-term, and it is structural rather
  than a list: it reads every `components/**/*.jsx`, extracts the local
  class names actually passed to a `<Reveal>`, and walks the sibling
  module for a `transition*` declaration on any of them — so a NEW element
  in a NEW section fails it without anyone remembering to add a guard. It
  also asserts it found >20 pairs, because a broken scanner reports "no
  offenders" exactly like a clean tree does. A sixth guard in the same file
  pins `[data-reveal='in']` to the single legitimate rule that defines it,
  `Reveal.module.css`'s own end state.

  Each `:hover` **end state** is separately guarded too, so the deletion
  cannot be over-applied into removing the hover treatment itself:
  `-4px` / `-6px` / `-2px`, re-read from prototype lines 216, 253 and 102.
- **`rgba(#hex, .5)`** → invalid, produces nothing. The five channel triplets
  (`--gnd --srf --ln --ftr --shd`) must stay as bare `R,G,B`
- **Redefined `@keyframes` of the same name** → later definition wins by
  document order
- **Connection string with no database path** → driver silently defaults to a
  database named `test`. **This already happened here**, and it is the
  reason this project's live database was called `test` for six weeks.
  The mechanism is unchanged, and is still why `assertExplicitDatabase`
  exists (PF-66) — but **this project's inventory has moved, and every
  name below the mechanism changed on 2026-08-31.**

  **⚠️ CORRECTED 2026-08-31 — PRODUCTION IS `portfolio_prod`, LOCAL
  DEVELOPMENT IS `portfolio_dev`, AND `portfolio` NO LONGER EXISTS.**
  Full account in Infrastructure above. The current inventory, read live
  with `db.adminCommand("listDatabases")` after the drops:

  | database | what it is |
  | --- | --- |
  | **`portfolio_prod`** | **PRODUCTION** — what the deployed API serves |
  | `portfolio_dev` | local development (`backend/.env`) |
  | `portfolio_test` | the backend Jest suite's wipe target |
  | `portfolio_e2e` | Playwright fixtures only |
  | `test` | **the pre-rename production database**, frozen, kept as a rollback until ~2026-09-14 |
  | `admin` · `local` | Atlas system databases |

  **Seven, not six.** `portfolio`, `portfolio_scratch` and `sample_mflix`
  were dropped on 2026-08-31 and are gone.

  ⚠️ **`test` still exists and is no longer production.** Anything
  pointed at it reads a frozen 2026-08-31 snapshot that silently stops
  matching the live site the moment anyone edits anything. That is the
  exact inverse of what the original entry warned about, so the warning
  has to be **re-read rather than remembered** — a session recalling
  "`/test` is the correct one" from this file is recalling something that
  was true and is now the bug.

  ~~**⚠️ RE-CONFIRMED 2026-08-29/30, AND THIS SHOULD NEED NO FOURTH
  CHECK.**~~ — **superseded 2026-08-31, one day later.** Kept visible
  rather than deleted, because the framing is the instructive part: it
  declared a question permanently closed on the strength of having
  answered it three times, and what actually closed it was **changing the
  answer**. "Asked and answered repeatedly" is evidence about how
  confusing a question is, never about how settled it is. The original
  account, accurate as of 08-29/30:

  > `backend/.env`'s `MONGO_URI` ends in `/test`, and that database is the
  > **live, correct one**: 7 collections, newest docs 2026-08-09. A
  > `portfolio` database also sits on the same cluster and is an abandoned
  > copy from 2026-07-18 with only 5 collections — no `vocabularies` (32
  > docs), no `contacts`. Repointing the URI at `/portfolio` to make the
  > name look right therefore rolls the site back three weeks and drops
  > two collections, and the app reports nothing either way. The owner
  > decided on 2026-08-18 to leave the name alone rather than migrate a
  > live cluster.
  >
  > | database | collections | contacts | what it is |
  > | --- | --- | --- | --- |
  > | **`test`** | 7 | **3** | **PRODUCTION** — what the deployed API serves |
  > | `portfolio_e2e` | 7 | 52 | Playwright fixtures only |
  > | `portfolio_test` | 4 | 0 | the backend Jest suite's wipe target |
  > | `portfolio` | 5 | — | abandoned 2026-07-18 copy |
  > | `portfolio_scratch` | 6 | — | dead |
  > | `sample_mflix` | 6 | — | Atlas sample data, dead |

  **Two things from that account SURVIVE the restructure**, so do not
  discard them with the rest:

  - ⚠️ **`portfolio_test` is still the easy one to miss** when listing
    "the databases to deal with", because nothing but `npm test`'s URI
    rewrite ever names it.
  - ⚠️ **"Test Recruiter" — the E2E fixture's name — reached the
    production data at some point**, and that row is now in
    `portfolio_prod`. The old entry noted the guard could not have
    prevented it: `global-setup.js:16` tests
    `/e2e|test/i.test(database)`, and **`test` matched that pattern.**
    ⚠️ **The rename incidentally closed the hole** — `portfolio_prod`
    does **not** match, so the guard that would have waved an E2E run
    through against `test` now refuses one against `portfolio_prod`.
    Verified by reading the regex, not inferred from the name.

  ⚠️ **And one claim from it is now FALSE: "there is no genuine visitor
  mail in production."** `contacts` went **2 → 3** between the 2026-08-29
  backup and the 2026-08-31 dump, and the new row is a real submission.
  **Production mail is no longer disposable**, and anything written on
  the old assumption — including "delete the PF-92 gate row through the
  admin panel" — now needs to distinguish the rows rather than clear the
  collection.
- **Inline custom property on `<html>`** → beats the `html[data-theme]` block in
  the cascade, so every subsequent edit to `tokens.css` becomes dead code. The
  page renders a stale value and nothing you change has any effect. Never write
  inline styles to `documentElement` — set `data-theme` and nothing else.
  Guarded by a test in `frontend/src/utils/__tests__/theme.test.js`.
- **A full-screen overlay with no occlusion awareness** → `IntersectionObserver`
  and geometric sweeps both measure position, never what's painted on top.
  Without a splash-readiness gate, every above-the-fold `Reveal`/`CountUp`
  finishes animating in while the splash still covers the screen — by the time
  it lifts, the entrance already happened and the hero looks static. No error,
  no failed test if the test doesn't mount a splash; it just looks like the
  hero's animation silently doesn't work. **Guarded since PF-75** — `Reveal` and
  `CountUp` both gate their observer effect on `useSplashReady()`, and **live
  since PF-78** — `HomePage` passes `initialReady={false}` whenever a splash is
  showing. Note the gate has nothing to gate yet: no section uses `Reveal` or
  `CountUp` on the page today, so PF-80's hero is the first place a regression
  here would actually be visible. `Splash.test.jsx` mounts a real `Reveal`
  beside the splash to hold the contract until then; removing `!splashReady`
  from `Reveal.jsx` fails that test, verified by mutation.
- **Prototype line 834 reads an undeclared `acc`** → transcribe it as
  `self.accColor`, which its two siblings (lines 806, 816) already use. `acc`
  appears exactly once in the whole script block, as a read, never a
  declaration — so it throws a `ReferenceError` once per frame whenever the
  cursor nears a star. The loop survives only because `requestAnimationFrame`
  re-arms on the first line of the body, before the throw; the cost is the
  cursor dot never painting and the trailing `globalAlpha = 1` reset being
  skipped, leaving alpha at `.3` for the next frame's nebula pass. Verified
  against `docs/design/Portfolio Revolution.dc.html` on 2026-08-16. This is the
  first known case of the prototype being wrong, and it is a JS bug, not a
  design value — "the prototype wins" still holds for everything visual.
- **Grain's `0.42` opacity looks like a bug and is not.** `GrainOverlay`'s two
  effects are ordered so the theme one (`.13`/`.45`) runs first on mount and the
  paint one overwrites it with `0.42` immediately after. That is the prototype:
  `componentDidMount()` calls `applyTheme(t0)` at line 881 and `paintGrain()` at
  884, and `paintGrain()` sets opacity unconditionally. So `0.42` is the real
  resting value from first load until the user's first theme toggle, in **both**
  themes — not a flash. React runs effects in declaration order, so reordering
  the two effects in that file silently changes the shipped look. Verified in a
  browser on 2026-08-16, including a fresh load already in light theme. Guarded
  by `GrainOverlay.test.jsx`. PF-75's original comment in that file claimed the
  opposite; PF-77 corrected it.
- **`el.style.opacity` reads back normalised, not as written.** The CSSOM
  canonicalises, so a component writing the prototype's `'.13'` verbatim reads
  back as `'0.13'`. A test asserting the source string fails against correct
  code. Assert the effective value; keep the verbatim write in the component.
- **CSS-Module rules are invisible to Vitest.** `frontend/vite.config.js` sets
  no `test.css`, so CSS Modules are stubbed and no stylesheet is ever applied in
  jsdom — `getComputedStyle` reports initial values and `element.style` sees
  only inline writes. A test asserting a class-declared value (`CursorGlow`'s
  resting `opacity: 0`) passes or fails for the wrong reason. Assert the
  stylesheet as text, as `styles/__tests__/tokens.test.js` does, and assert the
  DOM only for what JS actually writes inline.
- **⚠️ A raw-text CSS assertion can match a COMMENT instead of the rule.**
  This is the direct cost of the entry above: it tells you to assert the
  stylesheet as text, and text includes the prose. This codebase documents
  its CSS heavily — removed prototype values are preserved in comments, and
  gates explain their own specificity — so the exact string a test searches
  for is very often sitting in the comment *explaining* the rule.

  **What it produces is the worst possible failure shape: a test that
  reports PASS while asserting nothing.** Not a false negative that nags —
  a false *positive* that reassures. It survives review, it survives
  re-reading the test, and it is invisible to coverage, because the
  assertion genuinely ran and genuinely passed.

  **The wrong pattern**, both directions:

  ```js
  // negative — the comment says the thing is absent, so the check "passes"
  expect(css).not.toContain('composes: kf-');   // matched  "⚠️ No `composes: kf-*` in this file"
  expect(rule).not.toContain('gradient');       // matched  "the prototype paints radial-gradient(…)"
  expect(bridge).not.toMatch(/#[0-9a-f]{6}/i);  // matched  "Phase 1's indigo #818cf8 measures 2.44:1"

  // positive — indexOf lands in the comment, and the slice from there
  // contains every selector the comment lists, so all three toContain pass
  const i = css.indexOf(".pill:not([data-reveal])");
  const rule = css.slice(i, css.indexOf('}', i));
  ```

  **Fix A — strip comments before searching.** Cheap, and what this repo
  uses:

  ```js
  const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  ```

  **Fix B — parse instead of searching.** Immune rather than defended,
  because comments are a distinct node type a declaration walk never
  visits. `postcss` is already present (8.5.26, a Vite dependency) so this
  costs no new install:

  ```js
  import postcss from 'postcss';
  const root = postcss.parse(css);
  root.walkRules((rule) => rule.walkDecls((d) => /* d.prop, d.value */));
  ```

  Verified on `patterns.module.css`: the walk skips **13** comment nodes
  and returns the gated selector list exactly, while the equivalent regex
  over raw text is the thing that misfires.

  **⚠️ "Use the CSSOM" does not mean `document.styleSheets` here.** Under
  Vitest that array is **empty** — `document.styleSheets.length === 0`,
  measured, because no stylesheet is ever applied (see the entry above).
  Reaching for the browser CSSOM yields an assertion over nothing at all,
  which is the same failure again by a different route. Parse the file.

  **Occurrences.** Far more than the "third time" an earlier note in
  `patterns.test.js` claimed — that count was wrong and is corrected here.
  **Eight test files carry a comment-stripping workaround**, the earliest
  predating this sprint entirely:

  | Test file | Introduced by |
  | --- | --- |
  | `styles/__tests__/keyframes.test.js` | `5be0e66` PF-69 |
  | `components/ambient/__tests__/CursorGlow.test.jsx` | `9ad74c0` PF-77 |
  | `styles/__tests__/motion.test.js` | `060244a` PF-79 |
  | `styles/__tests__/animations.test.js` | `e087712` (keyframe-reference fix) |
  | `components/sections/__tests__/SkillsSection.test.jsx` | PF-82 — **two** sites |
  | `components/sections/__tests__/HeroSection.test.jsx` | PF-82 follow-up |
  | `styles/__tests__/tokens.test.js` | PF-82 follow-up |
  | `styles/__tests__/patterns.test.js` | PF-82 follow-up |

  The first four already had the strip when written, so it is not knowable
  from the code whether those authors hit the trap or anticipated it. The
  last four are **confirmed blind guards** — five of them, every one caught
  by mutation testing rather than by reading, and two in `patterns.test.js`
  alone on a single rule. That is the real lesson: **this trap is not
  detectable by inspection.** A guard written against raw text must be
  mutated before it is trusted, or written with Fix B so there is nothing
  to trust.
- **`border-radius` inside a `:focus-visible` rule reshapes the ELEMENT, not
  the ring.** Outlines already follow the element's own border curve in every
  current engine, so a radius declared alongside `outline` does not round the
  ring — it overwrites the element's own radius, but only while focused. The
  PF-83 ticket's sketch carried `border-radius: 4px`; against this project's
  `999px` pills (navbar CONTACT and ADMIN, the theme toggle, both hero CTAs)
  that squares them off the instant they take keyboard focus. Invisible to a
  mouse user, invisible in review, and it reads as a rendering glitch rather
  than a stylesheet bug. Omit it; the ring inherits the right shape for free.
  Verified in Chromium — all four report `borderRadius: 999px` while focused.
  Guarded by `styles/__tests__/tokens.test.js`.
- **`document.body.focus()` is a silent no-op in jsdom**, because `<body>` is
  not focusable. A test that uses it to simulate "focus has escaped this
  container" does not move `activeElement` at all, so it silently asserts a
  different case than the one it names — and can fail against perfectly
  correct code, which is how it presents. Found writing PF-83's focus-trap
  escape test. Use `document.activeElement.blur()`, which genuinely resets
  `activeElement` to `<body>`.
- **⚠️ `link.firstElementChild === svg` DOES NOT TEST ORDERING, and it
  reads exactly like it does.** Found by mutation on 2026-08-29, on four
  guards written the same way in the same hour.

  The natural way to assert "the icon is in FRONT of the label" is:

  ```js
  const svg = link.querySelector('svg');
  expect(link.firstElementChild).toBe(svg);   // asserts nothing of the kind
  ```

  **`firstElementChild` skips text nodes by definition**, and the label
  beside the icon *is* a text node. So the assertion passes just as
  happily with the icon after the label — it only ever proves the icon
  is the first ELEMENT, which is trivially true whenever it is the only
  element. Measured: moving `<GitHubIcon />` behind `VIEW ON GITHUB →`
  left the guard green, and the same held for About, Contact and the
  footer.

  It is the vacuous-assertion shape again — a test that reports PASS
  while asserting nothing — but arriving through the DOM API rather
  than through a comment match, which is why it earns its own entry
  beside the raw-text one.

  **The fix — walk `childNodes`, ignore whitespace-only text, and ask
  whether the first MEANINGFUL node is the icon.** It lives in
  `frontend/src/test/leadsWithIcon.js`, shared by all four files rather
  than copied per-file like `localName`/`pick`: it is the assertion
  itself that is subtle, so one place to read the reason is worth more
  than the usual duplication.

  ```js
  const first = [...link.childNodes]
    .find((n) => n.nodeType !== Node.TEXT_NODE || n.textContent.trim() !== '');
  return first === icon;
  ```

  Confirmed by mutation in both directions on all four call sites.
  **The generalisable bit: any `*Element*` DOM accessor silently filters
  out text**, so it cannot answer a question about where text sits.
  `firstElementChild`, `children`, `nextElementSibling` and
  `previousElementSibling` are all wrong instruments for "is this before
  the label".

- **A `[class*="name"]` test selector silently matches longer class names.**
  Distinct from the entry above about stylesheets, and easy to conflate with
  it. That one still holds exactly — verified again in PF-82,
  `document.styleSheets.length` is **0** under Vitest and a module's rules
  are never applied. But the *class names* are real: Vitest scopes them to
  `_<local>_<hash>` (e.g. `_pill_f5cf21`), so `querySelector` works, and the
  substring form every section test uses is only safe while no local name is
  a prefix of another. PF-82 has two that are — `pill`/`pillRow` and
  `card`/`cardPlaceholder` — and `[class*="pill"]` counted 31 pills where
  there were 26, while `[class*="card"]` counted loading placeholders as
  real cards. Both read as component bugs. `[class~="pill"]` does not fix
  it either: the token is `_pill_f5cf21`, not `pill`. `SkillsSection.test.jsx`
  unwraps the local name and compares it exactly, handling both Vitest's
  template and `vite.config.js`'s own `[name]__[local]`.
- **A shared mutable test fixture disarms the guard that watches it.**
  `SkillsSection.test.jsx` had a module-level `SKILLS` array and a test
  asserting the component does not sort its input in place. Mutation testing
  showed the pair was **blind**: the mutant sorted `SKILLS` during the first
  test in the file, so by the time the dedicated check ran, its input was
  already sorted and nothing was left to detect — a clean PASS on a real
  defect. Running that one test alone caught it; running the file did not,
  which is the worst shape for this to take. Fixed by `Object.freeze`-ing
  the fixture, which turns every render in the file into a guard: the same
  mutant now fails 13 tests instead of 0. Worth generalising — any test
  fixture shared across cases should be frozen, and any "does not mutate"
  assertion should be mutation-tested with the **whole file**, not with
  `-t`.
- **⚠️ A green test suite actively hides dead code — it does not merely fail to
  catch it.** This is the sharper version of the usual "tests don't prove much"
  caveat, and it is worth reading twice: a module's own test file keeps
  reporting PASS forever after its last consumer disappears, because the test
  imports the module directly. The suite therefore says *alive* about code
  nothing in the app reaches, with **zero signal** that anything changed. Test
  count goes up, not down. Nothing turns red. Coverage still counts the lines.

  **Live example, created by PF-80 and left in place deliberately.** Replacing
  the Phase 1 `HeroSection` orphaned two Phase 1 modules, which were its only
  consumers:

  | Module | Consumers | Own tests | How it presents |
  | --- | --- | --- | --- |
  | `hooks/useTypewriter.js` | **0** | `hooks/__tests__/useTypewriter.test.js` — **4 passing** | reads as healthy, tested code |
  | `components/common/TerminalWindow.jsx` | **0** | none | invisible; nothing mentions it at all |

  Two different failure shapes from one cause, and `useTypewriter` is the
  dangerous one: a cleanup sweep looking for untested or unreferenced files
  finds `TerminalWindow` and walks straight past `useTypewriter`, because the
  green test looks like evidence of use. It is evidence of nothing but the test.

  **Both were left in the tree on purpose, and BOTH ARE NOW DELETED —
  PF-89, 2026-08-26**, along with `useInView`, which became the same shape
  after PF-87. Deleting Phase 1 code was cutover work rather than PF-80's:
  the Phase 1 sections around them were still mounted in `HomePage.jsx`
  until PF-81/82 replaced them. **"Not deleted" meant "noticed and
  deferred", not "missed"** — and the deferral lasted six days for the
  code and **nine** for `useTypewriter`'s tests, which kept reporting
  four passes the whole time.

  **The lesson stands whole and is why this entry is kept.** Re-check
  consumer counts before deleting — grep for the identifier and discount
  the module's own file and its own test, which is exactly the discount
  that makes the count look non-zero if skipped. PF-89 ran that grep on
  five candidates and it changed two verdicts: `apiUrl` was on the orphan
  list and had a live consumer, `useInView` was not on the list and had
  none.

  ⚠️ **The replacement for a hand-maintained orphan list is
  `styles/__tests__/cutover.test.js`**, which fails if any of the three
  is reintroduced. A list in prose drifts in both directions; a scanner
  does not. Do not re-import them — the Phase 2 hero has no typewriter
  (see the PF-80 entry on `typeLoop()`/`ROLES`), and the Phase 2 terminal
  panel is a deliberate non-port of `TerminalWindow` (see PF-85).
- **A design image referenced by URL 404s in silence.** `docs/design/assets/` is
  not served by anything — it is design reference, outside the Vite root — and
  `frontend/public/` holds only `favicon.svg` and `icons.svg`. A ticket saying
  `src="/assets/logo.png"` renders a broken image with no error. **Copy the
  asset into `frontend/src/assets/` and `import` it** (established in PF-78,
  which added that directory and `logo.png`): Vite emits it hashed, and a path
  that does not resolve fails the build loudly instead of shipping a hole.
  **PF-79's ticket carried this exact mistake** (`src="/assets/logo.png"` for
  the navbar logo), so it is a live trap, not a historical one.
- **`html[data-motion="reduced"] *` never matches `<html>` itself.** It is a
  descendant selector, so `motion.css`'s universal rule reaches everything
  *inside* the root element and not the root element. That mattered exactly
  once and badly: the document's scrolling box takes `scroll-behavior` from the
  root, so `html { scroll-behavior: smooth }` escaped the reduced-motion
  override entirely — `data-motion="reduced"` was set, every descendant was
  neutralised, and anchor jumps still animated. Found in a real browser during
  PF-79 (`getComputedStyle(document.documentElement).scrollBehavior` read
  `'smooth'` with reduced motion active); PF-79 added a second rule targeting
  the root itself. Nothing else in that file needs the same treatment —
  animation and transition are only ever declared on descendants — but any
  future property that lives on the root does. Guarded by
  `styles/__tests__/motion.test.js`, added in PF-79.
- **A `var()` inside an `@supports` condition makes the condition answer
  `true` without testing anything.** Per CSS Conditional Rules, a declaration
  whose value contains a top-level `var()` reference is *assumed valid* — the
  browser cannot resolve custom properties at parse time, so it does not try.
  `@supports not (-webkit-text-stroke: 1px var(--acc))` therefore evaluates the
  inner test as true and the `not` as false **even on an engine that cannot
  paint the property at all**, which is the exact and only case the fallback
  exists for. The rule is syntactically perfect and silently never applies.
  Worse than most entries here: you cannot observe it on any engine you have,
  because on a supporting engine the correct answer is also "don't apply".
  Keep `@supports` conditions var()-free and put the token in the rule body.
  Found while writing PF-81's outline-type fallback; guarded by
  `styles/__tests__/patterns.test.js`.
- ~~**A bare `.section` class loses `scroll-margin-top` to Phase 1's
  `[id]` rule.**~~ — **THE RULE IS GONE, deleted in PF-89
  (2026-08-26).** `global.css` no longer declares any
  `scroll-margin-top`, so the tie described below cannot happen any
  more and a new section written with a bare `.hero { … }` would
  simply work.

  ⚠️ **Keep writing `section.hero`, and the guard now enforces it.**
  Two reasons the habit outlives the trap: the qualified form is
  what all six sections carry today, so a bare one is a
  gratuitous inconsistency; and it is the only form that stays
  correct if any (0,1,0) `[id]`-style rule is ever reintroduced —
  which `global.css` still could, since it survives to the admin
  rebuild. `styles/__tests__/cutover.test.js` asserts both halves:
  no blanket `[id]` scroll-margin anywhere in `global.css`, and all
  six sections qualified by element name. Both mutation-tested.
  Original account below, kept because the specificity mechanism is
  the reusable part.

- **A bare `.section` class USED TO LOSE `scroll-margin-top` to Phase
  1's `[id]` rule.** `global.css:338` carries `[id] { scroll-margin-top: 5rem }` —
  specificity (0,1,0), *identical* to a single class, so the tie breaks on
  stylesheet order and the global rule wins. A section writing
  `.hero { scroll-margin-top: var(--header-h) }` therefore computes **80px, not
  71px**, and the anchor jump lands the content 9px low: the wrong-by-a-little
  value again, on screen, with nothing in the module looking wrong. Found in a
  browser during PF-80 (`getComputedStyle(section).scrollMarginTop` read
  `'80px'` with the module rule plainly present). Fix is to qualify with the
  element name — `section.hero { … }`, specificity (0,1,1) — which settles it
  outright. **Every section from PF-81 on needs the same treatment** until
  `global.css` is trimmed at cutover. Note a jsdom test cannot catch this:
  CSS Modules are stubbed under Vitest, so no cascade exists to lose.
- **Two stacked full-size layers: only the top one gets clicks.** A backdrop
  element under a full-viewport panel receives nothing, because hit-testing
  gives the click to the topmost box at that point. Neither `z-index: -1` nor
  ordering saves it — a negative-z child of a stacking context paints *behind
  its parent's own background* and is still not hit first. There is no error;
  the dismiss simply never fires. PF-79's overlay was built this way, and only
  a browser check caught it. See the mobile-nav locked decision for the shape
  that works.
- **⚠️ A single fallback error string collapsed "wrong password" and "no
  server" into one message — and the module that fixed it shipped
  undocumented.** Two separate problems, recorded together because the
  second is why the first was still missing from this file on 2026-08-19.

  `AdminLoginPage` used to build its message inline:

  ```js
  err.response?.data?.message || 'Invalid email or password. Please try again.'
  ```

  A backend that is simply **not running** produces no `err.response` at
  all, so the `||` fell through to the credential sentence. Connection
  refused, DNS failure, CORS rejection and timeout all rendered as *"Invalid
  email or password."* The only tell was the trailing "Please try again.",
  which the API never sends — `authController.js` replies with a bare
  `Invalid email or password` — so the **fallback string itself was the
  signal**, and it read exactly like a credential rejection. That cost a
  real debugging session on 2026-08-18: nothing was listening on 5050 and
  the form blamed the password.

  Fixed by `frontend/src/utils/loginError.js` — `loginErrorMessage(err)`,
  React-free like the rest of `utils/`, branching on *no response* (with
  `ECONNABORTED` split out), *401*, and *any other status*, so the three get
  three different sentences. Consumed at `pages/AdminLoginPage.jsx:29`, 6
  tests in `utils/__tests__/loginError.test.js`.

  **The documentation half.** That module landed inside `fbc983e`, the PF-81
  *About section* commit, under a message naming none of it — so nothing in
  this file mentioned it until PF-84 went looking. It is live, tested code
  that no session would have found by reading here. Note the failure shape
  is the mirror image of the dead-code entry above: there, a green test
  makes unused code look alive; here, a green test on **used** code still
  left it invisible, because discoverability runs through this file, not
  through the suite. When a fix rides along in someone else's commit, it
  gets documented or it effectively does not exist.
- **The CORS allowlist is exact-match, so a stale dev server silently breaks
  every admin API call.** `backend/src/config/corsOptions.js` allows exactly
  `http://localhost:5173`, `http://localhost:5174` and the Vercel URL. Vite
  does **not** fail when 5173 is taken — it increments to 5175, 5176, … and
  prints the new port in a line that is easy to skim past. The site then
  loads perfectly, because the static assets come from Vite itself; only the
  cross-origin API calls are rejected, and the rejection surfaces as a
  network error rather than as anything mentioning CORS. Combined with the
  entry above, that produced the 2026-08-18 session where a login failure
  was blamed on the password.

  Check before debugging anything API-shaped:
  `lsof -sTCP:LISTEN -nP -i:5173 -i:5174` — more than one Vite listening
  means the one in the browser is probably not the one on 5173. Widening the
  allowlist to a dev port range removes the trap but is a security-posture
  change; it is on the Outstanding work list as a decision, not a fix.
- **`npm test` does not run the E2E suite, so a "full" local gate can be
  green while CI is red.** `frontend/package.json` keeps `test` (Vitest) and
  `test:e2e` (Playwright) as separate scripts, and nothing chains them. Any
  checklist that says "run the tests" therefore covers unit only unless it
  names `test:e2e` explicitly — the PF-84 ticket's own gate lists four
  commands and omits it, which is how Sprint 11 reached a green local gate
  and a red CI on the same commit.

  The failure mode is specific and worth recognising on sight: **unit green
  + E2E red almost always means a feature was REMOVED and its tests were
  not**, because unit tests import the module directly and keep passing
  after the last consumer disappears, while an E2E test drives the real page
  and cannot be fooled. Unit *red* means the opposite — code that is broken
  rather than gone. Sprint 11 hit the first: `useTypewriter`'s four unit
  tests are green today with zero consumers, and the E2E specs asserting the
  Phase 1 hero went red the moment PF-80 replaced it.

  Run five commands, not four — and name the SCRIPTS, not paths, so the
  gate cannot drift from CI (see the next entry):

  ```bash
  cd frontend && npx vitest --run
  cd frontend && npm run lint -- --max-warnings=0     # ci.yml line 88, verbatim
  cd frontend && npm run build
  cd backend  && npm test
  cd frontend && npm run test:e2e
  ```
- **⚠️ `npm run lint` used to cover `src/` ONLY, so config files at the
  frontend root were never linted — by the gate, by CI, or by anything.**
  Same shape as the entry above and worth reading beside it: there a
  green gate hid a removed feature, here a green gate hid a live syntax
  error, and both come from a command whose scope is narrower than the
  word "the tests" or "lint" implies.

  `package.json`'s script was `eslint src --ext .js,.jsx,.ts,.tsx` and
  CI runs `npm run lint -- --max-warnings=0`, so `playwright.config.js`,
  `vite.config.js`, `eslint.config.js` and all five `e2e/*.spec.js` were
  outside the path argument. Eight files, zero coverage.

  **⚠️ CI and the tickets AGREED — that is the part worth getting right,
  because the natural guess is the opposite.** `ci.yml` contains exactly
  **one** lint step (line 88) and the literal string `eslint` appears
  **nowhere** in it: CI runs the npm *script*, whatever the script says.
  So this was NOT the Sprint 11 shape where CI ran something the local
  gate didn't. CI ran `eslint src` too. The gate matched CI perfectly and
  they were both blind together, which is strictly harder to notice —
  a mismatch eventually shows up as a red CI on a green local run, and
  this never could.

  **It BECAME the Sprint 11 shape the moment the script changed.** With
  `"lint": "eslint ."`, CI is now wider than every ticket that says to run
  `eslint src`. The fix is not to re-narrow the script — it is to stop
  documenting a path at all:

  > **The gate's lint command is `npm run lint -- --max-warnings=0`**,
  > which is CI's line 88 verbatim. Name the script, never a path. A
  > documented path is a second source of truth that drifts silently the
  > next time the script changes; naming the script cannot drift, because
  > it *is* what CI runs.

  Every "run `eslint src`" in an older ticket is stale by exactly this
  much. Prefer the script.

  What it hid: `eslint.config.js` applied `globals.browser` to
  `**/*.{js,jsx}` with no Node block, so **every `process.env` read in a
  build config is a `no-undef` error**. `vite.config.js:19` has carried
  one since PF-70 (`29567ec`) and nobody saw it for ten days;
  PF-93 added two more in `playwright.config.js` and the full five-command
  gate still came back green. The only thing that surfaced any of it was
  the **IDE extension linting an open file**, which does not care what
  the npm script's path argument says.

  Fixed 2026-08-21, in three parts, because any one alone is a half-fix:

  | | |
  | --- | --- |
  | a Node-globals block for `*.config.js` and `e2e/**` | clears all 3 errors |
  | `.eslintignore` → `globalIgnores([…])` | its 8 patterns; the file was inert under ESLint 9 and `coverage/` would otherwise fail `--max-warnings=0` |
  | `"lint": "eslint ."` | the gate can finally reach them |

  Plus a fourth found by the widened scope itself: **`dist-*/` is
  ignored**, because this file's own live-verification recipe builds to
  `dist-verify/`. Without it, `eslint .` lints a 410 kB minified bundle
  and fails on `process is not defined` in rolled-up dependency code —
  i.e. following the documented verification steps would have broken CI
  for the next person. Verified to exit 0 **with `dist-verify/` present**,
  not merely after deleting it.

  Measured after: `npm run lint -- --max-warnings=0` exits **0** over
  **115** files, up from src-only, and the `ESLintIgnoreWarning` that
  printed on every run since ESLint 9 is gone. Mutation-tested — an
  undefined identifier added to `playwright.config.js` now exits 1; before
  the change the identical mutant passed.

  **⚠️ `.eslintignore` was DOUBLY inert, and the second half is the
  surprise.** Everyone knew ESLint 9 stopped reading it. What that means
  concretely is that **seven of its eight patterns were ignoring nothing
  at all** — only `dist` was live, and only because `globalIgnores(['dist'])`
  named it separately. Measured by restoring the HEAD configuration and
  asking ESLint directly, via `new ESLint().isPathIgnored()`:

  | path | at HEAD | now |
  | --- | --- | --- |
  | `dist/x.js` | IGNORED | IGNORED |
  | `coverage/block-navigation.js` | **LINTED** | IGNORED |
  | `build/main.js` | **LINTED** | IGNORED |
  | `public/vendor.min.js` | **LINTED** | IGNORED |
  | `dist-verify/assets/index-abc.js` | **LINTED** | IGNORED |

  It never showed because the script only looked at `src/`. The two
  defects were hiding each other: the dead ignore file had no consequence
  while the scope was narrow, and the narrow scope looked harmless while
  nothing needed ignoring. Widening the scope alone would have failed CI
  on `coverage/`; deleting the ignore file alone would have changed
  nothing. That is why the fix is four parts, not one.

  `isPathIgnored()` is the right instrument for any question of this
  shape — it answers per path, with no files created and no output to
  parse, where "did it appear in the report?" cannot distinguish *ignored*
  from *clean* from *never looked at*.

  **The general lesson is about path arguments, not ESLint.** A tool
  invoked with an explicit path lints exactly that path, and a file's
  absence from the report is indistinguishable from a clean file. Check
  what a gate command actually covers before trusting "lint: exit 0" —
  `npx eslint . --format json` and count the files.
- **Playwright's `toBeVisible()` ignores occlusion, so a full-screen overlay
  does not hide anything from it.** Visibility is a non-empty bounding box
  plus a non-`hidden` `visibility` — not "a user could see this". An element
  completely covered by the splash (z-index 100) still passes
  `toBeVisible()`, and an element at `opacity: 0` mid-`Reveal` does too.

  Two consequences, both live in this repo:
  - **A stale content assertion fails with "element(s) not found", not a
    timeout** — which is the useful tell that the text genuinely changed
    rather than merely arrived late.
  - **`click()` is the opposite**: actionability *does* hit-test, so a click
    under the splash retries until it unmounts, silently adding ~5.65s to
    every test rather than failing. That is a slow suite, not a red one, so
    nothing draws attention to it. `e2e/homepage.spec.js` loads
    `/?nosplash` in `beforeEach` for this reason; the splash gets its own
    two tests on a plain `/`.

- **⚠️ The prototype's reveal transition is INLINE and PERMANENT, so
  "the stylesheet declares no transition" does not mean "it snaps".**
  Found in PF-85 while implementing a ticket instruction to "implement
  the snap", which would not have produced one.

  `hideReveals()` (line 950) writes
  `el.style.transition = 'opacity .85s …, transform 1.05s …'` onto **every**
  `[data-reveal]` element, and `showEl()` (line 966) only changes `opacity`
  and `transform` — it never clears the transition. The sole place it is
  cleared is a safety net that fires at `1700ms + delay` and only if the
  element is still under 0.9 opacity, i.e. only when transitions were
  blocked outright.

  So a revealed element keeps that transition for the life of the page, and
  **any later property change on it eases rather than snaps** — including a
  `:hover` transform. The consequence for project cards, measured on the
  production build:

  | | `data-reveal`? | hover lift |
  | --- | --- | --- |
  | big card | no — its parent GRID carries it (line 317) | **snaps**, `transition-duration: 0s` |
  | small cards | yes (line 357) | **eases over 1.05s** |

  Measured: the small card reads `-0.157px` at 80ms after hover and `-8px`
  at 1480ms. That asymmetry is the design's, not a porting bug, and PF-85
  reproduces it by declaring no `transition` on either card.

  **The general rule: to know whether a prototype element animates, check
  its JS as well as its inline `style`.** A `style-hover` attribute with no
  `transition:` in the markup still eases if the element is a reveal target.
- **⚠️ Playwright's `reuseExistingServer: true` will adopt a STALE dev
  server, and the suite then tests the wrong database.** Cost two E2E
  failures in PF-85's gate that looked exactly like a regression.

  `playwright.config.js` starts two servers, the E2E backend on 5055
  (`portfolio_e2e`) and a frontend on 5174, both with
  `reuseExistingServer: true`. If anything is already listening on 5174 it
  is used **as-is, with whatever environment it was launched with**. A
  stray `npm run dev` lands there automatically, because Vite increments
  past a taken 5173 — the same port-hopping behaviour the CORS entry above
  describes.

  What that produces: the adopted server serves
  `VITE_API_URL: "http://localhost:5050/api"` from `.env.development`
  instead of the injected `:5055`, so the suite drives the real page
  against the **development** backend. Everything renders, every homepage
  test passes, and only the tests that depend on E2E-specific data fail —
  in this case both admin logins, with a **401**, because the dev
  database's admin password is not the E2E fixture's.

  **This is nastier than the CORS variant.** There, the API calls fail
  loudly. Here the site works perfectly and only the *data* is wrong, so
  the failure presents as "did my change break auth?".

  Diagnosis, in order — each step ruled out a cause:

  ```bash
  # 1. what did the page actually say?  (the 401 branch of loginError.js)
  cat frontend/test-results/<failed-test>/error-context.md
  # 2. is the E2E database intact?  (it was: 1 user, correct email)
  node -e "require('dotenv').config({path:'.env.e2e'}); …countDocuments()"
  # 3. what is on 5174, and what API does it serve?   ← the answer
  lsof -sTCP:LISTEN -nP -i:5174
  curl -s http://localhost:5174/src/services/api.js | head -3
  ```

  Step 3 is the one that finds it. `ps eww -p <pid>` showing no
  `VITE_API_URL` is corroboration, not proof — the served bundle is.

  Fix: `lsof -sTCP:LISTEN -ti:5174 | xargs kill`, re-run. 5/5, then 22/22.
  **Check 5174 before believing any E2E auth failure.**
- **⚠️ `page.route()` matches handlers in REVERSE registration order, so
  a catch-all registered LAST silently swallows every narrow stub before
  it.** Cost a verification round in PF-86. The natural way to write it
  reads correctly and does the opposite:

  ```js
  await page.route('**/api/blog', fulfillWithFixture);   // registered 1st
  await page.route('**/api/**',   fulfillWithEmptyArray); // registered 2nd — WINS
  ```

  Playwright tries the most-recently-registered handler first, so
  `/api/blog` got `{ data: [] }`. The section then rendered its **loading
  placeholder**, and every probe read `undefined` off a card that was
  never there — the failure presents as "my structural selectors are
  wrong", not as "my mock is wrong", because the page looks fine and the
  network tab shows a clean `200`. Register the catch-all FIRST.

  Worth pairing with the rate-limiter entry below: they push in opposite
  directions. Hammering the real API exhausts the limiter, so the fix is
  to stub — and then the stub has its own way of silently serving the
  wrong thing.
- **A root `node_modules/` is NOT gitignored.** The repo's root
  `.gitignore` has no `node_modules` entry — only `frontend/` and
  `backend/` cover their own. Running `npx vitest` from the REPO ROOT
  rather than from `frontend/` creates
  `node_modules/.vite/vitest/<hash>/results.json`, which then shows up as
  untracked and would be swept in by a `git add -A`. Another reason the
  working agreement says to stage explicit paths. Harmless to delete; worth
  closing in `.gitignore`.
- **The backend rate-limits at 100 requests / 15 min / IP**
  (`middleware/rateLimiter.js`; auth is stricter at 10). Automated browser
  verification hits this easily — PF-85's measurement loop across eight
  viewport widths exhausted it and the API started returning **429** with
  `{"status":"fail","message":"Too many requests…"}`. It surfaces as a
  section that renders its error state for no apparent reason. Prefer
  Playwright `route.fulfill()` with a fixture over hammering the real API;
  it is deterministic as well as polite.

- **⚠️ `test.use({ reducedMotion })` IS SILENTLY INERT IN THIS PROJECT'S
  PLAYWRIGHT CONFIG, AND A TEST USING IT ASSERTS THE WRONG PATH WHILE
  CLAIMING TO ASSERT THE RIGHT ONE.** Found in PF-88, measured rather
  than inferred — Playwright 1.61.1:

  | how the option is set | `matchMedia('(prefers-reduced-motion: reduce)').matches` |
  | --- | --- |
  | `test.use({ reducedMotion: 'reduce' })`, **file** level | **false** ✗ |
  | `test.use({ reducedMotion: 'reduce' })`, **describe** level | **false** ✗ |
  | `browser.newContext({ reducedMotion: 'reduce' })` | **true** ✅ |
  | `await page.emulateMedia({ reducedMotion: 'reduce' })` | **true** ✅ |

  With the fixture, `<html>` also carries **no `data-motion`**, so
  `MotionProvider` is running the full-motion path. Nothing errors. The
  test passes or fails on the wrong branch entirely, which is worse than
  a red test: PF-88's reduced-motion replay test failed with
  `behavior: 'smooth'` where it expected `'auto'` — the code was right
  and the harness was lying.

  **Use `await page.emulateMedia({ reducedMotion: 'reduce' })` in the
  test body, and assert the emulation took**, one line, before asserting
  anything that depends on it. `e2e/footer.spec.js` does both. The same
  caution applies to every other `emulateMedia` option — `colorScheme`,
  `forcedColors` — set through `test.use` here; none is currently used
  that way, and none should be without checking it first.

  The root cause was not chased: `playwright.config.js`'s project `use`
  is `{ ...devices['Desktop Chrome'] }`, which declares no
  `reducedMotion`, so the precedence should favour `test.use`. Whatever
  the mechanism, the measurement is what matters and the workaround is
  one line.

- **⚠️ A DUPLICATED IN-PAGE ANCHOR TURNS AN E2E SELECTOR INTO A STRICT-MODE
  THROW, AND THE FAILURE READS AS THE FEATURE BEING GONE.** PF-88's
  footer added `#about #skills #projects #blog #contact #hero` to a page
  whose header already had all six. `navigation.spec.js` clicked
  `a[href="#about"]`, which now matches **two** elements — Playwright's
  locators are strict, so the call throws rather than picking the first.

  The failure prints as an element-resolution error on a navbar test, in
  a diff that only touched the footer. The instinct is to go looking at
  the navbar. **The rule: a new section that repeats an existing anchor,
  label or role is a breaking change to every unscoped e2e selector**,
  and the tell is a strict-mode violation naming a count of 2. Scope the
  selector to its landmark (`header a[href="#about"]`) and, where a
  regression guard already exists, assert the duplicate COUNT there too —
  otherwise the scoping looks like over-caution to the next reader and
  gets removed.

  **⚠️ IT IS NOT ONLY ANCHORS, AND `aria-hidden` DOES NOT SAVE YOU.** The
  same run broke `homepage.spec.js`'s
  `getByText('Open to opportunities')`, which had matched exactly one
  element — the hero badge — and now matched **thirteen**: the badge
  plus the footer marquee's twelve repeats. The marquee band is
  `aria-hidden="true"`, and `getByText` **ignores** `aria-hidden`;
  only `getByRole` respects it. So a decorative, screen-reader-invisible
  band still breaks a text locator. Scope to the landmark
  (`page.locator('#hero').getByText(…)`) or match by role.

  Note the unit suite cannot see any of this: a component test renders
  one component, so the duplicates never coexist. Same
  unit-green + E2E-red signature as a removed feature, from the other
  direction.

  **And the third failure in that run was neither** — it was a
  pre-existing single-reading assertion going flaky. `navigation.spec.js`
  measured `#projects`'s `top` once after a fixed 1500ms wait; under
  full-suite load it read **-355px**, and the same file run alone read
  70.8. `ScrollToHash` fires one rAF after the route commits and the page
  keeps settling behind it — two unoptimised hero images plus three
  API-driven sections all change the height of the content ABOVE the
  target. Changed to `expect.poll`, which asserts where it SETTLES. Worth
  recognising the shape: **a positional assertion taken once after a
  fixed wait is a timer, not a measurement.**

- **⚠️ `:focus-visible` DOES match a programmatically-focused element, so
  "it's a `.focus()` call, no ring will show" is false.** Cost nothing
  only because PF-91 verified it instead of trusting the ticket that said
  it.

  The PF-91 ticket's Step 4 reads: *"confirm no focus ring appears on
  `<main>` itself (`:focus-visible` won't match a programmatic focus, but
  verify rather than assume)"*. The parenthesis is wrong. **Chromium's
  heuristic keys on the most recent input MODALITY, not on how focus was
  moved** — the skip link is activated with **Enter**, so the `.focus()`
  that follows matches `:focus-visible` exactly as a Tab would.

  Measured: `main.matches(':focus-visible') === true`, and the global ring
  rule painted **a 2px accent outline around the entire page** the moment
  the skip link was used.

  ⚠️ **And there is a second ring behind the first.** Narrowing the ring
  rule to `[tabindex]:not([tabindex="-1"])` stops OUR outline and not the
  browser's: `<main>` then took `outline: auto 1px rgb(0, 95, 204)`, the
  UA default. Same box, different colour, and easy to declare victory
  after the first fix without re-looking. Only an explicit suppression
  removes a UA default.

  Both are fixed in `tokens.css`; see the PF-91 Locked decision for why
  `main[tabindex="-1"]:focus { outline: none }` is safe where the same
  declaration on a control would not be.

- **⚠️ THE OPTIMISATION THAT MAKES A PROBE FAST IS WHAT PUTS A SURFACE
  OUTSIDE IT.** Found in PF-91, and it is the general form of a mistake
  this file already records once without naming it.

  **The instance.** PF-91's contrast sweep found the splash carrying five
  AA failures — three `--faint` labels at 3.56 dark, and two boot lines
  at **1.58** on light paper, the worst text ratio anywhere on the Phase
  2 surface. **Not one of them had ever been measured**, in any pass, by
  any ticket — including **PF-83, whose entire purpose was the a11y
  contract**, and PF-90's state matrix, which walked every cell of the
  page in both themes.

  **The cause is a good decision, not a missed step.** Every sweep loads
  `/?nosplash=1`, for the reason PF-84 documents at length: without it
  Playwright's actionability check will not click through a z-index-100
  overlay, so every test waits out the full ~5.65s splash. Adding it took
  the E2E suite from **2.1m to 1.2m while gaining two tests**. It belongs
  in the `beforeEach` and should stay there.

  So the flag that makes the suite fast is the flag that removes an
  entire surface from everything the suite can see. Nothing errors. The
  audit reports clean, because it genuinely is clean — over the subset it
  looked at.

  **⚠️ THIS IS THE SECOND OCCURRENCE, AND THE FIRST IS ALREADY IN THIS
  FILE.** PF-83's reduced-motion audit reported `getAnimations()` total 0
  and was believed for two sprints; PF-91's Locked-decisions entry on
  ungated hover lifts later found the real total is **1**, from
  `ScrollToTop`'s `fill-mode: both`. The probe was not wrong — it simply
  **never scrolled far enough to mount that button**. Same shape: a
  cheaper probe, a surface outside it, a clean report.

  | | what made the probe cheap | what fell outside it |
  | --- | --- | --- |
  | PF-83 | not scrolling to the footer | `ScrollToTop`, and its one animation |
  | PF-91 | `?nosplash` | the whole splash — 10 text nodes, 5 failures |

  **The habit that catches it: name what the probe EXCLUDES, in the same
  breath as its result.** "Zero failures" is not a finding; "zero
  failures across 246 nodes with the splash not mounted" is, and it
  states its own gap. PF-91's verification runs three passes for this
  reason — the page with `?nosplash`, the splash mounted deliberately at
  4200ms, and the Contact form's error and sent states, which only exist
  after an interaction and had likewise never been in a sweep.

  Note the mounted-splash pass needs its own control: sample too early
  and the boot lines are still at `opacity: 0` mid-entrance, which reads
  as ratio 1.00 — indistinguishable from a real failure. 4200ms is after
  the last line lands (2954ms) plus its ~1s entrance, and before the
  4500ms exit.

- **⚠️ A RED BACKEND SUITE HAS THREE DISTINCT SHAPES, and all three appear
  on a diff that never touched the backend.** The third was found in
  PF-90; collecting them is the useful part, because the first move is
  always to classify rather than to debug.

  | shape | signature | cause | first move |
  | --- | --- | --- | --- |
  | **timeout flake** | `Exceeded timeout of Nms`, **zero** `expect` diffs | Atlas round trip under full-suite load | re-run; `jest.testTimeout` already raised to 30s in PF-87 |
  | **SRV DNS** | `querySrv ENOTFOUND`, `/api/health` reports `database: null`, EVERY route fails | the machine's resolver, not the repo | `nslookup -type=SRV … 1.1.1.1` vs the default resolver |
  | **isolation residue** (PF-90) | `E11000 duplicate key error … dup key: { email: "admin@test.com" }` in a `beforeEach`, **zero** timeouts, **zero** `expect` diffs | leftover documents in `portfolio_test` | re-run; run the file alone to confirm |

  **The PF-90 instance, measured:** run 1 gave **3 failed / 239 passed in
  525s**, all three from `auth.test.js`'s `beforeEach`. Run 2 gave
  **242 / 242 in 179s**. `auth.test.js` alone passes **10/10** and has
  not been touched since Sprint 7 (`6b74e46`).

  ⚠️ **It is NOT the timeout flake, and the distinction matters** because
  the remedies differ. The suite runs `--runInBand`, so suites are
  **serial** — this is not parallel interference either. Something ahead
  of `auth.test.js` left a user in `portfolio_test` that `clearDB` did
  not remove, and `User.create(ADMIN)` then collided on the unique email
  index. A timeout has no `expect` diff *and* no error of its own; this
  has a real `MongoServerError`.

  ⚠️ **`npm test` exited 0 while reporting 3 failures** on that run, so
  an exit-code check alone would have called it green. Read the summary
  line, not just the status.

  ⚠️ **A FOURTH VARIANT, AND IT BREAKS THE "ZERO `expect` DIFFS"
  HEURISTIC THE TABLE ABOVE RELIES ON.** Seen on PF-90's close-out run:

  ```
  ● GET /api/nonexistent › returns 404 for unknown routes
      Expected: 404
      Received: 500
  ```

  A real assertion diff, no timeout, no `E11000` — which reads like a
  genuine regression in routing. It is not. **`app.js:59` mounts an
  `await connectDB()` middleware BEFORE the routes**, so *every* request,
  including one for a route that does not exist, tries the database
  first. A transient connection failure calls `next(err)` with an error
  carrying no `statusCode`, `errorHandler` defaults it to **500**, and
  the request never reaches `notFound` — so it never gets its 404.

  Run 1: **1 failed / 241 passed in 256s**. Run 2: **242 / 242 in 226s**.
  `health.test.js` alone passes **4/4**, and PF-90 changed no backend
  file.

  **So the reliable discriminator is not "no `expect` diff" — it is "the
  same suite passes in isolation and on a re-run, on a diff that never
  touched the backend."** Any DB-dependent middleware in front of the
  router can convert a network hiccup into a wrong status code, and a
  wrong status code is indistinguishable from a logic bug by shape
  alone. Classify by reproducibility first, shape second.

  **`mongodb-memory-server` removes all three at once** — no network, no
  shared cluster, no cross-run residue — and that is now the strongest
  argument for the ticket, stronger than the offline-runnability one it
  was originally filed under.

- **⚠️ `mongodb+srv://` needs SRV DNS, and a broken resolver presents as
  a broken backend.** Seen 2026-08-24 on a phone-hotspot connection: the
  API returned `{"status":"error","message":"querySrv ENOTFOUND
  _mongodb._tcp.portfolio-cluster.oexyxqo.mongodb.net"}` on every route
  and `/api/health` reported `"database": null`, while the server itself
  was listening happily on 5050 and nothing in the repo was wrong.

  The resolver (`172.20.10.1`, the hotspot gateway) returned **NXDOMAIN**
  for the SRV record; Cloudflare and Google both answered it correctly in
  the same second. Diagnose it in two commands, not by reading code:

  ```bash
  nslookup -type=SRV _mongodb._tcp.<cluster>.mongodb.net              # your resolver
  nslookup -type=SRV _mongodb._tcp.<cluster>.mongodb.net 1.1.1.1      # a known-good one
  ```

  Disagreement between those two is the whole diagnosis. Confirm
  end-to-end with a throwaway `dns.setServers(['1.1.1.1'])` before
  connecting — it proves Atlas and the credentials are fine without
  touching anything.

  **⚠️ DO NOT "FIX" IT IN THE REPO.** Rewriting `MONGO_URI` to the
  non-SRV `mongodb://host1,host2,host3` form works and hardcodes shard
  hostnames Atlas is free to change, to work around a local network. Fix
  the machine's DNS. It also resolved itself here when the connection
  stabilised, which is worth knowing before spending an hour on it.

  ⚠️ And note what it does to the backend suite: run through a forced
  resolver over a flaky link, `npm test` took **23 minutes** and reported
  25 failures, none of them with an `expect` diff. That is the
  network-timeout shape the `blogViews` entry above describes, at scale —
  a timeout with no assertion diff is never a code regression.

- **⚠️ `backdrop-filter` BEFORE `-webkit-backdrop-filter` SHIPS WEBKIT-ONLY,
  AND CHROME NO LONGER HONOURS THE PREFIX — so the blur silently does not
  render at all.** Found in PF-90 on the production build. It had been live
  on the **header** (every page, every visit) and the **mobile nav overlay**
  since PF-79, and on `.glass` since Phase 1.

  **The mechanism.** esbuild's CSS minifier — Vite's default `cssMinify`,
  and this repo sets no `browserslist` — treats the prefixed and unprefixed
  property as the same declaration and keeps only the **last** one in the
  rule. So the natural source order:

  ```css
  .overlay {
    backdrop-filter: blur(16px);            /* dropped by the minifier */
    -webkit-backdrop-filter: blur(16px);    /* the only one that ships */
  }
  ```

  built to `-webkit-backdrop-filter:blur(16px)` alone. Measured in the
  bundle: **2** standard declarations against **5** prefixed ones.

  **And the prefixed form is inert in Chrome.** Verified with a three-panel
  control — webkit-only, standard-only, neither — over a striped backdrop:
  only the standard panel blurred, and `getComputedStyle(el).backdropFilter`
  read **`none`** for the webkit-only one while `CSS.supports('backdrop-filter','blur(16px)')`
  returned **true**. That combination is the tell, and it is thoroughly
  misleading: support is real, the rule is present in the stylesheet, and
  the property still computes to `none`.

  ⚠️ **Do not diagnose this as a headless artifact.** That was the first
  guess here and it was wrong: an inline `style="backdrop-filter:blur(16px)"`
  computes correctly in the same browser, and headed mode behaves
  identically. The declaration was genuinely absent from the built CSS.

  **The fix is ORDER, not an extra declaration** — put `-webkit-` FIRST and
  the standard property LAST, which is what `ScrollToTop.module.css` already
  did and why it was the one file that survived. After: **5 standard / 5
  prefixed**, and the blur renders. Cost **81 bytes**.

  **What it looked like on screen.** Dark theme hid it almost completely —
  0.86-alpha near-black over a near-black page has little to reveal. Light
  theme did not: the hero's giant Anton wordmark and its chips read straight
  through the mobile menu. Measured as luminance spread (P90−P10) across a
  glyph-free band behind the nav links:

  | | before | after |
  | --- | --- | --- |
  | light, backdrop band | **0.0259** | **0.0004** |
  | light, hero-type zone | **0.188** | **0.0673** |
  | dark, hero-type zone | 0.0266 | 0.0086 |

  ⚠️ **The nav-link TEXT passed contrast the whole time** — ~13:1 light,
  ~19:1 dark against its own surface. So a contrast audit reports this
  section clean while the menu is visibly hard to read. The defect is
  backdrop *noise*, not ink, and only a screenshot shows it.

  Guarded by `styles/__tests__/backdropFilter.test.js` — parsed with
  **postcss**, never a text search, because the rules now document
  themselves in prose containing the exact property names being asserted.
  Four mutations: standard-first (the real bug), webkit-only, mismatched
  blur values — all caught; and a comment containing
  `backdrop-filter: blur(99px)` correctly **not** caught, which is the
  control proving the guard reads declarations rather than prose.

- **⚠️ CLIPPED AND OCCLUDED LOOK IDENTICAL IN A SCREENSHOT AND ARE
  OPPOSITE DEFECTS.** Found in PF-90 and then mis-diagnosed once before
  being measured, which is the point of the entry.

  The footer copyright rendered as **"…FROM SCRA"** at every phone width
  — the tail of "DESIGNED & BUILT FROM SCRATCH" simply absent. That is
  what a horizontal clip looks like, and it is not what was happening:

  | probe | reading |
  | --- | --- |
  | `scrollWidth === clientWidth` on the text | **equal** — no overflow |
  | the text's box vs the viewport | **16px inside** at every width |
  | `document.documentElement.scrollWidth` | equals the viewport |
  | **`elementFromPoint` at the text's own coords** | **the `ScrollToTop` BUTTON** |

  Only the last one finds it. **Clipping is an overflow bug; occlusion is
  a stacking bug** — a fixed, z-40 element painted over static text. Every
  box measurement reports clean, because every box IS clean.

  ⚠️ **THIRD MEMBER OF A FAMILY, and reading the three together is worth
  more than any one of them:**

  | | what was painted over what | what missed it |
  | --- | --- | --- |
  | the splash (PF-75) | a z-100 overlay over armed `Reveal` targets | `IntersectionObserver`, which measures position |
  | Playwright `toBeVisible()` | anything under the splash | box + `visibility`, never what is on top |
  | **this** | a z-40 button over the copyright | `scrollWidth`, box geometry, `overflow` checks |

  **The general form: a position-based check cannot see what is painted
  on top of the thing it is measuring.** Geometry answers "where is it",
  never "can it be seen". When something is invisible but measures
  correct, hit-test it — `elementFromPoint` for a static element,
  actionability for an interactive one.

  Fixed 2026-08-27 by hiding `ScrollToTop` while the footer's bottom bar
  is in view; see its own doc comment for why an IntersectionObserver and
  not a scroll offset, and why it unmounts rather than fading.

- **⚠️ A TEST FILE UNDER `src/` SHIPS DEAD CSS, because Tailwind v4 scans it
  for utility candidates.** Found in PF-90 while explaining an unexpected
  build-size jump.

  Tailwind v4 auto-detects sources under `src/`, and this repo's convention
  puts **44** test files there (per-module `__tests__/`). Any bare token in
  a test is a valid candidate — a property name in a comment, a class name
  in a string literal — so the generator emits that utility into the
  **shipped** stylesheet.

  Measured: `styles/__tests__/backdropFilter.test.js` mentions
  `backdrop-filter` and `blur`, which added **1,581 bytes** — two utilities
  plus Tailwind's `@property` chain for them. The pre-existing 43 test files
  were already contributing **193 bytes** (`.ease-in-out`, from
  `animations.test.js`).

  ⚠️ **The build number is what surfaces it, and only if you check.** The
  CSS went 64.86 → 66.52 kB and the obvious suspect was the 3-declaration
  CSS fix in the same diff. Isolating them gave **81 bytes** for the fix and
  **1,581** for the test file — the opposite of the intuition. A build-size
  delta that does not match the diff is worth ten minutes.

  Fixed in `global.css` with Tailwind v4's own `@source not`:

  ```css
  @source not "**/__tests__/**";
  @source not "**/*.test.{js,jsx}";
  ```

  ⚠️ **THE SAVING IS 193 BYTES, NOT THE 1,774 THIS ENTRY FIRST CLAIMED.**
  Corrected 2026-08-27 after the number stopped reproducing, and left
  visible rather than quietly edited.

  The 1,774 figure was measured once, mid-session, and is not
  reproducible in the finished tree. Re-measured at the end, by removing
  the directives and rebuilding: **66,621 → 66,428**, i.e. exactly the
  `.ease-in-out` leak. The two larger utilities are still emitted, and
  bisection could not isolate their source — ruled out, each by
  rebuilding without it: every file changed in PF-90, the new test file
  (moving it out changes nothing, so the exclusion IS working), and the
  prose in `global.css`'s own comments.

  **What is certain, and is the part that matters:** the leak is
  **pre-existing, not introduced here**. A build at `HEAD` with no
  working changes is **66,441 bytes and already emits both utilities**,
  against the finished tree's **66,428** — 13 bytes smaller while adding
  a footer surface, two blur declarations and a new test file. So
  nothing regressed; an earlier measurement was simply better than the
  steady state and should not have been written down as a result.

  The mechanism in the paragraph above is still real and still worth
  knowing — a test that names a utility does emit it, proven by moving
  `backdropFilter.test.js` out and back. Only the headline number was
  wrong.

  Safe because no test consumes the built stylesheet
  — CSS Modules are stubbed under Vitest and `document.styleSheets.length`
  is **0**, so tests assert stylesheets as TEXT. Verified by selector diff
  rather than by size alone: exactly **three** selectors left the bundle
  (`.backdrop-filter`, `.blur`, `.ease-in-out`), all three test-only, and
  **zero** were gained. Every utility real components use — `flex`, `grid`,
  `min-h-screen`, `items-center`, `justify-center`, `animate-fade-in-up` —
  is still emitted.

- **⚠️ PLAYWRIGHT REPORTS `flaky` IN A BUCKET SEPARATE FROM `passed`, SO A
  SUITE THAT RAN EVERYTHING CAN READ AS ONE THAT SKIPPED TWO TESTS.**
  Cost a full diagnostic pass in PF-92 (2026-08-29).

  `playwright.config.js:9` sets `retries: 1`. A test that fails on the
  first attempt and passes on the retry contributes to **neither** the
  failed count nor the passed count — it is reported as `flaky`. So:

  ```
  npx playwright test --list | grep -c "›"   →  40
  npm run test:e2e                           →  "38 passed"
  ```

  and the two missing tests **ran**. They were the two newest specs, which
  made it read as "collected but never executed" — a config filter, a
  `describe` scoped to another project, or a duplicate title dedup. It was
  none of those; the summary line just does not put flaky tests where you
  look.

  ⚠️ **The count is the symptom; a flaky test is the defect.** Diagnose it
  from the JSON reporter's per-attempt data, never from the summary:

  ```bash
  PLAYWRIGHT_JSON_OUTPUT_NAME=out.json npx playwright test --reporter=json > run.log
  # then count tests whose `results` array has length > 1
  ```

  ⚠️ Redirect stdout to a **different** file than the reporter writes —
  `global-setup.js` prints "✓ E2E backend verified…" to stdout, so
  `--reporter=json > out.json` produces invalid JSON with a `✓` on line 1.

  This file already recorded the shape once ("E2E **21 passed + 1 flaky**")
  without naming what causes the arithmetic to look wrong.

- **⚠️ A STABILITY CHECK THAT ACCEPTS THE FIRST PLATEAU IS A TIMER
  WEARING A MEASUREMENT'S CLOTHES.** The defect behind the flake above,
  and a trap this project has now hit twice in the same file.

  PF-94's first E2E spec read the target's position until two readings
  400ms apart agreed, then returned that value. It looks like the
  principled fix to "a positional assertion after a fixed wait is a
  timer" — it waits for the page to stop moving rather than for a clock.

  **It is not, because under full-suite load the main thread stalls, and a
  stall PAUSES the smooth-scroll animation.** Two readings then agree
  *mid-scroll*, the helper mistakes the pause for a settle and returns
  something like 310, the test fails, the retry passes, and the run
  reports `flaky`. Exactly the load-dependent behaviour PF-88 documented
  for the `#projects` poll two tests above it — **−355px under full-suite
  load, 70.8 alone.**

  **The fix is to retry the whole stability check rather than act on its
  first answer** — `expect.poll` around three agreeing readings, so a
  stalled-scroll plateau costs another iteration instead of deciding the
  result.

  ⚠️ **And retrying reintroduces the vacuity risk the plateau check
  existed to avoid**, so the two have to be solved together: a bare
  `expect.poll(...).toBe(71)` goes green on the broken build, which passes
  *through* 71 on its way down before the late shift drops it to 186.
  Waiting for `networkidle` first is what closes that — once the grids
  have rendered, the broken build is parked at 186 and 71 is unreachable.
  **Both halves are required; either alone is a bad test.** Verified by
  mutation against the pre-PF-94 component: `Expected 71, Received 186`,
  failing on the retry too.

- **⚠️ `playwright-report/` AND `test-results/` ARE GIT-IGNORED AND WERE
  NOT ESLINT-IGNORED, SO THE SPRINT GATE BROKE ITSELF.** Found in PF-92,
  and it is the `dist-verify/` entry above repeating with different
  directories.

  `reporter: 'html'` writes `playwright-report/` on **every** E2E run and
  `test-results/` on any failure or retry, both containing minified vendor
  bundles. `frontend/.gitignore:37-38` covers both; `eslint.config.js`'s
  `globalIgnores` did not. So after `npm run test:e2e`, `eslint .`
  reported **642 errors** in someone else's code — `'process' is not
  defined`, `'Buffer' is not defined`, unnecessary escapes.

  **The gate's own five commands therefore fail whenever the E2E step runs
  before the lint step**, which the PF-92 ticket's ordering does not
  prevent. It had never surfaced because E2E had not completed in the same
  working tree as a lint run before.

  Fixed by adding both to `globalIgnores`, and verified **with both
  directories present on disk** rather than after deleting them — the same
  honesty the `dist-verify/` fix needed.

- **⚠️ A PRODUCTION OUTAGE WHERE `/api/health` RETURNED 200 THROUGHOUT, AND
  MONITORING WOULD HAVE REPORTED GREEN.** The deployed backend's
  `MONGO_URI` was set with **no database path**, so `assertExplicitDatabase`
  refused the connection and every data route returned **500** — while
  `/api/health` stayed **200**. Three of the six sections rendered their
  error states on the live site and nothing surfaced it.

  **This is the existing "connection string with no database path" entry
  firing correctly in a second environment** — the PF-66 guard doing
  exactly its job, refusing rather than silently connecting to a database
  called `test`. The guard is not the defect. **The monitoring blind spot
  is**, and it is worth naming on its own.

  **The mechanism, read out of `src/app.js` rather than reasoned:**

  ```js
  // the /api/health handler — connect failure is SWALLOWED
  try { await connectDB(); database = mongoose.connection.name || null; }
  catch (_err) { /* swallowed */ }
  res.json({ status: 'ok', env, timestamp, database });

  // ...and only THEN the connect middleware that guards the routes
  app.use(async (_req, _res, next) => {
    try { await connectDB(); next(); } catch (err) { next(err); }
  });
  // ── API Routes ── (everything below this line 500s)
  ```

  So health sits **in front of** the gate it is supposed to report on, and
  answers `status: "ok"` with `database: null` while every route behind it
  fails. Anything checking the status code, or even the `status` field,
  sees a healthy service.

  **⚠️ `database` IS THE ONLY FIELD THAT CARRIES THE TRUTH.** A health
  check on this API must assert `database` is a non-null string — and,
  better, the *expected* name. Healthy now reads
  `{"status":"ok","env":"production","database":"test"}`; during the
  incident the same endpoint returned the same `status: "ok"` with
  `database: null`.

  ⚠️ Note this is also the **fourth** backend failure shape's cause seen
  from the other side: because `connectDB()` is awaited ahead of the
  router, a connection problem converts into a *wrong status code* rather
  than a connection error — including a 500 where a 404 belongs, which is
  what makes it indistinguishable from a logic bug by shape alone.

- **⚠️ THE E2E CONTACT SPEC WRITES A ROW PER RUN AND NEVER CLEANS UP.**
  `portfolio_e2e.contacts` holds **52** documents as of 2026-08-30 —
  **51 identical "Test Recruiter"** fixtures plus one "E2E Visitor".
  Counted, not estimated.

  It is harmless where it lives — that database exists to be disposable,
  and no spec asserts a count — but it grows monotonically and it is the
  reason a `contacts` count is not a usable signal there. It also
  quantifies its own rate: the collection went **44 → 52 during a single
  session** of PF-92/PF-94 verification, i.e. one row per full-suite run.
  `global-setup.js` wipes and reseeds the fixture collections; contacts are
  written *by the tests*, after that point, so nothing removes them.

Where a mistake would be silent, add a test that would catch it.

## Locked decisions — do not reopen

### ⚠️ `docs/design/` is FROZEN as of 2026-08-22 (owner decision)

Mocking the navbar changes below in Claude Design and re-exporting was
considered and **rejected, deliberately and finally**. A re-export
regenerates the entire file, eight sections are already transcribed
against the current one, and an unrequested token or timing change would
arrive **carrying design authority while every test stayed green** —
which is precisely the failure this file exists to prevent.

`docs/design/` is therefore read-only from here on. Nothing is written
there. The five entries that follow are SANCTIONED DEVIATIONS with the
same standing as the cursor-web reduction, the splash scan lines, the
section washes and the extra hero chips.

**Consequence, accepted rather than corrected: the prototype no longer
shows the site's real header.** Anyone diffing live against
`Portfolio Revolution.dc.html` or `Blog.dc.html` WILL see header
differences, and these entries are the only record that they are
intentional. That is what makes them load-bearing rather than
documentation — a fidelity pass that cannot find them here will "restore"
the prototype's switch, its loud ADMIN pill and its inboard logo.

- **⚠️ The header is FULL-BLEED, and this REVERSED an earlier decision
  the same day. Read both halves before changing it again (2026-08-22,
  owner-requested, two passes).**

  **First pass.** `.inner` was given
  `max-width: calc(1240px + 2 * clamp(16px, 4vw, 40px))` so the header's
  content box matched every section's 1240px column exactly. The reason
  it was not simply `1240px`: every section puts the padding on the
  `<section>` and `max-width: 1240px` on a **separate inner div**, so its
  content box maxes at 1240px, whereas the header carries both on **one**
  element — a bare `1240px` there gives 1240 − 2×inset = 1160px and parks
  the logo one inset inboard. (`box-sizing: border-box` is global, so
  `max-width` includes the padding.) Measured: delta 0 at nine widths.

  Note the request that produced it — "set the logo inset to
  `clamp(16px, 4vw, 40px)`" — was a **NO-OP**: `Navbar.module.css` has
  carried exactly that value since PF-79, identical to all five sections.
  The inset was never the problem; where the max-width sat was.

  **Second pass, after seeing it live: the max-width is GONE.** The owner
  wanted the logo further LEFT and ADMIN further RIGHT than the 1240px
  column allows. The header now spans the viewport with the padding alone
  holding the inset. Measured:

  | viewport | logo left | ADMIN gap from right edge | section column starts |
  | --- | --- | --- | --- |
  | 1920 | **40** | **40** | 340 |
  | 1600 | **40** | **40** | 180 |
  | 1440 | **40** | **40** | 100 |
  | 1280 | 40 | 40 | 40 |
  | 1024 | 40 | 40 | 40 |
  | 768 | 30.7 | *(nav hidden)* | 30.7 |
  | 375 | 16 | *(nav hidden)* | 16 |

  **⚠️ THE CONSEQUENCE, ACCEPTED: above ~1320px the header no longer
  aligns with section content** — at 1920px the logo sits at 40px where
  the hero's text starts at 340px, a 300px divergence **by design**. This
  is full-bleed chrome over a centred content column, and it is the
  OPPOSITE of what the first pass existed for. **Do not "restore" the
  max-width to fix the alignment; that is the thing that was rejected.**
  Below ~1320px the column is viewport-bound anyway and the two still
  line up exactly, so the divergence only opens on wide screens.

  Horizontal only in both passes — `--header-h` re-measured at **71px**
  after each.

- **ADMIN is isolated as chrome, in `--muted`, NOT `--muted2`
  (2026-08-22, owner-requested; ink corrected here and the correction
  accepted).** ADMIN is an owner-only entrance with no value to a
  visitor, so it reads as chrome rather than navigation: the pill drops
  its accent fill, accent border, glow `text-shadow` and glowing dot for
  a quiet `rgba(var(--ln),.18)` outline on transparent, and sits **32px
  clear** of the theme toggle at the far right of a full-bleed header.

  **⚠️ `.adminDivider` was BUILT AND THEN REMOVED the same day.** A
  second 1px rule (`rgba(var(--ln),.16)`, `margin: 0 16px`) between the
  toggle and ADMIN was asked for, shipped, and then judged one separator
  too many: the row read as `[nav] | [toggle] | [ADMIN]`, which **boxed
  the toggle in** rather than setting ADMIN apart. The isolation is now
  pure whitespace — 36px of measured clear space, MORE than the divider
  version gave, with one less element.

  **⚠️ `.divider` STAYS, and the two are easy to conflate.** That one is
  the PROTOTYPE'S own (line 74) and sits on the **LEFT** of the toggle;
  the removed one was on the **RIGHT**. Check which side you are looking
  at before deleting one. Verified live: exactly **1** vertical rule in
  the nav. Guarded as an absence plus a count, because "add a divider
  before ADMIN" is a natural idea that was already tried.

  **Hover is UNCHANGED** — it returns to the accent fill, and the dot
  follows the label into `--accInk` so the pill reads as one object.

  **⚠️ THE REQUESTED `--muted2` WAS NOT USED, AND THIS IS A DEVIATION
  FROM THE REQUEST RATHER THAN FROM THE DESIGN.** It fails AA in dark
  theme. Measured on this exact node against the header's own composited
  backdrop — not inherited from PF-83's About finding, which is a
  different surface:

  | | dark, backdrop `rgb(9,15,29)` | light, backdrop `rgb(230,217,197)` |
  | --- | --- | --- |
  | `--muted2` #6b7891 / #4f5d76 — as requested | **4.31 ✗ FAILS** | 4.77 ✅ |
  | `--muted` #93a0b8 / #45536d — **shipped** | **7.27** ✅ | **5.56** ✅ |

  This link is 11.5px **bold**, below the 18.66px large-text threshold,
  so AA wants 4.5:1. PF-83 closed the site at **zero** AA failures in
  both themes; `--muted2` here would have *authored* a new one rather
  than inherited one, which is a different and worse thing. So **the
  isolation comes from FORM — outline instead of fill — not from darker
  ink.** Note this is the same token failing in the same theme for the
  third time (About's stat labels, the Blog compact-row meta, now this):
  `--muted2` on a dark ground at a small size is a recurring trap, and
  `--muted` is the one-step-lighter answer each time.

  **⚠️ THE REQUESTED `margin-left: auto` WAS NOT USED EITHER, because it
  is a silent no-op in this layout.** `.inner` is
  `justify-content: space-between` with two children and `.nav` is
  content-sized, so there is no free space *inside* `.nav` for `auto` to
  absorb. It parses, ships, and does nothing. An inert declaration is
  worse than no declaration: the next reader treats it as load-bearing
  and builds around it. `.adminDivider` and its 20px of clear space are
  what actually separate ADMIN. **Do not add it back.**

  **ADMIN stays LAST in the DOM, on every route.** PF-83 specified and
  verified skip → logo → nav links → CONTACT → toggle → ADMIN. The
  divider moves it on screen without moving it in the sequence. Guarded
  across `/`, `/blog` and a 404 path.

- **The theme toggle is a sun/moon icon button, replacing the
  prototype's 30px switch (2026-08-22, owner-requested).** 44×44
  interactive area, 18px icon, `stroke-width: 1.75`, `--muted` at rest,
  `--acc` on hover. **The icon shows the DESTINATION, not the current
  state** — light theme shows a moon, dark shows a sun. Removed with the
  switch: `.track`, `.knob`, the `:global(html[data-theme='light'])
  .knob` 13px slide, and `.label`. `--acc2`/`--acc2rgb` now have **no
  component consumer at all**; they stay in `tokens.css` because the
  prototype still uses them and the Blog/Admin screens are unbuilt.

  **⚠️ 44×44 is chosen to EQUAL the logo, not to be a generous touch
  target.** The header's height is set by its tallest child, and
  12 + **44** + 12 + 2 + 1 = 71 = `--header-h`, which every section's
  `scroll-margin-top` reads. A 48px target would move `--header-h` and
  therefore every anchor jump on the site. Measured after the change:
  `document.querySelector('header').getBoundingClientRect().height` is
  **71**, toggle box **44×44**, logo **44×44**. `flex: none` keeps the
  row from compressing it below 44 silently. Re-measure before enlarging.

  **⚠️ The sun GLOWS, and the glow is THEME-SCOPED (owner-requested,
  second pass 2026-08-22).** In dark theme the sun is lit at rest and
  flares on hover; in light theme the moon has no glow at any state and
  **darkens** on hover instead. Measured on the production build, with
  the pointer parked off the control for the rest reading:

  | | rest | hover |
  | --- | --- | --- |
  | DARK (sun) | `rgb(252,163,17)` + `drop-shadow(0 0 6px ….55)` | same colour + `drop-shadow(0 0 11px ….85)`, bg `rgba(252,163,17,.12)` |
  | LIGHT (moon) | `rgb(69,83,109)` (`--muted`), `filter: none` | `rgb(11,18,32)` (`--strong`), `filter: none`, bg `rgba(20,33,61,.08)` |

  Non-text contrast against the header backdrop: **9.48 dark / 5.56
  light**, both clear of the 3:1 a UI control needs.

  Three things are load-bearing:

  - **Scoping is the whole of it.** `--acc` is amber `#FCA311` in dark
    and **brown `#7E4800`** in light, so one unscoped glow rule paints a
    brown smudge behind the moon — valid CSS, no error, reads as a
    rendering artefact. Exactly the trap that forced the terminal caret
    to become a literal hex. Both themes are named explicitly, and dark
    is a REAL attribute (`index.html:31`, `theme.js:63`), never an absent
    default — had it been implicit, `[data-theme='dark']` would match
    nothing and the glow would silently never appear.
  - **`:global(html[data-theme='…'])` wins on SPECIFICITY, (0,2,0)
    against the base rule's (0,1,0)** — not on emission order. Equal
    specificity resolving on bundle order is the tie that has bitten this
    project six times; this does not add a seventh.
  - **`drop-shadow`, never `box-shadow`.** The button is a 44px round hit
    area around an 18px icon, so `box-shadow` would halo a mostly-empty
    disc. `drop-shadow` follows the SVG's own alpha, so the light comes
    off the sun's rays. Guarded.

  The glow is **static, not animated** — it is `filter`, transitioned at
  .25s alongside colour and background, so it needs no reduced-motion
  gate and `motion.css` collapses the transition for free. A pulsing
  variant (`glowpulse` already exists, and the CONTACT pill uses it) was
  NOT built: "glow like a sun" reads as steady radiance, and a pulse
  would be autoplaying motion needing its own gate.

  **⚠️ The icon SHAPES have no design source** — the prototype has no
  icon here at all. Crescent moon and sun-with-rays is the conventional
  pairing and is what shipped; it is **owner-decidable rather than
  settled**, and swapping either shape touches nothing but two `<path>`
  strings in `ThemeToggle.jsx`.

  **⚠️ `themeModeLabel()` was DELETED, and NOT for the reason originally
  given.** The stated concern was that a destination-showing icon would
  contradict a state-naming label. It would not have: the function
  already named the destination — `themeModeLabel('dark')` returned
  `'LIGHT MODE'`, and the aria-label was already `Switch to Light
  theme`, both matching the prototype's own `themeLabel` (line 1113).
  Nothing disagreed. The real consequence of going icon-only is that it
  lost its **only** consumer while its two tests in
  `utils/__tests__/theme.test.js` would have stayed green forever,
  because a unit test imports the module directly — the `useTypewriter`
  shape this file documents. Deleted **with its tests** rather than left
  as a fifth orphan for cutover. `toggleLabel()` STAYS; it still
  composes the aria-label.

  **`aria-pressed` was dropped too.** A button whose accessible name is
  already the action ("Switch to dark theme") plus `aria-pressed`
  announces an action AND a state pointing opposite directions.
  Name-changes-on-activate and `aria-pressed` are alternative patterns
  for the same thing; running both is the bug. No test asserted it.

- **The navbar is route-aware (2026-08-22).** A LIVE BUG, not a
  preference: `App.jsx` mounts `<Navbar />` on `path="*"`, so it rendered
  on `NotFoundPage` and on `/blog` with six bare-hash links that resolve
  to nothing off the home page. PF-86 then pointed five Blog-teaser links
  at `/blog`, which has no route — putting the dead chrome **two clicks
  from the home page**.

  | route | brand | links |
  | --- | --- | --- |
  | `/` | `#hero` | `#about #skills #projects #blog` · `#contact` — **unchanged** |
  | `/blog*` | `/?nosplash=1` | `/?nosplash=1#projects` · `/?nosplash=1#about` · `← PORTFOLIO` |
  | anything else | `/?nosplash=1` | the portfolio set, absolute |

  **On `/` the hashes are returned unchanged**, deliberately — e2e's
  `a[href="#about"]` selectors depend on it, and there is a dedicated
  regression test saying so.

  **⚠️ `?nosplash=1` is the PROTOTYPE'S OWN mechanism**, on all five of
  `Blog.dc.html`'s cross-screen hrefs (lines 45, 51, 52, 53, 60), and
  `shouldShowSplash()` already reads it. Without it, returning home
  replays the ~5.65s splash *over* the anchor jump while
  `initialReady={false}` holds every reveal. Stripping the param from the
  address bar after mount is an available follow-up, not a defect.

  **⚠️ Do NOT replace it with a module-scoped "already shown this
  session" flag.** StrictMode's simulated remount sets it on the first
  mount and suppresses the splash on the second, so the splash never
  appears in development at all — the same dev-only footgun class as the
  `setReady(true)`-on-unmount safety net `SplashProvider` warns about.

  **On `/blog*` the nav is the Blog prototype's own content**,
  transcribed from `Blog.dc.html` lines 50-61: PROJECTS · ABOUT ·
  `← PORTFOLIO` (glowpulse pill, replacing CONTACT) · divider · toggle ·
  ADMIN. No BLOG link — you are on it. **This is the one part of the
  2026-08-22 navbar rework that is transcription rather than deviation.**
  It renders today over `NotFoundPage`, since `/blog` has no route until
  Sprint 13; blog chrome over a 404 is strictly better than portfolio
  chrome whose every link is dead.

  **⚠️ React Router v7 does NOT scroll to a hash** — it performs the
  navigation and ignores the fragment, so `<Link to="/#about">` changes
  the URL and leaves the viewport at the top. Nothing else in this repo
  handled one; `ScrollToTop.jsx` is a scroll-to-top BUTTON, not a route
  effect. `components/layout/ScrollToHash.jsx` fills the gap. A plain
  `<a href>` was rejected: a full document load discards the TanStack
  Query cache and re-fetches the two unoptimised hero images
  (1.4MB + 2.3MB).

  **⚠️ `navModel()`/`isBlogPath()` live in `utils/nav.js`, NOT in
  `Navbar.jsx`.** Same rule that puts contexts in their own module —
  `react-refresh/only-export-components` fails CI at
  `--max-warnings=0` when one file exports both a component and a plain
  function. This cost a lint cycle; it is the third time that rule has
  bitten this project.

  **⚠️ PF-83's "8 focusables" in the mobile overlay is now PER-ROUTE,
  not a constant.** Measured at 375px:

  | route | focusables |
  | --- | --- |
  | `/` | **8** — ×, ABOUT, SKILLS, PROJECTS, BLOG, CONTACT, toggle, ADMIN |
  | `/blog` | **6** — ×, PROJECTS, ABOUT, ← PORTFOLIO, toggle, ADMIN |

  Both: Tab and Shift+Tab cycle a full lap plus three without leaking,
  Escape closes, focus returns to the hamburger. The trap BEHAVIOUR is
  what is guarded, since `Navbar.test.jsx` re-queries the focusable set
  from the DOM rather than hardcoding a count.

- **`ScrollToHash` is gated on splash readiness and passes NO `behavior`
  (2026-08-22).** Two details, both load-bearing and both measured.

  **The splash gate.** A cold link to `/#projects` with no `?nosplash`
  mounts the splash AND wants to scroll. Ungated, the page scrolls behind
  a z-index-100 overlay while every reveal is still held by
  `initialReady={false}`. It reads `useSplashReady()`, which **fails open
  outside a provider** — so it is mounted **inside `SplashProvider` in
  `HomePage.jsx`, not in `App.jsx`**. An App-level mount would compile,
  render and silently skip the gate. Every hash target on this site is a
  section of that page anyway.

  Traced on the production build, `/#projects` with the splash running:

  | t | scrollY | splash up | reveals in |
  | --- | --- | --- | --- |
  | 44ms | 0 | yes | 0 |
  | 4914ms | 2 | yes | 20 |
  | 5218ms | 1933 | yes | 38 |
  | 5680ms | 2713 | yes | 44 |
  | 5831ms | **2723** | **no** | 44 |

  Final `#projects.top` = **70.83px**. Under
  `prefers-reduced-motion: reduce` the same URL lands at 2723 by
  **216ms** with no splash at all.

  **⚠️ The scroll runs DURING the splash's exit, not after it, and that
  is correct rather than sloppy.** `ready` flips 320ms into the 1s exit —
  by design, so reveals begin while the splash slides away and the page
  is not static when uncovered. The scroll simply rides the same gate.
  What the user sees: splash fades and slides up, the hero is briefly
  visible through it, the page scrolls to Projects as the splash clears.
  It lands correctly and nothing overlaps wrongly. **The debatable part,
  recorded rather than decided: the hero's entrance reveals fire and are
  immediately scrolled past.** If that is ever judged wrong, the fix is
  to gate on splash *unmount* rather than on `ready` — one condition, not
  a redesign. Do not disable the gate.

  **No `behavior` argument.** Omitting it makes `scrollIntoView()`
  inherit the root's computed `scroll-behavior` — `smooth` normally,
  `auto` under reduced motion, via `motion.css`'s ROOT-ELEMENT override.
  That override exists because `html[data-motion="reduced"] *` is a
  descendant selector and cannot reach `<html>` itself; **it has
  regressed once already**, so `ScrollToHash.test.jsx` re-asserts it
  rather than trusting `styles/__tests__/motion.test.js` alone. Passing
  `{ behavior: 'smooth' }` would animate the jump for exactly the users
  who asked it not to, invisibly to anyone not testing with reduce on.
  Guarded on the ARGUMENT, because jsdom implements no scrolling at all.

  **⚠️ PF-88 added a per-navigation guard, and it is not defensive.**
  `splashReady` is a dependency, so the effect re-runs every time the
  gate opens — and the footer's REPLAY INTRO button now closes and
  reopens it mid-session. Without the guard a visitor sitting at
  `/#projects` who clicks replay gets the scroll-to-top, the whole
  ~5.65s splash, and then a silent yank back down to `#projects` the
  instant the gate reopens. It records the react-router navigation `key`
  it actually scrolled for. Keyed on `key` rather than `hash`, so
  clicking the same hash twice still re-scrolls; and marked **inside the
  rAF, after the scroll**, because StrictMode cancels the first mount's
  rAF and an early mark would leave the second mount refusing to scroll
  at all. Both directions mutation-tested.

- **Contact's accent glow layer is removed (2026-08-22,
  owner-requested).** The prototype's line 490 — an `aria-hidden`
  absolute child, `top:-60px; left:50%; translateX(-50%)`,
  `min(90%,900px)` × 300px, `radial-gradient(ellipse at center,
  rgba(252,163,17,.16), transparent 70%)` — is gone from `#contact`.

  **⚠️ This one is worth reading as a REASONING failure, not just a
  preference.** PF-87 built it deliberately and argued to keep it, on
  the grounds that the 2026-08-18 wash removal was about *opaque ground
  tints producing stacked-panel banding*, and that an ADDITIVE amber
  bloom is a different kind of thing — the same distinction that
  correctly saved Blog's `.sweep` and About's `.portraitFade`. The
  ticket agreed and recommended keeping it.

  The distinction was real and the conclusion was still wrong, because
  it ignored a value sitting two lines above it in the same rule.
  **`overflow: hidden` on the section clips the 300px box**, so the
  gradient's soft edges terminate in hard horizontal and vertical
  seams. What renders is not a bloom bleeding into the star field; it
  is a faint yellow RECTANGLE with visible edges — precisely the
  panel look the wash removal exists to prevent. The owner saw it live
  and said so.

  **The lesson: "additive vs opaque" is a property of the gradient;
  "reads as a panel" is a property of the rendered box.** A clip turns
  the first into the second, and no amount of reading the gradient's
  alpha will show that. This is the ungated-hover mistake in a new
  costume — an argument from one property of a rule, when a neighbouring
  property changed what it meant.

  Three things to keep straight, the same shape as the splash scan
  lines, the About caption and the Blog ghost numeral:
  - The **element** is gone, not its background. A background-less
    absolute div still sits in the section's top-centre and is still
    walked by anything reading the DOM.
  - **`overflow: hidden` STAYS.** It is the prototype's own declaration
    (line 489), independent of the layer it happened to clip, and
    nothing else in the section overflows. Deleting it as "the other
    half" trades an untranscribed value for no visible change. Guarded
    explicitly, because the pairing PF-87's own comment described makes
    it a natural thing to sweep up.
  - The **section wash** (line 489's `background`) was already out under
    the 2026-08-18 decision. Two separate removals, one section.

  Verified after: all six sections report `background-image: none` /
  `rgba(0,0,0,0)` in both themes, and `#contact` reports **zero**
  aria-hidden absolute children painting a gradient. The layers that
  remain elsewhere — Hero's portrait glow and four drift blobs, About's
  `.portraitFade` and sweep, Blog's card sweep — are all CONTENT layers
  bound to a specific element, not section-spanning bands, and none was
  touched.

  Guarded as an absence **three ways** — no `.glow` rule, no
  aria-hidden absolute child, no `radial-gradient` anywhere in the
  module — plus a fourth pinning `overflow: hidden`. Via postcss and the
  DOM, never a text search: the module documents the removed
  declarations in prose exactly where the rule used to be. Five
  mutations, each caught by a different guard: full restore, CSS-only,
  element-only, the gradient smuggled onto the section itself, and
  `overflow` swept up with it.

- **The Blog featured card's ghost numeral is removed (2026-08-22,
  owner-requested).** The prototype's translucent `01` — `top: -30px;
  right: -10px`, Anton `clamp(120px,17vw,190px)`,
  `rgba(252,163,17,.09)`, line 429 — is gone from the home teaser, and
  the `/blog` index inherits the removal when Sprint 13 builds it.

  Three things to keep straight, the same shape as the splash scan lines
  and the About caption:
  - The **element** is gone, not its opacity. A zero-opacity span still
    occupies the corner and is still walked by anything reading the DOM.
  - **`.sweep` STAYS.** It is a *different* absolute child of the same
    card — the 9s sheen at `background-size: 100% 320%` — and is not what
    was objected to. This is the trap that nearly took `.scanTexture`
    with the scan lines and `.portraitFade` with the caption. Verified
    after: the card has **1** absolute child, and it reports one running
    `sweep` at 9000ms.
  - **The compact-row numerals 02/03/04 STAY**, as does the reading
    view's meta number. Only the big one was objected to. Verified live.

  Guarded as an **absence** three ways — no element, no bare "01" text,
  no `.ghostNumeral` selector — **via postcss, not a text search**, since
  the module documents the removed declarations in prose exactly where
  the rule used to be. All three mutations caught.

- **The Blog reading view's "GOT A QUESTION ABOUT THIS BUILD? / EMAIL
  ME →" block is removed (2026-08-22, owner-requested — DECISION ONLY,
  NOT BUILT).** The reading view does not exist; this is Sprint 13's
  ticket. `Blog.dc.html:103-106` is the container (`margin-top: 44px`,
  accent-tinted gradient panel, `border: 1px solid rgba(252,163,17,.3)`)
  holding exactly those two children, and nothing else shares it —
  remove container and both children.

  **Consequence, accepted rather than corrected:** prev/next's
  `margin-top: 30px` then collapses against the last section's
  `margin-bottom: 38px`, so the tail gap goes 44px → **38px**. **Do NOT
  add a margin to hold 44px** — that invents a value to preserve a gap
  left by a deleted element, which is the opposite of transcribing the
  design.

  The Contact section's own email route is unaffected; the site still
  offers a way to make contact.


- **Both marquee bands repeat their strip MORE than the prototype's two
  times — footer 12, hero 6 (2026-08-24, raised and owner-approved).**
  A sanctioned deviation, and the fourth entry on the "nothing is
  reduced" list's sibling side: this is an *addition*, so it sits under
  the "never substitute your own judgement, even upward" rule, which is
  why it was raised before shipping rather than fixed quietly.

  **The defect.** `marq` translates the track from `translateX(0)` to
  `translateX(-50%)` **of the track's own width**, so one cycle slides it
  by exactly HALF the copies. The seamlessness requirement is therefore

  ```
  copies ≥ 2 × bandWidth / copyWidth
  ```

  — **not** `copyWidth ≥ bandWidth`, which is the intuitive reading and
  is wrong by a factor of two. With the prototype's two copies, anything
  past `copyWidth` is empty band, and the empty stretch GROWS as the
  track slides. Measured in Chromium on the production build at 1440px:

  | band | one copy | needs | shipped with 2 copies |
  | --- | --- | --- | --- |
  | footer 1440 | 600px | 4.80 | **840px of empty band** at the wrap |
  | hero 1484 | 1297px | 2.29 | **187px** |

  Screenshotted at 25% and 49% of the cycle before and after, not
  reasoned: the "before" band is visibly half empty.

  **The prototype has exactly two `<span>`s in each strip** (lines
  546-547 and 188-189), so this is not a transcription slip — the export
  renders the same hole. The owner chose to fix **both** bands; the
  hero's has been shipping the 187px version since PF-80.

  **⚠️ NO SINGLE COUNT IS CORRECT AT EVERY WIDTH**, same shape as the
  measured placeholder heights in PF-85 and PF-86. `copyWidth` is
  `clamp()`ed so it stops growing while the band keeps going. The counts
  in use are sized past any realistic window, and the coverage is stated
  rather than implied:

  | caller | copies | copy | covers a band up to |
  | --- | --- | --- | --- |
  | footer | 12 | 600px | **3600px** |
  | hero | 6 | 1297px | **3891px** |

  Verified seamless at 3440 · 2560 · 1920 · 1440 · 1280 · 1024 · 768 ·
  600 · 375. Beyond ~3600px the hole returns; raise the count, and use
  `copies/2 × copyWidth` rather than reasoning about it.

  **`copies` MUST STAY EVEN.** An odd count lands mid-copy at the wrap
  and the text visibly jumps once per cycle. Guarded, along with both
  exact counts, in `Marquee.test.jsx` — which also reads both call sites
  as source, because jsdom can measure none of this.

  **The prop defaults to 2**, so any caller that does not pass it is
  byte-identical to the pre-PF-88 component.

  Do NOT "restore" either band to the prototype's two copies to match the
  export; the mismatch is deliberate and is exactly what a fidelity pass
  flags as a bug.

- **Stars drift at `STAR_DRIFT = 0.35`, not the Portfolio prototype's
  0.09 (2026-08-21, owner-set).** The field read as so slow the motion
  was not visible. It was not: `vx`/`vy` seed as
  `(Math.random() - 0.5) * SPREAD`, so mean absolute speed is SPREAD/4
  px per frame — at 0.09 that is **1.35 px/s** at 60fps, i.e. a star
  needs **~17.8 minutes** to cross a 1440px viewport.

  | screen | spread | mean px/s | crosses 1440px |
  | --- | --- | --- | --- |
  | Portfolio Revolution.dc.html | 0.09 | 1.35 | ~17.8 min |
  | Blog.dc.html | 0.08 | 1.20 | ~20.0 min |
  | Admin.dc.html | 0.16 | 2.40 | ~10.0 min |
  | **current** | **0.35** | **5.25** | **~4.6 min** |

  **Tuned by eye in one session: 0.09 → 0.16 → 0.35.** 0.16 was
  proposed and taken first because `Admin.dc.html` runs this same star
  field at exactly that — the one faster value with a design source. On
  screen it still read too slow, and the owner set 0.35 directly.

  **⚠️ 0.35 has NO design source.** It is **3.89×** the Portfolio
  prototype and **2.19×** the fastest the design goes anywhere. That is
  a legitimate owner call — this is their site — but it is an
  aesthetic decision rather than a transcription, and it must not be
  defended as "what Admin does". It isn't.

  **Applies site-wide.** `StarfieldCanvas` is the shared ambient layer,
  so every page built from here on inherits it. That was the intent.

  **Twinkle (`s.t += 0.02 * s.ts`) was deliberately NOT touched** — only
  travel was asked for, and moving one lever at a time keeps the result
  attributable. If the field still reads too static, that 0.02 is the
  next lever, not this one.

  Named `STAR_DRIFT` at the top of `StarfieldCanvas.jsx` beside
  `WEB_LINK_PX`/`WEB_ALPHA`, following their precedent, so the next
  adjustment stays one edit.

  **Verified empirically, not just arithmetically.** A naive
  pixel-change count over a 4s gap reads **identical** at 0.09 and 0.16
  (8989 vs 9087) and is worthless — it **saturates**, because both
  values move a star far past its own ~2px diameter within 4s, so it
  fully vacates its old pixels either way. Freezing the twinkle does
  not help; the metric was never twinkle-bound. Measured at short gaps
  instead, with a **static field as the floor**:

  | `STAR_DRIFT` | changed px @300ms | @600ms |
  | --- | --- | --- |
  | 0 (static control) | 246 | 501 |
  | 0.09 | 3656 | 5026 |
  | 0.16 | 4612 | 6425 |

  The static row is the point, exactly as the 0-vs-61 rAF pair is
  elsewhere in this file: a broken probe also reports "no difference",
  and only the near-zero floor proves the metric responds to drift at
  all. Note the ratio reads ~1.3×, not the arithmetic 1.78× —
  changed-pixel count is a sub-linear proxy for displacement, already
  partly saturated at 300ms. **The speed ratio is exact arithmetic; the
  pixel proxy compresses it.** (Measured while the value was 0.16; 0.35
  was set afterwards and the arithmetic carries.)

  **⚠️ Guarded as "not the prototype's value", NOT as an exact number**
  — `StarfieldCanvas.test.jsx`. These are look-and-feel dials the owner
  re-tunes by eye, and the first version of this guard pinned `0.16`
  exactly, so the owner's very next adjustment turned the suite red for
  no defect. A test that fails on legitimate tuning trains people to
  edit the test without reading it, which destroys the thing it exists
  for. It now asserts direction — `WEB_LINK_PX < 150`, `WEB_ALPHA <
  0.14`, `STAR_DRIFT > 0.09` — plus that `STAR_DRIFT` actually reaches
  both axes, since a declared-but-unused constant is the same silent
  revert by another route. Verified both ways: 0.12/0.16/0.35/0.5 all
  pass, while reverting any constant to its prototype value fails.

  Do NOT "restore" 0.09 to match the Portfolio prototype; the mismatch
  is intentional, and it is exactly what a fidelity pass flags as a bug.

- **The About portrait is a different photograph from the prototype's
  (2026-08-21, owner-requested).** `about-portrait.jpg` (1200×1600, q90,
  798 KB) replaces the prototype's 980×1261 close-up, converted from a
  3024×4032 `about-portrait.heic` kept tracked as the source.

  **⚠️ HEIC is not a web format — only Safari decodes it.** Vite emits
  it without complaint and the `<img>` silently renders nothing in
  Chrome, Firefox and Edge. **Never point an import at the `.heic`.**
  The conversion used `sips` (no `cwebp`/`magick` on this machine, and
  `sips` cannot write WebP here).

  **No CSS changed, and the new image fits better than the old one.**
  `.portraitImg` already forces `aspect-ratio: 3/4`; the new source is
  natively 3:4, so `object-fit: cover` crops **nothing**, where the
  980×1261 PNG was being cropped. **`object-position: 50% 32%` is now
  inert** — do not "clean it up" without re-checking the intrinsic
  ratio, since it becomes load-bearing again the moment a non-3:4
  image is used.

  **⚠️ Two files share the name and only ONE is an orphan:**

  | path | status |
  | --- | --- |
  | `frontend/src/assets/about-portrait.png` | 0 code refs — **orphan**, left in place deliberately |
  | `docs/design/assets/about-portrait.png` | prototype line 202 + DESIGN.md line 27 — **design source, never delete** |

  `alt` was rewritten to `"Parindra Gallage leaning against a classic
  green Mini"`; the old copy described a different photograph.
  `AboutSection.test.jsx`'s `portrait()` helper moved off `alt` matching
  onto the class, so alt copy no longer fails four unrelated parallax
  tests.

  **⚠️ Composition is UNRESOLVED and is the owner's call.** This is an
  environmental shot with the subject small and upper-right, where the
  prototype's is a close-up. Cropping to the face is a composition
  decision and was deliberately not made here.

- **The terminal caret is a literal `#FCA311`, not `var(--acc)`
  (2026-08-21, owner-approved).** The prototype uses the token, which in
  light theme is `#7E4800` — dark brown on the panel's fixed `#0d1117`,
  measuring 2.54:1. The panel is a picture of a terminal and does not
  theme; its other seven body lines are already literal hexes. The literal
  is dark theme's own `--acc`, so dark is byte-identical and light goes
  from 2.54:1 to 9.36:1. Visible in light theme (brown → amber). Same
  shape as About's stat labels: an inherited contrast failure, raised
  rather than quietly transcribed.

  The `➜` line (`var(--faint)`, 3.33/3.12) and the chrome label
  (`#5c677d`, 3.04 both themes) are **NOT** fixed here — they are colour
  decisions and batch into PF-91 as one pass over terminal ink.

  Shipped in PF-85's follow-up; guarded in `ProjectsSection.test.jsx`
  against reversion to the token, with the `blink` animation re-confirmed
  still resolving afterwards.

- **Hover lifts are ungated under `prefers-reduced-motion`
  (2026-08-21, owner-delegated to Claude, decided and recorded here).**
  PF-74's `html[data-motion='reduced'] .reveal { transform: none }`
  (0,2,1) beat every section's `:hover` rule (0,2,0), so Reveal-wrapped
  cards did not respond to the pointer under reduce while `.bigCard` did.

  `motion.css` already collapses transitions under reduce, so an ungated
  lift is an instant resting-state change, not motion — the same category
  as the `border-color` shift beside it, and the same principle that
  leaves `CursorGlow` and the portrait tilt ungated. The prior state was
  incoherent rather than cautious.

  PF-83's audit contract is unweakened: 0 `getAnimations()`, 0 rAF,
  parallax still none, splash still absent — all re-measured against a
  motion-allowed control.

  **Implementation** — `Reveal.module.css`, one rule split into two:

  ```css
  html[data-motion='reduced'] .reveal            { opacity: 1; }
  html[data-motion='reduced'] .reveal:not(:hover) { transform: none; }
  ```

  `opacity` stays unconditional deliberately: hovering must never be able
  to make an element transparent, whatever its `data-reveal` state. The
  transform half is (0,3,1) — `:not(:hover)` contributes its argument's
  (0,1,0) — so it still beats `.reveal[data-type='pop']`'s
  `scale(.25) rotate(-28deg)` (0,2,0) at rest, which is what stops a pop
  element resting shrunk. While hovered it simply does not match, and the
  section's `:hover` inherits the same tie against `.reveal[data-reveal=
  'in']` that already governs it with motion allowed. **One mechanism in
  both modes** is the point, not two.

  **Measured in Chromium on the production build**, hover end states,
  reduce vs motion-allowed:

  | element | reduce | motion allowed |
  | --- | --- | --- |
  | Hero `.rolePill` | `-2px` at 63ms | `-2px` over 0.9s bouncy |
  | Hero `.loudCta` | `-2px` at 37ms | `-2px` over 0.9s bouncy |
  | About `.statCard` | `-4px` at 32ms | `-4px` over 1.05s |
  | Skills `.card` | `-6px` at 36ms | `-6px` over 1.05s |
  | Projects `.card` | `-8px` at 34ms | `-8px` over 1.05s |
  | Projects `.bigCard` | `-8px` at 39ms | `-8px`, **snaps** |

  Under reduce `transition-duration` reads `1e-05s`, so those tens of ms
  are sampling latency, not easing. Motion-allowed timings are unchanged
  from before the split (±6ms of the pre-change run).

  **The audit contract, re-measured, with the control beside it:**

  | check | reduced | motion allowed |
  | --- | --- | --- |
  | `data-motion` | `reduced` | `null` |
  | root `scroll-behavior` | `auto` | `smooth` |
  | splash mounted | false | false |
  | rAF in 1 idle second | **0** | **69** | ⚠️ *not reproducible — see the rAF caveat in Silent failures*
  | `getAnimations()` **running** | **0** | **28** |
  | About portrait transform | `scale(1.02)` resting | `scale(1.1)` + 92.6px parallax |
  | 44 `[data-reveal]`, not at rest | **0** | 10 (below the fold) |

  ⚠️ **`getAnimations()` TOTAL is 1 under reduce, and that is not a
  violation** — it reads 1 in *both* modes, which is what proves it.
  Phase 1's `ScrollToTop.jsx:34` writes `animation: fadeInUp .3s ease
  both` inline; `fill-mode: both` keeps a **finished** animation in the
  list forever. Under reduce it reports `playState: "finished"` at
  `duration: 0.01ms`, i.e. `motion.css` collapsed it correctly. PF-83
  recorded 0 because its probe never scrolled far enough to mount that
  button. **"Is anything moving" is the RUNNING count, not the total** —
  filter on `playState === 'running'`.

  Note `motion.css:70` has carried "Hover transitions KEPT —
  user-initiated and brief" as stated policy since PF-73. This change
  makes the code match the policy; the `.reveal` rule had been silently
  contradicting it for `transform` only. Guarded by four tests in
  `components/motion/__tests__/Reveal.test.jsx`, all mutation-tested —
  merging the rules back, dropping the `:not()`, and hover-scoping the
  opacity half each fail.

- **CORS allows a localhost dev-port range in NON-PRODUCTION only
  (2026-08-19, owner decision, shipped in PF-85).** This closes the
  long-standing Outstanding-work item.

  ```js
  const DEV_ORIGIN = /^http:\/\/localhost:(51[7-9][0-9]|5200)$/;
  if (ALLOWED_ORIGINS.includes(incomingOrigin)) return callback(null, true);
  if (process.env.NODE_ENV !== 'production' && DEV_ORIGIN.test(incomingOrigin))
    return callback(null, true);
  return callback(new Error(`CORS: Origin "${incomingOrigin}" is not allowed`));
  ```

  **The exact-match array is unchanged and production behaviour is
  provably identical** — `corsOptions.test.js` asserts every case in both
  environments, including that each dev port is REJECTED under
  `NODE_ENV=production`, and that suffix/prefix attacks
  (`localhost:5176.evil.com`, `notlocalhost:5176`), `https`, `127.0.0.1`
  and out-of-range ports are rejected even in development. The guard is
  `!== 'production'` rather than `=== 'development'` so a bare
  `node server.js` with no NODE_ENV still gets dev behaviour.
  Note `.env.e2e` sets `NODE_ENV=test`, so the branch is live under E2E —
  harmless, since 5174 is exact-matched anyway.

- **Projects: the big card is chosen by `order`, the badge by `featured`
  (2026-08-19, owner decision).** Full reasoning in the PF-85 entry above.
  The short version, because it looks like a bug from either end: two
  projects are `featured: true`, only one card shows a FEATURED badge, and
  the badge sits where the numeral would be. Do not "fix" either half.
  An unfeatured first project renders **nothing** in that slot — never a
  `01`.

- **ClearDrive.lk keeps 10 tech pills; the prototype's 9 is stale
  (2026-08-19, owner decision).** The prototype omits `Tailwind CSS` for
  that one card. The API is the source of truth for project content, so a
  fidelity pass must not cut the pill back to match the export. The other
  three cards match `seed.js` exactly. Opposite resolution to PF-82's
  skill-order finding, and deliberately so — there the prototype was right.

- **`data-terminal` is attached to the terminal panel (2026-08-19, owner
  approved).** Activates `tokens.css`'s light-theme shadow rule, which had
  never matched an element in this repo OR in the prototype. Light theme
  only, alpha `.5 → .22`; dark byte-identical. Measurements in the PF-85
  entry. Do not remove the attribute to "match the prototype" — the
  prototype's omission is a wiring gap, not a design choice, and this was
  raised and approved before shipping.


### PF-91 — the accessibility contrast pass (2026-08-28)

Every value changed below was the prototype's own, so each was raised,
measured and approved before shipping — the PF-83 stat-label precedent.
**All five groups were approved by the owner.** Recorded here because a
fidelity pass diffing against `docs/design/` will flag every one of them.

**Result: ZERO AA failures across the Phase 2 surface, both themes**,
measured over **259 nodes per theme** — 246 on the page, 10 on the splash
**mounted**, 3 in the Contact form's live error and sent states. Zero
regressions; no previously-passing value moved except the four covered
below.

| Group | Change | Blast radius |
| --- | --- | --- |
| **A** | `--muted2` → `--muted`, **DARK only**, on tinted surfaces | 4 rules: footer `.role` `.bio`, Contact `.fieldLabel`, Blog `.rowMeta` |
| **B** | `--faint` → `--muted` | hero `.scrollLabel` + splash `.progressLabels` `.skip` (dark only); footer `.copyright` (**both** themes) |
| **C** | the terminal panel's ink becomes literal | Projects `.lineMuted`, `.terminalLabel` → `#8b949e` |
| **D/F** | `--ok` light `#0E7A55` → **`#0B6446`**, 4 sites adopt `var(--ok)`/`var(--danger)` | the token + footer ×2, splash ×1, Contact ×2 |
| **E** | both Blog separators unified on `var(--acc)` at `.9` | Blog `.featuredSep`, `.rowSep` |

**Group A/B scope on SPECIFICITY, never emission order.**
`:global(html[data-theme='dark']) .x` is (0,2,1) against the base rule's
(0,1,0). Light passes for all of Group A and is deliberately untouched —
the base rules still read `--muted2`, guarded in both directions.

**⚠️ Group B took TWO steps, not one, and the reason is the footer.**
`--muted2` would have cleared the page-ground nodes at **4.55** and the
light copyright at **4.69**. The owner rejected that headroom on
evidence: this project has re-litigated a borderline value three times
(the `--muted2` stat labels, the 4.47 status dot, and the PF-91 ticket's
own 4.49 that was really 4.51), and **the footer copyright itself went
4.97 → 4.28 purely from the 2026-08-27 surface tint — a change that
touched none of its own colours.** A margin under 0.2 does not survive a
backdrop change.

**⚠️ `.skip` IS A SEPARATE RULE FROM `.progressLabels`.** A scoped rule
naming only `.progressLabels` fixes LOADING and the percentage and
silently leaves SKIP INTRO at 3.56. And `.skip` has a hover, so its hover
colour is **re-declared inside the dark block** — `:global(html[data-theme=
'dark']) .skip` is (0,2,1) and `.skip:hover` is (0,2,0), so the theme rule
would win *while hovered* and the accent hover would never appear. That
is the ScrollToTop bug of 2026-08-25 exactly.

**⚠️ THE GROUP C / GROUP D BOUNDARY — the same hex gets opposite answers
in one ticket, and that is correct.** Projects' `.lineSuccess` stays the
literal `#34d399` while Contact's `.sentText` and the splash's
`.bootLineGreen` become `var(--ok)`. **The SURFACE decides, not the
colour**: the terminal is deliberately dark in both themes (DESIGN.md
line 85), so a token that flips cannot be painted on it — `#34d399`
measures **10.54 there in both themes and 1.72 on the light form**. Three
files apart, this looks exactly like an oversight, and "unifying" it
would reintroduce a 2.82:1 line while reading as a cleanup. Guarded:
`ProjectsSection.test.jsx` asserts the terminal rules name **no theme
token at all**, and pins the two raised values so a silent revert to a
failing literal also fails.

⚠️ `var(--shd)` **stays** on that panel — it is a drop SHADOW cast onto
the page behind it, which does flip, and no contrast rule reaches a
shadow. Ink is literal there; the shadow is not. Guarded both ways.

**⚠️ `--ok` and `--danger` had ZERO consumers before this ticket** — declared
in PF-67, read by nothing but Tailwind's alias for three sprints, while
four sites hardcoded the identical pair and two of them shipped a
light-theme failure. Routing through the token makes the next green
decision one edit rather than four. `--danger` needed **no value change**:
`#B4231F` is the prototype's own light value at 5.88, failing only
because the literal bypassed it.

**⚠️ `--ok` light is `#0B6446`, and the framing matters.** `applyTheme()`
line 868 **already** recolours `[data-ok]` from `#34d399` to `#0E7A55` in
light — the design saw this problem and moved the value. It landed short:
**3.67** on the badge, **4.43** on the dot. This EXTENDS the design's own
fix rather than correcting an oversight, which is what makes the
deviation small. A fidelity pass "restoring" `#0E7A55` would reintroduce
the failure it looks like it is fixing; pinned by a test.

**⚠️ `.availabilityDot` is deliberately NOT routed through `--ok`.** Only
two elements carry `[data-ok]` in the prototype — the label and the CI
dot — and the 7px decorative disc is not one of them. Recolouring it too
would be a design change wearing an accessibility fix's clothes. Guarded.

**Group E is a fidelity fix as much as a contrast one.** The prototype
implements one mark twice — a literal `rgba(252,163,17,.7)` on the
featured card (line 435) and `var(--acc)` at `.65` on the compact rows
(line 446). Only the **literal** collapses in light, keeping dark theme's
amber on paper at **1.44**; the token resolves to `#7E4800`. Unifying
them fixes the featured one for free. ⚠️ The alpha is `.9` because `.85`
**measured 4.46** against the featured card's own backdrop — 0.04 short,
found by measuring rather than by arithmetic on a neighbouring backdrop.

⚠️ **This is the one place a passing value moved**: the four dark
separators went 5.20/4.51 → 8.18/7.79. Unavoidable and approved — one
alpha necessarily serves both themes.

**⚠️ `main[tabindex="-1"]:focus { outline: none }` IS THIS REPO'S FIRST
AND ONLY `outline: none`.** PF-83 and PF-87 both record that there were
zero; both entries are corrected in place. It exists because the skip
link was scrolling to `<main>` without moving focus, and fixing that
exposed first our ring and then Chromium's UA default — see the
`:focus-visible` entry in Silent failures for both.

**The scoping is the entire justification, and it must not be quoted to
excuse an unscoped one.** A negative tabindex means "programmatically
focusable, NEVER a tab stop", so this element is only ever focused to
move the reading position. **WCAG 2.4.7 governs components a keyboard can
OPERATE** — the discriminator is operability, not focusability. Every
real tab stop keeps its ring: re-measured **11 of 11 at `2px solid`**,
999px radii intact. Guarded by extracting the selector that owns the sole
`outline: none` and asserting it is exactly this one; a widened selector
fails.

### PF-91 exemptions — decided, not omitted (2026-08-28)

Recorded as decisions so the next sweep does not read two 1.19 ratios and
six sub-3.0 borders as misses.

**The six decorative numerals stay.** Projects `02/03/04` at
`rgba(252,163,17,.28)` (1.75 dark / 1.19 light) and Blog `02/03/04` at
`.3` (1.83 / 1.20). All six are `aria-hidden` and convey nothing the
card's own heading and link do not. **WCAG 1.4.3 exempts text that is
pure decoration.**

**The 17 control borders stay, argued per row rather than as a block** —
a blanket exemption is what gets quoted later to excuse a border that
*is* the only affordance. 1.4.11 applies to indicators **required to
identify** a control, and every one of these sits on a control whose
LABEL passes comfortably:

| Border | Border ratio | The label that carries it |
| --- | --- | --- |
| footer SCROLL TO TOP pill | 1.58 / 1.41 | **7.25 / 5.46** |
| navbar links, CONTACT, ADMIN | ~1.6 / ~1.4 | **7.27 – 9.79** |
| theme toggle | 1.58 / 1.41 | non-text 9.48 / 5.56, already clear of 3.0 |
| Blog featured card, 3 compact rows | 1.58 / 1.41 | **not controls at all** |

**⚠️ The caret reads 1.00 in a single-sample sweep and is NOT a
failure.** `blink` is `step-end`, so half of every cycle sits at
`opacity: 0`. Sampled across 40 frames it alternates 0 and 1 as
specified, and its colour is PF-85's literal `#FCA311` at **9.36** on the
panel — untouched by PF-91. A sweep that reports it as failing has
sampled the dark half.


### Link icons, the live dot and the hero blob — owner-requested (2026-08-29)

Five sanctioned deviations from one request. Full measurements and the
file map are in the dated section above; these are the decisions a
fidelity pass must not undo.

- **⚠️ NINE LINKS CARRY AN ICON THE PROTOTYPE DOES NOT HAVE.** About's
  `EMAIL ME`, Projects' `VIEW ON GITHUB`, Contact's email / `GITHUB` /
  `LINKEDIN`, and every footer ELSEWHERE row. All nine are bare text in
  `Portfolio Revolution.dc.html`. Official marks for GitHub, LinkedIn,
  Facebook and Instagram; Material's `email` envelope for the three
  `mailto:` links. `components/icons/`, inline SVG on `currentColor`,
  every one `aria-hidden`.

  ⚠️ **Do NOT reach for `public/icons.svg`.** It has zero consumers and
  hardcodes `fill="#08060d"` / `stroke="#aa3bff"` on every path, so it
  neither themes nor follows a hover. `ThemeToggle.jsx` is the
  precedent, not that sprite.

  ⚠️ **The trailing `→` / `↗` are the prototype's and STAY.** The mark
  is an addition to the label, not a replacement for its arrow.
  Guarded.

- **⚠️ LIVE SITE CARRIES A PULSING GREEN DOT, AND IT ADDED THE ONLY
  NON-PROTOTYPE KEYFRAME IN THE LIBRARY.** `@keyframes dot-ok`, the
  33rd. It cannot be expressed by reusing `dot`, which writes amber into
  its own `box-shadow` — a rule cannot override a colour an animation is
  writing. `keyframes.test.js` keeps `BASE + VARIANTS` at exactly the
  design's 32 and lists this separately under `ADDITIONS`; do not fold
  it into `BASE`.

  Fill is `var(--ok)` and flips; the GLOW is a literal green in both
  themes, deliberately, because light theme's `#0B6446` glowing paints a
  dark smudge. The resting `box-shadow` on `.liveDot` is not redundant
  with the keyframe — it is what the element falls back to once
  `motion.css` collapses the animation, and `dot-ok` carries no
  fill-mode on purpose.

- **⚠️ `.blobC` IS AT z-index 2, OVERRIDING THE PROTOTYPE'S 4.**
  Owner-reported as a "mist or blurry thing in front of the image"; it
  was the only blob above `.portraitFrame`'s 3, a `blur(9px)` haze
  drifting across the portrait on a 19s loop. **Moved behind, not
  deleted** — it keeps every other value and the cluster is still four
  blobs. The PF-80 entry's "z-index 4 is the prototype's, and that is
  intentional depth" is superseded for this element only. Verified by
  hit-test: 24/25 sample points over the portrait now return the image
  itself, the 25th a floating chip.

  ⚠️ `.portraitImg`'s two-layer `mask-image` was NOT touched and is the
  other thing that could be called misty — static, at the edges, and
  itself owner-approved from 2026-08-17. Ruled out, not missed.

- **Both marquee bands run at 50 px/s** (hero 84s, footer 70.7s), down
  from 70 px/s. Equal SPEED is still the contract and equal duration is
  still the bug; the durations are un-round because they encode one
  speed over two different distances.

- Design fidelity is absolute. Nothing visible is removed or simplified for
  performance.
  **Three sanctioned exceptions exist to the "nothing is reduced" half**, all
  asked for by the site's owner. They are the only three — the third is the
  hero marquee's slimmed band, recorded with the other PF-80 deviations below.
  ⚠️ The 2026-08-24 marquee `copies` change is **not** a fourth: it ADDS
  repeats rather than removing anything, so it sits under the
  "never substitute your own judgement, even upward" rule instead. Same
  process — raised, reasoned, approved, recorded — different direction.
  First, the star-to-star
  cursor web in `StarfieldCanvas.jsx` reads more prominently on the real site
  than in the prototype, so on 2026-08-16 the user asked for it to be toned
  down — **twice now**, both times on direct request:

  | | `WEB_LINK_PX` | `WEB_ALPHA` |
  | --- | --- | --- |
  | prototype (lines 826, 828) | 150 | 0.14 |
  | 2026-08-16 | 130 | 0.1 |
  | **2026-08-17 (current)** | **105** | **0.065** |

  Both are named constants at the top of that file with the reason attached.
  They compound — a shorter link distance draws fewer lines, and each surviving
  line is fainter because alpha falls off across the shorter span — so 105/0.065
  is roughly a third of the prototype's visual weight, not two thirds.
  **The cursor's accent-coloured spray (cursor → star) is a separate line family
  and is still at the prototype's 0.3.** Every reduction so far has been to the
  star-to-star web only, because that is what was asked each time; at 3× the
  web's alpha it is now the loudest part of the cursor effect, and it is the
  next lever if the effect still reads too hot. Do not "restore" any of these —
  the mismatch is a design decision by the site's owner, not a transcription
  slip, and it is exactly the kind of thing a fidelity check flags as a bug.

  Second, **the splash's two travelling scan lines are removed** (2026-08-17).
  The prototype has two `<div>`s inside the scanline layer running the
  `scanline` keyframe down the full height — 2px orange at 4.2s, 1px white at
  6.4s with a 1.2s delay. The owner asked for them gone: they read as two
  horizontal lines scrolling down the screen. Both were **confirmed animating
  correctly first** — this was a design call, not a repair. Three things to
  keep straight:
  - The **elements** are gone, not just their animation. Removing only the
    animation leaves two static gradient lines pinned at `top: 0`, which is a
    worse artefact than the motion complained about.
  - **`.scanTexture` stays.** It is a different element — the static CRT hatch
    over the whole splash — and has never moved. It is not one of the two.
  - The `scanline` **keyframe stays in `base.css`**, and
    `styles/__tests__/keyframes.test.js` still asserts all 32. Only the
    now-unused `kf-scanline` carrier came out of `animations.css`; re-adding it
    is one line if a screen needs it.
  The splash is therefore **12 animated elements, not 14** — the count in any
  older note or ticket predates this.
- **Hero deviations (2026-08-17, owner-requested).** Five changes to PF-80's
  hero, all asked for directly after seeing it live. None is in the prototype;
  do not "restore" any of them to it.
  - **A fourth item in the pill row: the "Lets build something loud!" CTA.**
    Styled as a copy of the OPEN TO OPPORTUNITIES badge's surface — same
    border, tint, glow shadow and lead dot. **The pill's `glowpulse` outline
    still breathes; only the dot's own `dot` pulse is dropped.** That split
    was specified explicitly and is the entire reason `.loudCtaDot` exists
    beside `.badgeDot` instead of reusing it: the two are visually identical
    and animate differently, so folding them into one class silently puts the
    pulse back. `.loudCta` deliberately does not `composes:` `.badge` either —
    they match today by intent, not by rule.
    Rendered as `<a href="#contact">`, not `<button>`: it moves the reader
    to another place in the document, which is what a link is for, and it
    matches the two CTAs below it. That also inherits the native smooth
    scroll and its reduced-motion override, keyboard activation and
    open-in-new-tab, none of which a `<button>` + `scrollTo` would carry.
    Copy is transcribed exactly as written, sentence case and all — the
    badge's own text is uppercase in content, not via `text-transform`.
  - **Two extra floating chips — the prototype has eight, the hero now has
    ten.** Every added chip continues the reveal stagger rather than
    restarting it, and takes a float duration and delay no other chip uses,
    so none of them drift in phase. A test asserts all ten durations are
    distinct, and a browser pass confirms zero overlap between any pair of
    the ten boxes at 1440px.
    - **Next.js** — `top: 36%; left: -5%`, the free gap on the left flank
      between React (top 16%) and PostgreSQL (~top 57%). Float 6s / .65s,
      reveal 1280. Its dot is **`var(--strong)`, not a fixed brand hex**
      like every other chip: Next.js is monochrome, and a hardcoded black
      or white disappears into one of the two themes. `--strong` flips
      (#ffffff / #0B1220) and reads in both.
    - **Java** — `bottom: 4%; right: 12%`, below Docker on the right flank
      and clear of MongoDB over on the left. Float 6.35s / 1.25s, reveal
      1340. Dot is Java's **blue `#5382a1`, not its orange**: the orange
      marks sit a few degrees from Git's `#e8703a` and the accent itself,
      and this chip's nearest neighbours are already warm. Square, the
      least-used of the three dot shapes, between a diamond and a circle.
  - **The portrait's edges are masked, not painted as-is.** `hero-ai.png` is
    an egg-shaped cutout on transparency: the sky and the decorative arcs
    stop at a hard rim, and the turtleneck is cut flat by the bottom of the
    frame. ⚠️ **The prototype ships both edges raw IN DARK ONLY — this
    sentence used to say "both edges raw" flatly, and that is false in
    light theme. Corrected in PF-90.** `applyTheme()` (prototype line
    862, not the 853-856 the PF-90 ticket cites) applies a light-mode-only
    mask to `[data-heroimg]` and clears it in dark:

    ```js
    const m = this.themeLight ? 'radial-gradient(62% 68% at 50% 44%, #000 30%, rgba(0,0,0,.7) 56%, rgba(0,0,0,.28) 76%, transparent 92%)' : '';
    el.style.webkitMaskImage = m; el.style.maskImage = m;
    ```

    So the design DOES soften this image — just in one theme, and from
    the script block rather than the markup. **This is the fourth time a
    prototype element's real behaviour lived in JS rather than its
    `style` attribute** (`data-cardbg` PF-85, `data-cv` PF-87,
    `data-strip`/`data-ok` PF-88). Grep the script for the element's own
    attribute; do not read the markup and stop.

    ⚠️ **`data-heroimg` is NOT a dangling hook of the `data-terminal`
    kind, and the distinction matters.** `data-terminal` had a CSS rule
    in `tokens.css` with no element to match. `data-heroimg` has
    **neither** — zero occurrences anywhere in `frontend/src`. There was
    never a rule to transcribe, because the prototype drives it from JS.
    Nothing dangles; it simply was not ported.

    **PF-80's mask STANDS (owner-approved, and unchanged by PF-90).** It
    differs from the design's in two ways, both deliberate and both now
    measured side by side in a browser:

    | | PF-80 (shipped) | prototype |
    | --- | --- | --- |
    | dark | softened | **raw** — hard oval rim, flat-cut shoulders |
    | light | softened, tighter disc | softened, wider//more diffuse vignette |

    Captured side by side during PF-90 and viewed, but the shots live in the
    session scratch rather than the repo — same as PF-83's audit scripts, and
    they are one `mask-image` override away from being reproduced. The
    honest read: the prototype's light mask is the
    softer of the two and melts the image further into the paper, while
    PF-80's keeps more of the picture and leaves a slightly more defined
    circular edge. Neither is wrong; PF-80's also fixes dark, which the
    design leaves raw. **Changing it is an owner call, not a fidelity
    fix.** `.portraitImg` now carries
    two intersected mask layers — a radial that dissolves the oval rim on
    every side, and a linear that additionally dissolves the flat bottom,
    which the radial alone barely reaches (the bottom-centre sits nearest
    the ellipse's minor axis and stays near-opaque right where the shoulders
    are). Three things are load-bearing:
    - **Both radii are 50%.** That inscribes the ellipse in the element box
      so the mask reaches zero *at* the edge. Anything over 50% clips the
      gradient mid-fade and puts a hard line back — the exact artefact this
      removes, and it reads as "the mask didn't work" rather than as a
      wrong number. A test pins both radii at ≤ 50%.
    - **Both `mask-composite` spellings are present** — standard `intersect`
      and legacy `-webkit-mask-composite: source-in`. With neither, the
      property defaults to `add`: the layers union instead of intersecting,
      which covers nearly the whole box and silently hands back the
      unmasked image. Also guarded by a test.
    - **Box-relative percentages only line up because the box tracks the
      picture.** `height: 100%` with width auto derives from the intrinsic
      ratio, so `object-fit: contain` letterboxes nothing. Verified in
      Chromium: rendered box ratio 0.798 == intrinsic 0.798. Set a width
      here and the mask geometry silently stops matching the image.
  - **The marquee band is slimmer** — `.marqueeInner` padding 14px → 8px,
    `.marqueeText` font `clamp(20px,2.6vw,34px)` → `clamp(13px,1.6vw,21px)`,
    and its inter-repeat `padding-right` 34px → 24px so the gap stays
    proportional instead of opening up. Measured in Chromium at 1440px: the
    band goes **84px → 52px, a 38% reduction**. Both halves are needed —
    dropping the padding alone barely moves it, because the line box
    dominates. **The strip stays full-bleed**; "reduce the width" was
    confirmed to mean thickness, not horizontal extent, and a test asserts
    no `max-width` or horizontal margin creeps onto `.marqueeWrap`.
    Note `getBoundingClientRect().height` reads ~82px here and is not the
    band: the wrapper is rotated -1.1deg, and a 1440px-wide element rotated
    that far adds ~28px to its axis-aligned box. Measure `offsetHeight`.
- **Transparent section backgrounds, site-wide (2026-08-18,
  owner-requested).** Every section wash is removed so the
  `StarfieldCanvas` reads continuously behind the whole page. The owner's
  reasoning: the banded look read as a grid of stacked panels, and the
  galaxy is more visible and cleaner without it. Four sections carried one;
  About and Projects already had none, which is what made the banding
  obvious.

  | Section | Prototype background, now removed |
  | --- | --- |
  | Hero | `radial-gradient(120% 90% at 78% 18%, rgba(--srf,.62) 0%, rgba(--gnd,.55) 62%)` |
  | Hero | **plus a separate 74px grid LAYER — see below** |
  | Skills | `linear-gradient(180deg, rgba(--gnd,.35), rgba(--ftr,.72) 50%, rgba(--gnd,.35))` |
  | Blog *(Phase 1)* | `linear-gradient(180deg, var(--bg), var(--bg-surface) 50%, var(--bg))` |
  | Contact *(Phase 1)* | `linear-gradient(180deg, var(--bg), var(--bg-surface))` |

  **⚠️ The hero needed TWO removals, and the second was missed on the first
  pass.** Clearing `section.hero`'s wash left the grid still on screen,
  because the lattice is not a section background at all — it is its own
  absolutely-positioned layer, `.parallaxGrid`, on the prototype's
  `data-para="0.12"` element (line 84): two 1px `rgba(252,163,17,.05)`
  gradients at `background-size: 74px 74px`, radially masked.

  Worth naming why it was missed, since the same trap is still live for
  Projects/Blog/Contact in Sprint 12. This file already described that
  element — "Line 84 is the hero's grid at `0.12`" — in the PF-80 parallax
  entry, where "grid" reads naturally as the *layout* grid, and the hero
  does have one of those two lines below (`display: grid` on `.inner`).
  Grepping section rules for `background` therefore found the wash and not
  the lattice. **Grep for `background-size` and `background-image`
  separately**; a tiled decorative layer has neither the word `background:`
  nor a section selector.

  **The whole component went, not just the `background-image`.** The grid
  was that element's only visual content, so keeping it would have left an
  invisible div running a scroll listener and a `requestAnimationFrame`
  write per frame for something nobody can see — the splash scan-line
  lesson again. Removed with it: `HeroParallaxGrid`, its render site, the
  `.parallaxGrid` rule, the now-unused `useReducedMotion` and
  `computeParallaxTransform` imports in that file, four parallax tests, and
  the test file's rAF harness, which existed only to drive them.

  **`computeParallaxTransform()` itself stays** — `AboutSection`'s portrait
  still uses it at `0.05`, and `utils/__tests__/parallax.test.js` still
  covers it. **The hero now registers no scroll listener at all**; the
  portrait tilt's `pointermove` is a different listener and is untouched.
  Both facts are asserted in `HeroSection.test.jsx` rather than left
  implied.

  Phase 1's `global.css` has a second, unrelated grid — `.grid-bg`, 60px
  indigo — which is **not** this one and is still in use by
  `NotFoundPage.jsx`. Do not delete it while cleaning up.

  **Card and panel surfaces are untouched** — `rgba(var(--srf), .52)` on
  Skills' cards, About's stat cards and the rest. Those carry the text and
  are what keeps it legible over a star field; only the SECTION went
  transparent. Guarded: `SkillsSection.test.jsx` asserts both halves — no
  section background, and the card surface still present.

  Guarded in `HeroSection.test.jsx` and `SkillsSection.test.jsx` as an
  **absence**, deliberately, because the prototype still has these
  gradients. A later fidelity pass diffing the two reads a missing
  background as an un-transcribed value and paints it back; the test says
  it is intentional. Note both guards must strip CSS comments before
  asserting — the rules document the removed gradient in place, so a raw
  `not.toContain('gradient')` matches the note explaining the absence.
  That tripped twice while writing them — see the Silent-failures entry on
  raw-text CSS assertions matching comments.

- **⚠️ THE FOOTER TAKES THE NAVBAR'S SURFACE — THIS REVERSES THE SCOPE OF
  THE 2026-08-18 WASH REMOVAL (2026-08-27, owner-requested).** Recorded
  as a reversal rather than a fresh value, because a fidelity pass that
  finds only the new declaration will read it as a transcription slip and
  a pass that finds only the 2026-08-18 entry will delete it.

  **What changed.** `.footer` now carries
  `background: rgba(var(--ftr), .86)` plus `blur(16px)` — the header's
  treatment verbatim, not a value invented here. `Footer.test.jsx`
  asserts the two rules match property for property, so the
  justification cannot quietly drift away from the implementation.

  **What did NOT change: the prototype's own gradient is still omitted.**
  Line 543's `linear-gradient(180deg, rgba(var(--gnd),.4),
  rgba(var(--ftr),.86))` remains untranscribed and is still guarded as an
  absence. A flat token tint has no vertical ramp, so it does not
  reintroduce the stacked-panel banding the 2026-08-18 decision targeted.
  **Keep the two straight** — restoring the gradient is still wrong.

  **The narrowing that makes it coherent: chrome vs section.** The
  2026-08-18 decision strips *section* washes so the `StarfieldCanvas`
  reads continuously down the page. The navbar has always carried this
  exact surface at the top and was never in scope. Giving the footer the
  same one makes the two ends of the page matching chrome rather than
  making the footer a sixth banded section. That is a real narrowing of
  the original scope, not a loophole — and it is the owner's call.

  **⚠️ THE BRIEF'S OWN PREMISE WAS WRONG, IN THE OWNER'S FAVOUR, AND HE
  ACCEPTED THE CORRECTION.** It cited `--ftr` light as `233,227,216` and
  predicted a 4/5/7 channel delta — "a barely-visible tint over paper".
  **`--ftr` light is `226,212,190`** (`tokens.css:108`, "tan chrome"):

  | | composited | delta vs `--bg` |
  | --- | --- | --- |
  | brief's assumed value | 234,228,217 | −3 / −4 / −6 |
  | **real value** | **228,215,195** | **−9 / −17 / −28** |

  Pixel-sampled on the rendered page, not only computed: the empty footer
  surface goes `rgb(226,223,216)` → `rgb(222,210,192)` in light and
  `rgb(16,20,26)` → `rgb(19,24,38)` in dark. It reads as **warm tan
  chrome in light and navy chrome in dark**. It does not read as "no
  change".

  **⚠️ THE PRICE, RECORDED BECAUSE IT IS THE REAL COST OF THE REVERSAL
  AND NOT JUST THE VERDICT: the star field behind the footer is roughly
  halved.** Luminance RMS in an empty footer patch:

  | | before | after | |
  | --- | --- | --- | --- |
  | dark | 0.00253 | 0.00107 | **−58%** |
  | light | 0.01963 | 0.01138 | **−42%** |

  That is exactly what the 2026-08-18 decision existed to protect, and it
  is being spent deliberately. `GrainOverlay` is z-70, *above* the
  footer, so what is lost is the star field at z-0; the grain survives.

  **Two things that were checked and need nothing:**
  - **The marquee band.** Its fill is `var(--acc)` at full opacity since
    the 2026-08-25 pass, so the surface behind it is irrelevant —
    measured byte-identical before and after, `rgb(252,163,17)` dark /
    `rgb(126,72,0)` light.
  - **The STATUS card survives**, contrary to the brief's worry that it
    might vanish. Light: composited `rgb(246,242,236)` → `rgb(241,234,222)`,
    still **+13/+19/+27** clear of the new footer surface — a lighter
    panel on a tan ground rather than near-invisible on paper.

  **⚠️ AA GOT WORSE, AND PF-91 MUST USE THE POST-CHANGE NUMBERS.** The
  full table is in the PF-90 entry. Summary: **1 → 3 failures per theme**,
  with the copyright newly failing in light (4.97 → **4.28**) and the role
  line and bio newly failing in dark (both **4.30**). The mechanism is the
  one this file already documents — `--muted2` and `--faint` on a
  *translucent surface* rather than on the page ground. Adding a surface
  is precisely what flips them.

  ⚠️ `-webkit-backdrop-filter` is declared FIRST here. The reverse order
  ships no blur at all — see the minifier entry in Silent failures.

- **The About portrait's caption is removed (2026-08-18,
  owner-requested).** The prototype's `GALLE, SRI LANKA — SEEING THE STACK`
  (line 205) is gone from `AboutSection`. Three things to keep straight,
  the same shape as the splash scan lines:
  - The **element** is gone, not just its text. An empty `position:
    absolute` div would still sit in the frame's bottom-left.
  - **`.portraitFade` stays.** It is a different element — the gradient
    that softens the photo's bottom edge into the frame — and it is not
    what was complained about. `.portraitCaption`'s rule was deleted from
    the module rather than left unused, with its values preserved in a
    comment there if it is ever wanted back.
  - The Contact section's own `GALLE, SRI LANKA · UTC+5:30` (prototype
    line 511) is **a different string in a different section** and is
    Sprint 12's. This removal does not touch it, and the location is still
    stated on the page once Contact is rebuilt.
  `AboutSection.test.jsx` asserts the caption is absent rather than simply
  dropping the old assertion — same reasoning as the backgrounds.

- **Phase 1 light-theme bridge in `tokens.css` (2026-08-18) — temporary,
  delete at cutover.** Not a design decision; a measured accessibility
  fix, recorded here because it is a visible change to three sections.

  Phase 1's `global.css` `:root` is a single **dark** palette that never
  flips: `--text-primary` is `#f1f5f9` in both themes. Against the light
  theme's warm paper that measures **1.11:1**. Projects had been unreadable
  in light theme for as long as light theme has existed; Contact only
  looked fine because its own dark wash sat behind the text, so removing
  that wash **exposed** the bug rather than causing it. Measured before and
  after with a real contrast calculation, not eyeballed.

  ```
                     before        after
  Projects heading   1.11:1   →   15.34:1
  Contact heading    1.11:1   →   15.34:1
  Contact body       2.10:1   →   12.98:1
  About body         6.35:1   →    6.35:1   (Phase 2, never affected)
  ```

  **⚠️ The fix is scoped to `#projects, #blog, #contact` and that scope is
  the whole of its correctness.** The same tokens are read by every admin
  panel, whose surfaces are the un-flipped dark `--bg-surface`. Widening it
  to a bare `html[data-theme="light"]` block would put dark text on those
  dark panels — the identical bug, moved to `/admin`, with nothing in the
  stylesheet looking wrong. Custom properties inherit, so declaring them on
  the section elements re-scopes everything inside and nothing outside.
  Verified empirically: `/admin/login` in light theme still reports
  `--text-primary: #f1f5f9` and `--accent: #818cf8`.

  Every value maps onto a Phase 2 token rather than fresh hex, so these
  sections track the real palette until Sprint 12 replaces them. That
  includes `--accent`, which is a visible colour change: Phase 1's indigo
  `#818cf8` measures 2.44:1 on paper against `--acc`'s 6.12:1 — the same
  failure `--acc` was deepened to `#7E4800` to avoid. Guarded by five
  tests in `styles/__tests__/tokens.test.js`, including one that fails if
  the rule is ever widened; all three mutations caught.

- **About's stat labels are one token lighter in DARK theme only
  (2026-08-19, raised and explicitly approved).** A sanctioned deviation,
  not a transcription — the prototype's line 218 is
  `color:var(--muted2);font-size:10.5px` on `background:rgba(var(--srf),.5)`,
  and PF-83 transcribed it faithfully before measuring it.

  | | value | measured |
  | --- | --- | --- |
  | prototype / light theme | `--muted2` | 5.95:1 — **compliant, untouched** |
  | dark theme, before | `--muted2` #6b7891 on rgb(13,20,35) | **4.15:1 — fails AA** |
  | dark theme, now | `--muted` #93a0b8 | **7.0:1** |

  AA wants 4.5:1 for small text, and 10.5px is small text. `--muted` is one
  step lighter and already the token About's own body copy uses, so this
  moves within the existing palette rather than introducing a colour.

  These four labels — `PROJECTS BUILT`, `TECHNOLOGIES`, `GITHUB REPOS`,
  `LEARNING` — were the **only** AA failures across the whole in-scope
  surface (header, Hero, About, Skills, both themes, every text node
  measured against its composited background). After the fix: zero, both
  themes.

  Three things about the implementation are load-bearing:

  - **Scoped to dark, so light theme does not move at all.** Light was
    never failing; a change to the base rule would have shifted a
    compliant colour for no reason. Re-measured after: still 5.95:1,
    still `rgb(79,93,118)`.
  - **⚠️ It wins on SPECIFICITY, not on source order.**
    `:global(html[data-theme='dark']) .statLabel` is **(0,2,1)** against
    the base rule's (0,1,0). Two rules tying at equal specificity and
    resolving on emission order is the bug that has bitten this project
    five separate times — `.rolePill`, `.statCard`, `.card`, `.pill`, and
    the section-eyebrow extraction — so this fix deliberately does not
    add a sixth. Do not "simplify" it to a second bare `.statLabel`.
  - **It relies on dark being an EXPLICIT attribute, and it is.** The
    FOUC guard writes `data-theme="dark"` at `index.html:31` and
    `applyTheme()` at `theme.js:63`, so dark is never merely the absent
    default. Had it been, the selector would have matched nothing and
    the fix would have silently done nothing in the one theme it exists
    for. Checked before writing it, not after.

  All four cards share one `.statLabel` class — the three from the
  `CountUp` map and the static "LEARNING" card — so one rule covers all
  four. Verified in the DOM, not assumed, and guarded by a test that
  counts exactly four and asserts "LEARNING" is among them. Five
  mutations, all caught; `:global()` follows `ThemeToggle.module.css:78`,
  the one existing precedent in this build.

- ~~**Card hover transitions (2026-08-18, owner-approved)**~~ —
  **WITHDRAWN in PF-93, 2026-08-21, owner sign-off granted in advance.**
  Kept visible rather than deleted, because the reasoning is the useful
  part and the same mistake is easy to make again.

  The deviation said: the prototype declares **no** `transition` on
  About's stat card (line 216) or Skills' category card (line 253) — only
  a `style-hover` end state — so both snap instantly, while PF-81 had
  given `.statCard` a 0.25s ease. Rather than revert About, the owner
  chose to keep the eased version and extend it to Skills, since two
  sibling sections disagreeing on hover reads as a bug.

  **The first half is true of the markup and false of the rendered page,
  which is where the whole thing came apart.** Both cards are
  `data-reveal="up"`, and `hideReveals()` writes
  `transition: opacity .85s, transform 1.05s cubic-bezier(.16,1,.3,1)`
  onto every `[data-reveal]` element as an inline style that nothing
  clears. An inline declaration beats the same element's `style`-attribute
  transition — it is written into the same block. So in the prototype both
  cards **hover-ease at 1.05s**, and the About/Skills inconsistency the
  deviation existed to resolve never existed on screen.

  **Where it came from: the prototype was READ, not RUN.** `support.js` is
  deliberately absent from this repo, so it cannot be executed, and the
  claim "both snap instantly" came from its stylesheet. That is a sound
  way to read a static value and a bad way to read behaviour that a script
  block installs at runtime. **To know whether a prototype element
  animates, check its JS as well as its inline `style`** — the same lesson
  as the entry on the persistent inline reveal transition, arrived at from
  the other direction.

  **What is true now**: all four gated elements let `Reveal` own
  `transition`, which matches the prototype for the three that have a
  counterpart. The hero's role pill (line 102 — **not** line 100, as this
  entry used to say) is the sharpest case: it genuinely does declare
  `transition:border-color .25s,background .25s,transform .25s` in its
  markup and PF-80 transcribed it faithfully, but `hideReveals()`
  overwrites it before it can apply, so the repo was rendering a value the
  design never renders. `.loudCta` has no counterpart at all — it is an
  owner-requested addition (2026-08-17) — so its deletion is a consistency
  call with its three siblings, not a transcription fix.

  Full measurements in the Silent-failures entry on `transition` and
  `Reveal`. Do not re-add a hover transition to either card.
- **Splash timing and the progress bar (2026-08-17, owner-requested;
  timing corrected 2026-08-19).** Deviations from the prototype, all in
  `Splash.jsx`:
  - **`SPLASH_MS` is 4500** — `Splash.jsx:31`, read fresh on 2026-08-19.
    The prototype's own sequence is 4600, so the splash is very slightly
    SHORTER than the prototype's, not longer.
    ⚠️ This entry previously said 7000, with boot lines hardcoded at
    `850 + i*1250` and browser measurements derived from that number.
    All of it was wrong — 4500 is the owner's explicit, final call, and
    every figure below is recalculated against it rather than edited.
    The tests never agreed with the old text: `Splash.test.jsx` has
    mirrored 4500 and passed throughout.
  - **The boot lines are DERIVED, not hardcoded.** They hold the
    prototype's proportions — 560 and 820 out of 4600 — so they re-scale
    with `SPLASH_MS` instead of needing hand-tuning every time it moves:
    `BOOT_FIRST_MS = round(SPLASH_MS * 560/4600)` = **548**,
    `BOOT_STEP_MS = round(SPLASH_MS * 820/4600)` = **802**.
    That puts the four lines at **548, 1350, 2152, 2954**.
    Measured in Chromium: observed 810/800/800ms apart, against the
    derived 802. Pinned to the prototype's absolute values instead they
    finish early and the remainder reads as a stall; hand-scaled to one
    particular `SPLASH_MS` they silently rot the next time it changes.
  - **The bar is derived from the exit, not racing it.** The prototype's
    increment is random — `Math.random()*6 + 2.2` every 140ms — so it
    finished around 2.9s and then sat at 100% while the splash ran on.
    That dead gap is what the owner reported. It now counts ticks:
    `pct = ticks / BAR_TICKS`, with
    `BAR_TICKS = ceil((SPLASH_MS - BAR_START_MS - BAR_TRANSITION_MS) / BAR_TICK_MS)`
    = `ceil((4500 - 220 - 250) / 140)` = **29**.
    **Derived, so changing `SPLASH_MS` alone keeps the two in step** —
    the desync came from two independently chosen numbers, and hardcoding
    the tick count would reintroduce exactly that. The
    `BAR_TRANSITION_MS` subtraction is not incidental: `.progressFill`
    has `transition: width .25s`, so writing 100% at the exit moment
    would leave the bar visibly still growing as the splash slides away.
    Computed, then measured in Chromium (polled every 10ms, times
    relative to component mount):

    | | computed | measured |
    | --- | --- | --- |
    | first tick | 220ms | ~219ms |
    | `width:100%` written | 4140ms | ~4239ms |
    | bar visually full | 4390ms | ~4469ms |
    | exit begins | 4500ms | 4500ms |
    | unmount | 5650ms | ~5649ms |

    The ~99ms the bar runs late is **chained-timer drift, not a bug**:
    the 29 ticks each schedule the next with `setTimeout`, so per-timer
    overhead accumulates rather than cancelling. It lands the bar
    visually full ~31ms before the exit, which is the intended look.
  - **The percentage is unpadded** — not the prototype's zero-filled
    `002%` / `050%`; the `padStart(3, '0')` is gone.
    ⚠️ The first label is **3%**, not the `2%` this entry used to claim:
    with `BAR_TICKS` at 29, tick one is `round(1/29*100)` = 3. Confirmed
    on screen at ~219ms after mount.
  - The exit is still a fixed timer and still **not** triggered by the
    bar reaching 100%. Do not "simplify" it into one — the bar measures
    nothing, and letting it drive the sequence hands the length to a
    decoration.
  All of the above are guarded by
  `components/splash/__tests__/Splash.test.jsx`, which mirrors the
  constants deliberately rather than importing them.
- **Smooth scroll — sanctioned exception (PF-79, 2026-08-17).** The prototype
  uses the browser's native instant anchor-jump: zero matches for
  `scroll-behavior`, and the only `behavior:'smooth'` in its script is in
  the REPLAY INTRO handler (line 1147).

  ⚠️ **That handler is NOT "a design-tool affordance", which is what this
  entry said until PF-88.** It is fully designed chrome — a styled,
  labelled button occupying one third of the footer's bottom row — and
  PF-88 built it. The claim was made to establish that `scroll-behavior`
  is not a design value, which it still isn't; it was wrong about the
  button. Anyone inheriting the old conclusion would have deleted a real
  feature, and deleting it is not even free: the bottom bar is
  `1fr auto 1fr`, so dropping the button un-centres the copyright. Smooth scrolling
  was raised explicitly and approved, per the PF-79 ticket. This is an
  *addition*, so it sits under the "never substitute your own aesthetic
  judgement, even upward" rule rather than the reduction rule above — same
  process, different direction. Do not "correct" it back to instant.
  Two things about the implementation:
  - **It predates PF-79.** `global.css:86` has carried
    `html { scroll-behavior: smooth }` since Phase 1, so the site was already
    scrolling smoothly before the ticket that sanctioned it. PF-79 restates the
    rule in `tokens.css` because `global.css` is the Phase 1 stylesheet and gets
    trimmed at cutover; if the behaviour is only declared there it silently
    disappears. Two identical declarations, so cascade order between them is
    irrelevant — do not "de-duplicate" by deleting the `tokens.css` one.
  - **CSS, not a JS `scrollTo`**, so it covers browser back/forward and a typed
    `#hash` URL, not just clicks on the navbar.
- **`--header-h` is 71px, and it is measured.** A `position: fixed` header over
  the viewport lands any anchor-jump target under itself unless something
  compensates. `tokens.css` publishes `--header-h`; **every section from PF-80
  onward carries `scroll-margin-top: var(--header-h)`.** 12px padding + 44px
  logo + 12px padding + 2px progress track + **1px bottom border** = 71, checked
  against the rendered header's `getBoundingClientRect().height` in Chromium.
  The PF-79 ticket estimated 70 by dropping the border — the classic
  wrong-by-a-little value that stays wrong silently. Guarded by
  `styles/__tests__/tokens.test.js`.
- No frontend animation libraries. CSS keyframes plus vanilla JS.
- Channel-triplet tokens stay as triplets.
- `tokens.css` imports **after** `global.css` in `main.jsx` — `global.css`
  contains both the Tailwind import and the phase-1 `:root` block.
- Tailwind `@theme` uses `var()` references to `tokens.css`, so colour utilities
  follow theme switching. Opacity modifiers (`bg-acc/50`) resolve via
  `color-mix()` at runtime. On engines without `color-mix()` (pre-2023) they
  degrade to full opacity — known and accepted. Verified against the emitted CSS
  in PF-70 Step 2.
- Fonts are deliberately **not** in `@theme` — `--font-*` collides with
  `tokens.css`'s own property names, so a `var()` reference would be
  self-referential. Typography goes through CSS Modules directly.
- `body { font-family }` is deliberately NOT set until cutover, so the Phase 1
  site keeps Inter.
- Contexts live in their own module, separate from the provider that supplies
  them. Settled in the Sprint 10 lint fix; see React conventions above.
- `SplashProvider` fails open: `SplashContext` defaults to `{ ready: true }` and
  `useSplashReady()` does not throw outside a provider, unlike `ThemeProvider`
  and `MotionProvider`. Deliberate: most routes (Admin, Blog) have no splash and
  never will, and every `Reveal`/`CountUp` usage and test that predates PF-75
  renders unwrapped and must keep working. A missing theme is a bug worth
  surfacing loudly; a missing splash is the normal case. Settled in PF-75.
- Splash read and write are **separate hooks** — `useSplashReady()` returns the
  boolean, `useSplashControls()` returns `{ ready, setReady }`. Unlike
  `useTheme()`, which bundles read and toggle because toggling is meant to be
  callable from anywhere, `setReady` should only ever be called by the splash
  itself (PF-78). Keeping it off the hook that `Reveal` and `CountUp` call stops
  every consumer of splash state from also being able to control it.
- **Mobile nav overlay (PF-79, now built)**: the ambient layer shows through —
  canvas and grain stay visible under the full-screen menu. The overlay uses a
  translucent surface tone (same move as the header's `rgba(var(--ftr),.86)` +
  blur), never a solid background. Settled when PF-79 was written: **z-index
  80** (clears grain's 70, stays under splash's 100), **breakpoint 768px**
  (this stack's Tailwind `md:` default, nothing prototype-derived), content is
  the same nav restacked — no item invented, none dropped.
  **The overlay root is itself the backdrop — one element, not a backdrop layer
  plus a panel on top of it.** Two stacked full-size layers means the upper box
  swallows every click, so a backdrop underneath receives only the clicks that
  miss the panel, which on a full-viewport panel is none. Built that way first
  and caught in a browser: backdrop-click did nothing. The surface, the
  centring and the click-to-dismiss have to be the same box, with the inner
  `<nav>` calling `stopPropagation()` so the theme toggle does not dismiss the
  menu. Guarded by two tests in `Navbar.test.jsx` — one that an outside click
  closes, one that an inside click does not.
- **Cursor-web frame budget (PF-76)**: if a real device misses budget, lower
  the 80-node web cap first — the 2600 star-density divisor is the fallback,
  not the first move. Note for whoever revisits this: the cap only bites on
  pointer-capable hardware. A touch-only phone never fires `pointermove`, so
  `mouse` sits at `(-9999,-9999)` and the near-cursor array stays empty
  regardless of the cap — the O(n²) web loop already costs ~nothing there. If
  a touch-only phone alone misses budget, the cost is the baseline star draw
  loop, and the divisor is what actually helps.
- Vocabulary deletion is hard-delete with cascade, behind an impact-count confirm.
- Cloudinary for file storage, behind a provider interface.
- Résumé is PDF only; a new upload hard-deletes the old.
- Blog content is `sections[]`, not a flat string.

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

Per-ticket `.md` guides are pasted into chat and are the source of truth for
that ticket — except where the prototype contradicts them.

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
