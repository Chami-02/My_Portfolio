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

### Sprint 12 — Main Page Completion, IN PROGRESS

Branch `sprint-12-main-page-complete`, cut from **local** `master` at
`c5669e5`, upstream `origin/sprint-12-main-page-complete` (verified — not
`refs/heads/master`, so the PF-75 trap is not in play). Scope: **Projects,
Blog teaser, Contact, Footer, then the Phase 1 homepage cutover and a full
responsive + a11y audit.** PF-85 → PF-92.

| Ticket | Work | Status |
| --- | --- | --- |
| PF-85 | Projects section, API-wired | ✅ |
| PF-93 | Reveal entrance regression — withdraw the hover deviation | ✅ |
| PF-86 | Blog teaser (Field Notes), API-wired | ✅ |
| PF-87 → PF-92 | Contact, Footer, cutover, audit | not started |

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

### Outstanding work — deferred deliberately, not lost

None of this is in Sprint 11's PR. Each was checked on 2026-08-19 rather
than copied forward:

- **One vacuous E2E test — `"Get In Touch" CTA scrolls to contact section`**
  (`e2e/homepage.spec.js`). Asserts Playwright's own auto-scroll, not the
  app; reports `flaky` rather than failing. Full measurement in Silent
  failures. Fix it with Sprint 12's Contact rebuild, pointing it at a real
  Phase 2 CTA.
- **`frontend/test-results/.last-run.json` is tracked** even though
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
- **⚠️ `mix-blend-mode: screen` is invisible in light theme.** The
  featured card's sweep layer computes to a +1/+1/+0 per-channel change
  over the light card's paper — pixel-differenced, not reasoned. It works
  in dark. The design's own value, so reported rather than adjusted; the
  failure mode is that the effect simply does not exist in one theme.
- **`frontend/src/assets/about-portrait.heic` is untracked and has ZERO
  consumers.** 1.2MB, file date May 2025, dropped into `src/assets/`
  outside any ticket — grepping `heic` across `src/` and `e2e/` returns
  nothing. Not PF-86's; noticed while checking the tree before hand-off.
  Delete it or track it deliberately.
- **`migrations/004-skill-order.js` has still NOT been run.** Confirmed
  live, not inferred: `GET /api/skills` returns LANGUAGES as
  `JavaScript → Python → Java → HTML5 → CSS3`, so **Java is still third**
  and the deployed order is the pre-migration one. Running it is a
  production write and remains the owner's call.
- **About/Hero API re-wiring.** Schema decision made (`numericValue` +
  `suffix`), ticket not written. Touches the Mongoose schema,
  `AdminAboutPanel`, and the availability gate's public reader.
- **Résumé subsystem — a whole backend with no frontend at all.** Verified:
  7 backend files (`routes/resumeRoutes.js`, `services/storage.js`,
  `controllers/aboutController.js`, `models/About.js`, `app.js`, `seed.js`,
  `routes/aboutRoutes.js`) and **zero** frontend callers. The only two
  frontend matches for "resume" are a doc comment in `services/api.js` and
  the word "resumes" in a `StarfieldCanvas` test name. Needs a decision:
  build the admin UI and restore the public link in Sprint 12's Contact, or
  formally drop it and delete the backend.
- **Three orphaned Phase 1 modules, 0 real consumers each** — `useTypewriter`
  (still 4 passing tests, which is why a dead-code sweep walks past it),
  `TerminalWindow`, and `apiUrl` in `services/api.js`. Left for cutover.
- **`.env.production`'s API host is the placeholder**
  `https://your-railway-backend.up.railway.app/api`. Every fetch in a real
  production build fails. This is why PF-84's live checks were served
  through a proxy rather than `vite preview`.
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
- **32 keyframes** (`frontend/src/styles/keyframes/`) — `base.css` holds 22,
  `flt`/`drift`/`sheen` are per-screen variants, and there are **8 of them,
  not 9**: the Blog prototype has no `drift` animation at all, so
  `drift-blog` does not exist and never should. `auroraA`/`auroraB` are
  Admin-only and live in `admin.css`. 22 + 8 + 2 = 32.

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
  children of `[data-tilt]` (lines 138-141). `blobC` is at **z-index 4**, above
  the portrait frame's 3, so it drifts in *front* of the image while the other
  three stay behind — flattening the z-index or hoisting them to the section
  loses that depth. Guarded by a test asserting the count and the containment.
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
  pre-empt it. Until then they keep the UA default — there is no
  `outline: none` anywhere in this repo, checked.
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
| rAF calls in 1 idle second | **0** under reduce · **61** with motion allowed |
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
`TerminalWindow` stays orphaned for the cutover ticket.

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

`useInView` drops to **exactly one** consumer — `ContactSection`, PF-88's.
Counted, not inferred: PF-82 recorded three (Projects, Blog, Contact),
PF-85 took Projects and this ticket takes Blog. So the moment Contact is
rebuilt, `useInView` and its test become the fourth orphan on the cutover
list, and it is worth expecting rather than rediscovering.

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
  database named `test`. **This already happened here, and the resolution is
  counter-intuitive — read before "fixing" it.** `backend/.env`'s `MONGO_URI`
  ends in `/test`, and that database is the **live, correct one**: 7
  collections, newest docs 2026-08-09. A `portfolio` database also sits on the
  same cluster and is an abandoned copy from 2026-07-18 with only 5
  collections — no `vocabularies` (32 docs), no `contacts`. Repointing the URI
  at `/portfolio` to make the name look right therefore rolls the site back
  three weeks and drops two collections, and the app reports nothing either
  way. The owner decided on 2026-08-18 to leave the name alone rather than
  migrate a live cluster. Verified by document count, not by name;
  `backend/.env.example` carries the same warning.
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

  **Both are still in the tree on purpose.** Deleting Phase 1 code is cutover
  work, not PF-80's — the Phase 1 sections around them are still mounted in
  `HomePage.jsx` and get replaced by PF-81/82. **"Not deleted" here means
  "noticed and deferred", not "missed".** Do not treat either as in use, and do
  not re-import them; the Phase 2 hero has no typewriter (see the PF-80 entry
  on `typeLoop()`/`ROLES`). Re-check consumer counts before deleting — grep for
  the identifier and discount the module's own file and its own test, which is
  exactly the discount that makes the count look non-zero if skipped.
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
- **A bare `.section` class loses `scroll-margin-top` to Phase 1's `[id]`
  rule.** `global.css:338` carries `[id] { scroll-margin-top: 5rem }` —
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

Where a mistake would be silent, add a test that would catch it.

## Locked decisions — do not reopen

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
  | rAF in 1 idle second | **0** | **69** |
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


- Design fidelity is absolute. Nothing visible is removed or simplified for
  performance.
  **Three sanctioned exceptions exist to the "nothing is reduced" half**, all
  asked for by the site's owner. They are the only three — the third is the
  hero marquee's slimmed band, recorded with the other PF-80 deviations below.
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
    frame. The prototype ships both edges raw. `.portraitImg` now carries
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
  `scroll-behavior`, and the only `behavior:'smooth'` in its script is a
  design-tool "replay splash" affordance, not a site feature. Smooth scrolling
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
