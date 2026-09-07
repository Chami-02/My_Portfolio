# Locked decisions — full record

Split out of `.claude/CLAUDE.md` on 2026-09-02. CLAUDE.md keeps a compact
list of every decision here (what it is, why, what not to do). This file is
the full entry for each: the reasoning, the measurements, the revision
passes, and — where a decision reversed an earlier one — both halves.

These are **locked**. The compact list in CLAUDE.md is authoritative for
"what is decided"; this file is the "why", so a future session does not
reopen a settled question by re-deriving it.

---

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

  **⚠️ Do NOT replace it with a module-scoped flag SET AT MOUNT.**
  StrictMode's simulated remount sets it on the first mount and suppresses
  the splash on the second, so the splash never appears in development at
  all — the same dev-only footgun class as the `setReady(true)`-on-unmount
  safety net `SplashProvider` warns about.

  ⚠️ **NARROWED BY PF-106 (2026-09-06): the mount TIME was the problem,
  not the module scope.** There is now a module-scoped
  `shownThisDocument` flag in `utils/splash.js` — see the PF-106 entry
  below — and it is safe because it is set from `Splash.jsx`'s `finish()`,
  ~4.5s in. StrictMode tears the discarded first mount down within
  milliseconds and its effect cleanup clears every pending timer, so
  `finish()` never runs on it. Verified by driving the dev server, since a
  green unit suite cannot see a dev-only double mount.

  **On `/blog*` the nav WAS the Blog prototype's own content**,
  transcribed from `Blog.dc.html` lines 50-61: PROJECTS · ABOUT ·
  `← PORTFOLIO` (glowpulse pill, replacing CONTACT) · divider · toggle ·
  ADMIN. No BLOG link — you are on it. ~~**This is the one part of the
  2026-08-22 navbar rework that is transcription rather than
  deviation.**~~

  ⚠️ **THAT SENTENCE IS NO LONGER TRUE — SUPERSEDED BY PF-103
  (owner-requested, 2026-09-05).** The blog nav is now
  **ABOUT · SKILLS · PROJECTS · CONTACT · `← GO BACK`** · divider ·
  toggle · ADMIN — the portfolio's own sections, left to right, so a
  reader on `/blog` reaches any of them in one hop instead of two. See
  the sanctioned-deviation entry below. Restoring the prototype's
  two-link set to "fix" the mismatch is the thing that was rejected.
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
  ⚠️ **About's sweep in that list is STALE as of 2026-09-07** — removed at
  the owner's request; see the entry at the end of this file. The point the
  sentence makes still holds for the rest, and `.portraitFade` is very much
  still there.

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

- **PF-106 — the splash plays ONCE PER DOCUMENT LOAD (owner-requested
  2026-09-06).** The rule, in the owner's words: *"opens the browser and
  first open should play, and when hit the refresh button in the main page
  should replay. Nothing else."*

  | arriving at `/` | splash |
  | --- | --- |
  | first open | **plays** |
  | refresh on the home page | **plays** |
  | browser Back from `/blog` | no |
  | any nav link from `/blog` | no |

  **Mechanism: a module-scoped `shownThisDocument` in `utils/splash.js`**,
  set from `Splash.jsx`'s `finish()`. Module scope IS the mechanism, not an
  implementation detail — the variable lives exactly as long as the
  document, so a refresh re-evaluates the module and replays for free while
  a client-side navigation finds it already true. Set at COMPLETION, which
  is also why SKIP counts as seen.

  ⚠️ **NEITHER THE URL NOR THE HISTORY ENTRY CAN DO THIS JOB.**
  `location.key === 'default'` looks like a clean stateless test for "the
  initial render of this document" and is not. Measured in the running app:

  ```
  initial load of "/"      history.state = { idx: 0 }          no key
  click through to /blog   history.state = { idx: 1, key: … }
  browser Back to "/"      history.state = { idx: 0 }          no key
  ```

  The home entry after a Back is identical to the initial load, so that
  gate replays the splash on exactly the journey this fixes.
  `history.state.idx` fails the same way.

  ⚠️ **`sessionStorage` was also rejected** — it survives a reload, so
  refresh would be the one journey that did NOT replay.

  **`HomePage` now strips `?nosplash` from the address bar on mount**
  (`replaceState`, keeping pathname and hash). This is load-bearing, not
  tidying: every nav link on `/blog` points at `/?nosplash=1`, so without
  the strip a refresh would replay on a hand-typed `/` and silently not on
  the URL the site's own navigation produces. It runs after `showSplash` is
  frozen, so it cannot affect its own render's decision.

  ⚠️ **Removing `?nosplash=1` from the nav hrefs instead was rejected.** It
  would also make refresh work and would delete code rather than add it —
  but a visitor who lands on `/blog` first would then get the full 4.5s
  intro on **GO BACK**, which is the "splash over the anchor jump" the
  2026-08-22 navbar decision exists to prevent. Consequence: two E2E URL
  assertions now expect `/#projects` rather than `/?nosplash=1#projects`.

  Consistent with PF-88's removal of REPLAY INTRO — *"no one want to replay
  that splash when in the website"* — so **no replay control was added**,
  and none is needed: a new tab or a refresh is the way back.

- **PF-105 — several tag chips can be selected, and they AND together
  (owner decision 2026-09-06).** A post must carry **every** selected tag.
  `?tag=Docker&tag=DevOps`, repeated params, `$and` of one anchored
  case-insensitive regex per tag in `buildMatch`.

  ⚠️ **OR was recommended first and was WRONG.** The argument for it was
  that AND empties the page at this size — measured, `React + Java` → 0.
  The owner pushed back that selecting two tags means wanting both, and the
  same measurement cuts the other way: under OR, `Docker + DevOps` returns
  **3 of 4 posts**, so the filter barely filters. Neither semantic is
  comfortable on a four-post blog; AND is the one that matches intent, and
  its failure mode is fixable where OR's is not.

  **`$and`, deliberately NOT `$all`.** `$all` reads shorter but its
  behaviour with regex elements is inconsistent across MongoDB versions,
  and each arm has to stay a regex to keep PF-96's anchoring — `React` must
  not match `React Native`, re-asserted for the array branch because it is
  a different code path, not the same one reused.

- **PF-105 — a chip that would return zero results is DISABLED, so the row
  cannot build an empty page.** Derived during render from `everyPost`, the
  unfiltered list the count pill already fetches — no extra request.

  ⚠️ **This NARROWS PF-98's "the chip row must not shrink as you filter"
  rather than reversing it.** That decision exists because a visitor should
  not watch their own options disappear. Every chip still renders, in
  place, readable; only activation goes away. Verified against the live API
  across all 11 pool tags: every dimmed chip really returns 0 and every
  enabled one really returns ≥ 1, both directions represented.

  - ⚠️ **It must read `everyPost`, never `list`.** `list` is already
    filtered, so a rule built on it disables nearly every chip the moment a
    filter narrows the results.
  - ⚠️ **`!isSelected(label)` is load-bearing and looks redundant.** In any
    reachable state a selected chip trivially matches, so the obvious test
    cannot tell the guard is doing anything — mutation-tested, removing it
    left the suite green. It earns its place only for a combination the row
    can no longer build but a URL still can (`?tag=Docker&tag=Java`), where
    without it every chip including the selected ones is disabled and the
    visitor cannot undo either half of their own filter.
  - Nothing is disabled while `everyPost` is loading. Dimming the whole row
    during a cold load is worse than dimming none of it.

- **PF-105 — the dimmed chip's look comes from LOSING ITS SHAPE, not from
  fading the label.** `background: none`, `border-color: transparent`,
  `opacity: .72`.

  ⚠️ **`opacity: .38` alone was the first attempt and it was wrong.**
  Composited against the real page it measured **1.86 light / 1.21 dark** —
  the tag name was effectively invisible, which destroys the entire
  justification above for dimming instead of removing. `.72` measures
  **3.41 light / 4.36 dark**, clearing WCAG's 3.0 bar for a user-interface
  component in the worse theme; light sets the floor.

  ⚠️ WCAG 1.4.3 **exempts** inactive controls from the contrast minimum, so
  this beats the standard rather than meeting it — which is exactly why it
  is pinned in `BlogPage.test.jsx`: nothing else would fail if it regressed.

  ⚠️ `.chip:hover` still matches a **disabled** button (`:hover` does not
  care about `disabled`), so the hover lift is cancelled explicitly. Without
  that the chip rises and lights its border while being unclickable.

- **PF-105 — CLEAR ALL is `var(--danger)` (owner-requested 2026-09-06).**
  The design system's only sanctioned red, `#f87171` dark / `#B4231F` light,
  already read by Contact's `.errorText`. Measured on this surface: **7.32
  dark / 5.38 light**, both clearing the 4.5 that 10.5px text needs.

  **Hover keeps the red** and thickens the underline instead of switching to
  `--acc` — losing the red at the moment of committing would read as the
  warning being withdrawn, and a thickness change is not colour-only
  feedback.

  ⚠️ **Do NOT reach for the admin panel's reds.** `#dc2626`, `#f87171` and
  `rgba(239,68,68,…)` there are hardcoded Phase 1 literals that do not flip
  with the theme; `/admin`'s contrast is PF-100's, outside PF-91's scope.

- **PF-104 — `?q=` SEARCHES THE WHOLE POST, not just title/excerpt/tags
  (owner-requested 2026-09-06).** `buildMatch`'s `$or` now carries
  `sections.heading`, `sections.body` and `sections.bullets` alongside the
  original three.

  ⚠️ **This REVERSES PF-96**, which restricted the query to the design's own
  client-side filter (`Blog.dc.html:537-546`) on the reasoning that "the
  design is the authority for behaviour a visitor can observe". The owner's
  requirement is that any word belonging to a post finds it — which the
  prototype's own placeholder, "Search posts, tags, tools…", already
  implies. **Do not narrow it back to match the frozen export.**

  ⚠️ `blog.query.test.js`'s `does not match section body text` was PF-96's
  deliberate tripwire for exactly this change. It is now
  `matches section body text` and asserts the opposite. Its fixture uses the
  PHRASE `Charlie body text` — the bare word `Charlie` is in that post's
  title too, so it could not tell the two rules apart.

  **The deprecated `content` string is deliberately NOT searched** and a test
  pins that absence. No row has ever carried one.

  **Cost, accepted and recorded rather than discovered later:** no text index
  and none on `sections`, so this is a collection scan with a regex per array
  element. Irrelevant at four posts. Past a few hundred, a `$text` index is
  the move — and note it changes semantics from substring to whole-word
  stemming, so it is a visible behaviour change, not a drop-in.

- **PF-104 — `publishedAt` IS stamped at publish time (2026-09-06).**
  One line in `applyDerivedFields`:
  `if (doc.published && doc.publishedAt == null) doc.publishedAt = new Date()`.

  ⚠️ `blogQuery.js` recorded this as **rejected** — but rejected *as a
  replacement for the `$ifNull` fallback*, not as a feature. Both now exist,
  deliberately: the stamp fixes posts going forward, the fallback still
  covers every row written before it existed. That header has been rewritten;
  do not read the old note as still standing.

  **The defect it fixes:** nothing on the server ever wrote `publishedAt`.
  `togglePublish` flipped only the boolean, so a draft created in January and
  published in September fell back to its January `createdAt` and appeared as
  an old post the moment it went live.

  - **Unpublishing does NOT clear it** — a post that briefly returns to draft
    for an edit must not jump to the top of the list on republish.
  - **`== null` and not `!doc.publishedAt`** — that is what keeps seed.js's
    and migration 005's explicit dates from being overwritten on any save.
  - ⚠️ **In `applyDerivedFields`, not a new `pre('save')`.** That function
    already runs from both existing hooks, so one line covers create,
    toggle and update. A second hook beside them is the PF-95 mistake.

- **PF-104 — card dates show the FULL date, and `formatMonth` is now
  `formatDate` (owner-requested 2026-09-06).** `14 JUL 2026`, not the
  prototype's `JUL 2026`.

  - **`day: '2-digit'`, not `'numeric'`** — the dates stack down the grid in
    mono at .12em, so `4 MAY` beside `14 JUL` is a visibly ragged column.
  - **The rename is part of the change.** A function called `formatMonth`
    returning a full date is a name that lies.
  - **BOTH consumers changed** — `/blog` and the home-page teaser. Two date
    formats for the same posts on one site reads as a defect.
  - ⚠️ The `en-GB` pin and the reader's-timezone caveat are unchanged, but
    the caveat now **shows up more often**: an instant near midnight UTC
    renders as a different DAY either side of the date line, where before
    only a month boundary exposed it. Still a product call, not a bug.

- **PF-104 — `/blog` has three clearing affordances, and the active chip
  toggles off (owner-requested 2026-09-06).** None of this is in the
  prototype, which has the same gap.

  1. A `×` inside the search field, only while there is text to clear. It
     returns focus to the input.
  2. **Clicking the ACTIVE chip clears the tag.** Previously it re-set the
     same value and the only route back was the separate `All` chip.
  3. An always-visible active-filter summary with `CLEAR ALL`, reusing the
     existing `clearFilters`. Before this, `RESET FILTERS` rendered **only
     inside the empty state**, so a visitor looking at results had no
     visible way to clear anything.

  **The search row is now a real `<form role="search">`** so Enter submits
  natively and the magnifier is a `type="submit"` button; `onSubmit` flushes
  the 300 ms debounce rather than duplicating it. ⚠️ **This makes every
  chip's `type="button"` LOAD-BEARING** — PF-98 wrote them that way on
  principle when no form existed, and without it a chip click would now
  submit.

  **The filtered empty state names the term** — `No posts match "docker"
  tagged DEVOPS.` — built from the URL's `q`/`tag`, never from the input's
  draft state, so it cannot name a half-typed word nobody searched for.
  ⚠️ **Inline with `role="status"`, deliberately NOT a modal** despite the
  request for a pop-up: search is live, so typing `docker` passes through
  `d`, `do`, `doc`… and a dialog would fire on almost every keystroke.

- **PF-104 — the `/blog` card numeral is 56px, clearing the title.**
  Supersedes PF-103's 86px. Measured: ink 1.94px inside the card, clearing
  `.cardTitle` by 5.86px. `top: -2px` and `overflow: hidden` are unchanged
  from PF-103 — see that entry for why the clip stays.

- **PF-103 — the `/blog` grid numerals sit FULLY INSIDE the card
  (owner-requested 2026-09-05).** `.cardNumeral`'s `top` is **`-2px`**,
  not `Blog.dc.html:180`'s **`-18px`**.

  **Why it is a deviation and not a transcription fix:** the prototype
  clips the digits exactly as this page did. `overflow: hidden` on the
  card is the prototype's own (`Blog.dc.html:179`) and **STAYS** — the
  fix moves the numeral, it does not remove the clip. Sweeping the
  `overflow` up with it is the same shape of mistake as taking
  `.scanTexture` with the splash scan lines.

  **Measured in Chrome before the change, and this is the number that
  justifies the value:** Anton at 86px puts the digit ink **4.42px below
  the span's box top**, so `-18px` left the ink top **13.58px above the
  card's top edge**, slicing 13.58 of a **75.25px** glyph — about **18%
  of every numeral**. At `-2px` the ink sits **3.42px inside** the card
  (the extra 1px is the card's border).

  ⚠️ **Deliberately not `-4.42px` (flush).** Re-measured across the whole
  font stack: `Anton Fallback` puts the ink 14.1px down and `Arial
  Narrow` 12.19px, so every fallback lands further inside — but a flush
  value would have no margin at all if metrics shift. Verified live: all
  three cards fully visible, ink bottom and right edge inside the card,
  identical in both themes.

  Guarded in `BlogPage.test.jsx` via **postcss** (the module documents the
  old value in prose exactly where the rule sits), asserting `top`,
  `right`, `font-size`, `line-height` **and** `.card`'s `overflow:
  hidden` together. Both mutations caught: restoring `-18px`, and
  deleting the clip instead of moving the numeral.

- **PF-103 — the `/blog` nav is the portfolio's own sections
  (owner-requested 2026-09-05).** **ABOUT · SKILLS · PROJECTS · CONTACT**,
  left to right, then the glowpulse pill relabelled **`← GO BACK`**
  (same slot, same `/?nosplash=1` href), divider, toggle, ADMIN.

  - **No BLOG link** — you are on it. Unchanged from before.
  - **CONTACT is a plain link here**, where on `/` it is the pill. So
    `/blog` now carries both a CONTACT navLink and a `.contactPill`
    labelled GO BACK. ⚠️ **`.contactPill` is deliberately NOT renamed** —
    the rename touches `Navbar.jsx`, `.overlayContactPill` and guarded
    tests for zero user-visible change. It is the nav's one accent pill,
    whatever `navModel()` labels it. Commented at the class.
  - Built from `SECTIONS` with `blog` filtered out and `contact`
    appended, hrefs via `sectionHref()` — **not** four hand-written
    strings, so `?nosplash=1` stays expressed once.
  - ⚠️ **The mobile overlay focusable count for `/blog` is now 8, was
    6.** It coincidentally equals `/`'s count again; the two are asserted
    separately so they stay independently wrong-able.

  Verified live: four links in DOM order, zero bare hashes in the
  header, and the pill's `glowpulse` reported **running at 3000ms by
  `getAnimations()`** — the instrument that works, not
  `getComputedStyle`. Mutations caught: label reverted (3 failures),
  link set reverted (5).

- **PF-103 — blog reading times are DERIVED and honest; the pin is a
  separate field (owner decision 2026-09-05).** This settles the
  three-way open question recorded in `sprint-log.md`.

  **The seeded 6 / 7 / 4 / 5 were fiction.** Transcribed from
  `Blog.dc.html` for a design that assumed full-length posts; measured
  with the model's own 200-wpm formula the real bodies are **158 / 123 /
  89 / 64 words**, so every post computes to **1 minute**. Option 1 of
  the three recorded ways out — accept the computed value — plus option
  3, the override.

  - `readingTimeMinutes` is **DERIVED, with exactly one writer**
    (`applyDerivedFields`). A client-supplied value is now **ignored**,
    where PF-95 made it win.
  - **`readingTimeOverride`** (new schema field, `default: null`,
    `min: 1`) is the author's pin. `null` means compute.
  - ⚠️ **Two fields, deliberately.** One field cannot answer "was this
    pinned or computed?", and every reading-time defect here came out of
    that ambiguity — PF-95's two hooks disagreeing, then PF-97 having to
    drop the field from the admin payload because echoing a *computed*
    figure would freeze it forever. With the pin stored separately,
    `postToForm` can round-trip it safely; `readingTimeMinutes` is still
    never sent.
  - The derivation is now **unconditional**. `forceReadingTime` and its
    `isModified` gymnastics are **deleted**. This also fixes a case the
    old condition missed: a **title-only edit** used to leave a stale
    figure, because `sections` had not changed.
  - **Migration `006-blog-reading-time-honest.js`** clears the fiction in
    an existing database. ⚠️ **005 is NOT edited** — it has run in
    production and a migration that has run is frozen.
  - ⚠️ **The live site will show `1 MIN READ` on all four posts, and
    that disagrees with `docs/design/Blog.dc.html`.** Intended. Do not
    "restore" the design's figures.

- **The Blog reading view's "GOT A QUESTION ABOUT THIS BUILD? / EMAIL
  ME →" block is removed (2026-08-22, owner-requested — ⚠️ BUILT
  2026-09-06 in PF-99, after three sprints as a decision with nowhere to
  apply).** The reading view now exists (`frontend/src/pages/
  BlogPostPage.jsx`) and ships without the panel. Guarded in BOTH suites
  — `BlogPostPage.test.jsx` asserts no GOT A QUESTION text, no EMAIL ME
  text and zero `mailto:` links, and `e2e/blog.spec.js` re-asserts the
  first two against the real render — because the frozen export will
  show that panel forever and a fidelity pass reads its absence as a
  transcription bug. `Blog.dc.html:103-106` is the container (`margin-top: 44px`,
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

  Phase 1's `global.css` had a second, unrelated grid — `.grid-bg`, 60px
  indigo — which is **not** this one. ⚠️ **This note used to read "still
  in use by `NotFoundPage.jsx`. Do not delete it while cleaning up."
  REWRITTEN 2026-09-07: PF-100 rebuilt that page onto the Phase 2 ambient
  layer, `.grid-bg` lost its only consumer in the same ticket, and the
  rule was deleted with it.** The instruction is not ignored — its
  premise expired, and both halves are recorded here rather than leaving
  a live note contradicting `global.css`.

  Still true, and still the reason the note existed: `.grid-bg` is NOT
  the Phase 2 grid. Do not restore one while restoring the other.

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

### PF-97 — the admin Blog editor is a SECTIONS editor, not a markdown box (2026-09-04)

**Owner-requested, and it is a deliberate deviation from a frozen design
file.** `docs/design/Admin.dc.html:478-481` shows the blog editor as one
`required` textarea labelled *"Content \* (Markdown supported)"*. The
shipped panel no longer has that field at all. It has a repeatable
sections editor: per section a heading, a paragraph list and a bullet
list, with add / remove / reorder.

⚠️ **Do NOT "restore" the textarea to match the export.** That is what a
fidelity pass will want to do, and it re-breaks the panel completely.

**Why the prototype loses here, when it normally wins.** The prototype's
admin form is not a design decision that Phase 2 overrode — it is
*older than the schema*. `Admin.dc.html` was exported against Phase 1,
where a post's body genuinely was one Markdown string. PF-59 replaced
that with `sections[]` and the design file, frozen since 2026-08-22, was
never re-exported. So the textarea is not the design's judgement about
how a post should be authored; it is a field that no longer exists.
Transcribing it faithfully produced an editor bound to a dead column,
which is exactly the state PF-97 found and repaired.

This is narrower than it sounds and does not loosen the rule. The
prototype still wins on every value it actually expresses — the form's
other fields, their labels, their order, the copy, the checkbox
wording. What it cannot be the authority on is the shape of data it
predates.

**Considered and rejected: keep the single textarea and translate.**
Serialise `sections[]` down to `## heading` / paragraphs / `- bullets`
on open, parse it back on save. It was the recommended option precisely
because it needed no deviation — the form would have looked identical
to the export. Rejected by the owner in favour of editing the real
structure. Worth recording *why it was tempting*: it is the only option
that keeps a frozen design file honest without an entry like this one.
The cost that made it lose is that a Markdown box labelled "Markdown
supported" would not have supported Markdown — anything outside the
three transcribed forms (numbered lists, code blocks, sub-headings)
would silently flatten into a paragraph, and a lossy translation sitting
between the author and the database is a bug generator.

**Sanctioned scope, so this does not sprawl:**
- The **tag chip picker** in the same prototype form (click to add, `×`
  to remove, `+ ADD TAG`) was deferred to Sprint 14 and then **REVERSED
  THE SAME DAY — it is BUILT in PF-97.** ⚠️ The deferral was made on my
  mischaracterisation of it as "a look-and-feel improvement"; it is not.
  The `×` performs a **cascading delete across every blog post**, which
  is why the backend ships a dedicated impact-count endpoint and why the
  entry below on vocabulary deletion exists at all. The owner spotted the
  gap from the design and asked. **The comma-separated input STAYS
  alongside it** — it is how a one-off tag gets typed; the picker is how
  the shared pool gets used. Both, not either.
- The **`tech` chip picker for the Projects panel** remains deferred —
  same `Vocabulary` API, different form, different ticket.

⚠️ **The `/blog` filter-chip row is driven by the tag pool, but only its
IN-USE half (owner decision, 2026-09-04).**

A chip appears on `/blog` when a vocabulary tag is carried by **at least one
PUBLISHED post**. `GET /api/vocabulary/tag?inUse=true` is that list; PF-98
consumes it and prepends `'All'` client-side (`utils/blogQuery.js`'s
`buildMatch` already treats `'All'` as no filter).

**Two alternatives were considered and rejected:**

- **The whole pool as the chip row** — the literal reading of the request,
  and zero backend work. Rejected because a pool value with no published
  post behind it renders a chip returning *"no posts found"*, and that is
  trivial to produce: add a tag then cancel the post, tag only a draft, or
  delete the last post using a tag (the cascade runs one way only, so the
  row survives). A filter guaranteed to fail is worse than an absent one —
  a visitor cannot tell a stale pool entry from a broken site.
- **Deriving the row from the posts, as the design does**
  (`Blog.dc.html:327`, `ALL_TAGS = ['All', ...new Set(POSTS.flatMap(p =>
  p.tags))]`). Rejected because the admin panel would then have no influence
  on the public row, which is the thing that was asked for. ⚠️ It is also no
  longer *possible* the way the design does it: PF-96 made `?q=`/`?tag=`
  server-side, so the list response is already filtered and chips derived
  from it would shrink as you filter. The row needs a source independent of
  the current filter.

⚠️ **`?inUse=true` and the impact count must NOT share a filter.** `impact`
counts **every** document including drafts, because the delete cascade
really does strip drafts and the confirm must not understate the damage.
`?inUse=true` counts **published only**, because a draft-only tag must never
become a public chip. They look like duplicated logic that ought to be
unified; unifying them breaks one or the other.

⚠️ **Omitting the param must keep returning the full pool.** The admin
picker depends on it — a tag has to be pickable *before* anything uses it,
or a newly created tag could never reach a first post. Guarded by a test.

**Not built, decided:** a vocabulary row is NOT removed when its last post
is deleted. Keeping the tag is useful for the next post, and `?inUse=true`
already stops it reaching the public page.
- PF-97 changed the panel's **function and structure only**. `/admin`'s
  palette, its light theme, `global.css`'s `:root` deletion and the font
  cutover remain **one** Sprint 14 job. The new editor deliberately
  reuses `AdminAboutPanel`'s existing bio-paragraph idiom (glass card,
  mono uppercase labels, numbered gutter, `×` remove, `+ Add` outline
  button) rather than inventing a look, so that restyle stays one job
  and not two.

⚠️ **Section order is meaningful, which is why reorder exists.** The
reading view numbers sections 01·02·03 in array order, so without ↑/↓ a
mis-ordered post could only be fixed by retyping it. The arrows are not
decoration.

### PF-98 — the `/blog` index (2026-09-05)

Four deviations from `docs/design/Blog.dc.html`, all raised and agreed before
building. **Do not "restore" any of them to match the export.**

- **⚠️ The filters live in the URL** — `/blog?q=…&tag=…` (owner-approved
  2026-09-05). The prototype keeps `query` and `tag` in component state
  (`Blog.dc.html:330`), so a refresh clears them and the back button leaves
  the page. In the shipped site a filtered view is bookmarkable and
  shareable, the back button undoes a filter, and PF-99's reading view can
  link a tag straight back into a filtered index.

  ⚠️ **Search writes with `replace`; a tag chip PUSHES.** Deliberate and
  measured: six typed characters add **zero** history entries, one chip click
  adds **one**. A half-typed search term is not a place you were; a filter
  is. Both halves are guarded in `e2e/blog.spec.js` — an earlier version of
  that test asserted "one Back returns to /blog" and was wrong about its own
  subject, because `replace` overwrites the entry it would have returned to.

- **⚠️ There are TWO empty states, where the prototype has one**
  (owner-approved 2026-09-05). The design's copy — `Nothing filed under
  that` / `Try another keyword or clear the filters.` / `RESET FILTERS` —
  ships **verbatim** and is used when a filter matched nothing. A second
  state, `Nothing filed yet` / `The first field note is still being
  written.` with **no reset button**, covers a blog with no published posts,
  where the design's copy would tell a visitor to clear filters they never
  set.

  ⚠️ **The discriminator is the UNFILTERED TOTAL, not the rendered list's
  length.** Zero posts anywhere is a different fact from zero matches, and
  only the second list can tell them apart.

- **The post cards are `<Link to={/blog/:slug}>`, not `<button>`.** Forced by
  the port, not a preference: the prototype opens an in-page overlay because
  a single-file export has no router.

- **The chips carry `aria-pressed` and the search input has an `aria-label`.**
  The prototype signals the active chip with colour alone and leaves the
  field unnamed (its only label content is a decorative `/`). Both are
  invisible on screen, so implementation choices rather than design changes.

**⚠️ `/blog`'s tag pills are a FIFTH and SIXTH variant. Do NOT compose
BlogSection's.** Verified against both prototypes, and this is the most
likely fidelity mistake on the page because the wrong one renders *almost*
right:

| | teaser (`Portfolio…:436`) | `/blog` featured (`Blog:170`) | `/blog` card (`Blog:188`) |
| --- | --- | --- | --- |
| `font-size` | 10.5px | **11px** | 10.5px |
| `padding` | 5px 10px | **6px 12px** | **5px 11px** |
| `letter-spacing` | .06em | **none** | **none** |
| transition/hover | yes | **none** | **none** |

⚠️ **The GRID pill is the dangerous one** — identical `font-size` to the
teaser's and one pixel of padding apart on a single axis. Pinned in
`BlogPage.test.jsx` as *exactly two* differing properties, cross-parsed from
`BlogSection.module.css`, so a later edit that collapses the two shapes fails
rather than passing quietly. The `.badge` differs too: `5px 11px` here,
`5px 10px` in the teaser.

**Carried forward from existing locked decisions, applied to this page:**

- **The featured card's ghost `01` is REMOVED** — the 2026-08-22 owner
  decision says in as many words that the `/blog` index inherits it.
  `.sweep` **stays** (a different absolute child), and the grid's
  `02/03/04` numerals **stay**. Guarded three ways and mutation-tested: both
  putting the numeral back and sweeping `.sweep` up with it fail.
- **PF-91's `--muted2` → `--muted` in DARK only on a tinted surface**, applied
  to `.cardMeta`. Re-measured on this card rather than assumed: `--muted2`
  gives **4.15** at 10.5px against the composited card ground, below the 4.5
  AA needs; `--muted` gives **7.00**. Light passes at **5.95** with `--muted2`
  and is untouched. Wins on specificity (0,2,1), never emission order.
- **PF-91's separator alpha**: `.cardMetaSep` is `var(--acc)` at **`.9`**,
  where `Blog.dc.html:182` declares `.65`. Same separator, same size, same
  surface class as the two PF-91 already unified.

**The count pill is suppressed at zero rather than reading `0 POSTS`** —
BlogSection's precedent, for the same reason: during a cold load or after a
failed fetch, zero is wrong rather than merely absent.

**The grid numerals are POSITIONAL** (`String(i + 2).padStart(2, '0')`). The
prototype authors a `no` per post; the schema has no such field, so they
renumber as you filter. Accepted.

**⚠️ The header section KEEPS its radial gradient.** The site-wide section-wash
removal (2026-08-18) took decorative gradients off the home page's sections
and explicitly kept card and panel surfaces. This is the Blog screen's own
page-header treatment, declared on the section because there is no card to
move it onto. Not an oversight.


## PF-99 — the reading view and the view counter (2026-09-06)

- **`GET /api/blog/:slug` returns `index` and `total` alongside
  `{ post, prev, next }`.** Zero-based position in the ordered published
  list, and the published count. ⚠️ **Both were ALREADY COMPUTED** in
  `getPostBySlug` to build the neighbours and were being discarded —
  returning them is two lines. **Rejected: letting the client fetch the
  list and find the position itself.** That is a second expression of an
  ordering `backend/src/utils/blogQuery.js` owns — precisely the drift
  PF-96 collapsed into one shared sort spec — and it costs an extra round
  trip on a cold-loaded shared link.

  ⚠️ Zero-based because it is a POSITION, not a label. The reading view
  adds 1 and pads, as `BlogPage.jsx` already does for card numerals.
  Padding server-side would push a presentation decision into the API.

- **⚠️ THE VIEW COUNTER IS A SANCTIONED ADDITION WITH NO PROTOTYPE
  SOURCE** (owner-requested 2026-09-06). Neither `Blog.dc.html` nor
  `Portfolio Revolution.dc.html` shows a view count anywhere. Same
  footing as `BrandIcons.jsx`, which is also wholly a deviation — a
  fidelity pass diffing against the frozen export WILL flag every call
  site.

  ⚠️ **Almost none of it was new code**, and that is the part worth
  remembering: `Blog.views`, the `$inc` endpoint (PF-64), its 30/min
  limiter, and `views` in every list payload (both list endpoints use an
  EXCLUSION projection, `{ content: 0 }`) all already existed, and
  `AdminBlogPanel.jsx` already printed the number. Every count read 0
  for exactly one reason: **nothing had ever called the endpoint.** No
  backend change was made for this half. Do not add an endpoint, a
  projection or an aggregation to "expose views" — grep first.

- **A post with fewer than one view renders NO counter at all**
  (owner's decision, 2026-09-06). ⚠️ **Stated cost, accepted rather than
  discovered later:** a missing counter and a broken one look identical
  on screen, and card heights vary by data. Mitigated by pairing every
  test — `views: 12` renders it, `views: 0` renders nothing — so the
  absence has a guard behind it. The layout consequence is handled by
  making the CTA the FIRST child of a `space-between` row, so a card with
  no counter puts its CTA exactly where a card with one does.

- **Placement, per surface, and the row is deliberately different:**
  bottom-right on `/blog`'s two card shapes and the home teaser's
  featured card; **appended to the META LINE** on the teaser's three
  compact rows, after the reading time. A row is a numeral, a text block
  and a chevron — its only right-hand corner already belongs to the
  chevron. ⚠️ The `·` separator before it is CONDITIONAL, or an unread
  post's meta line ends `1 MIN READ · `, which reads as data that failed
  to load.

- **The admin panel's count is a stat chip beside the Published/Draft
  badge, and the old `· {post.views} views` meta-line fragment is
  DELETED.** Leaving both would print the same number twice per row —
  invisible in review, because both copies are correct. A test pins the
  absence.

- **`← ALL POSTS` becomes `← BACK TO RESULTS` when the reader arrived
  from a filtered index**, and returns to that filtered view
  (owner-requested 2026-09-06). A copy deviation from `Blog.dc.html:72`.
  The filter travels as **router state**, not in the post's URL.
  ⚠️ **Rejected: `/blog/docker-compose?tag=Docker`.** It survives a
  refresh, and it also puts filter params the post does not use into
  every shared link. State is lost on a hard refresh instead, and the
  fallback is plain `/blog` under the honest `← ALL POSTS` label.
  ⚠️ Prev/next re-pass the same state, or the context evaporates after
  one hop and the label changes mid-read.

- **An unknown or unpublished slug renders an INLINE not-found panel,
  keeping the URL** — not a redirect to `NotFoundPage` (owner's decision,
  2026-09-06). `NotFoundPage` is still the **Phase 1 layout** until
  PF-100, so a mistyped blog link would otherwise drop the reader into
  the old palette entirely. ⚠️ Its link reads **`BROWSE FIELD NOTES →`**,
  NOT `← ALL POSTS` — the article's back link is on screen at the same
  time, and two links with the same accessible name going to the same
  place announce identically. Caught by Playwright strict mode, pinned in
  both suites.

- **The reading view uses NO `Reveal`, and that is transcription.** The
  prototype's reader (`Blog.dc.html:69-121`) carries no `data-reveal` at
  all — it animates the whole `<article>` once with `riseIn .8s` and
  leaves the body static. ⚠️ **Consequence: PF-93's "never declare a
  transition on a Reveal-wrapped element" is VACUOUS on this screen**, so
  `.tagPill`'s own transition is correct and the other hover states snap,
  which is also the export's behaviour. Do not "fix" either one.

- **The reading view's tag pill is DUPLICATED from `/blog`'s
  `.featuredTagPill`, not composed — deliberately.** ⚠️ The two are
  byte-identical today (11px / 6px 12px / `rgba(252,163,17,.08)` / `.22`
  border / `var(--text)`), the reader's adding only a `transition`. They
  come from two different prototype lines (`:83` and `:170`) that happen
  to agree, not from one shared intent, and `docs/design/` has been
  frozen since 2026-08-22 — so they will drift apart under any future
  owner instruction rather than together. Composing one from the other
  would silently couple them. (⚠️ The PF-99 ticket claimed they differed
  in fill and border. They do not; the file won.)

- **PF-91 Group A extended to two new rules** — `--muted2` → `--muted`,
  **dark only**, on `BlogPage.module.css`'s `.cardViews` and
  `BlogSection.module.css`'s `.views`. Measured in Chromium against the
  real composited card: `--muted2` at 10.5px gave **4.15 on the grid card
  (FAILS AA in the default theme)** and 4.55 on the featured card; after,
  **7.00 and 7.68**. Light was 5.45 / 5.95 and is untouched.
  ⚠️ **Both took the override, not only the failing one** — 4.55 is not
  survivable headroom on the owner's own precedent, the footer copyright
  having gone 4.97 → 4.28 purely from a surface tint that touched none of
  its own colours. Wins on SPECIFICITY (0,2,1), never emission order.

- **The view counter's hidden label is singular at one — "1 view".**
  Trivial-looking and recorded because of HOW it was found: the label is
  visually hidden, so "1 views" was invisible on screen and only a probe
  reading `textContent` caught it — and it is the MOST common state, not
  an edge case, since every post passes through exactly 1 the first time
  anyone reads it.

### Follow-up, 2026-09-07 — the reading view's second back control

- **⚠️ THE READING VIEW HAS TWO `← ALL POSTS` CONTROLS, one at the top of
  the article and one after the prev/next cards** (owner-requested
  2026-09-07). No prototype source — `Blog.dc.html:69-121` has one, at the
  top. Finishing a post otherwise left only PREVIOUS / NEXT in reach, both
  of which move sideways to other posts, so leaving for the index meant
  scrolling the whole article back up. The footer is not an escape either:
  its "Field Notes" entry resolves to `/?nosplash=1#blog`, the home page's
  teaser, not `/blog`.

  ⚠️ **Both read the SAME `backTo`/`backLabel`**, deliberately not derived
  twice — that is what stops the two ends of one page disagreeing about
  where "back" is. Both relabel to `← BACK TO RESULTS` together.

  ⚠️ **The bottom one is gated on a LOADED POST and is OUTSIDE the
  `(prev || next)` guard.** Absent while loading and on the not-found panel
  (neither scrolls, and the panel has its own exit); present for a single
  post, which is the one case with no other navigation at all.

- **⚠️ TWO LINKS SHARING ONE ACCESSIBLE NAME IS CORRECT HERE, and it was a
  DEFECT one day earlier — the distinction is worth keeping straight.**
  PF-99's recheck renamed the not-found panel's link because it and the
  back link were **visible together in one region serving one purpose**.
  Top-and-bottom repetition of a single control across a long article is
  the ordinary pagination pattern and is fine. **Do not "fix" it by
  renaming one**; the cost is paid in test locators instead —
  `e2e/blog.spec.js` names which end it means with `.first()`/`.last()` and
  pins `toHaveCount(2)`, while the not-found test pins `toHaveCount(1)`.

- **`.pillLink` is the ONE declaration of the reading view's pill shape**,
  composed by `.backLink`, `.backLinkBottom` and `.notFoundLink`. Extracted
  when the third consumer landed. ⚠️ **This does NOT reopen the rejection of
  `composes: pill from patterns.module.css`**, which stands: patterns'
  `.pill` declares `color` and would tie with the composing class at
  (0,1,0), resolving on bundle emission order. `.pillLink` is local and
  carries the shape only, so nothing is declared twice and there is no tie.
  A test pins that the composing classes may add `margin-bottom` and
  nothing the shape already owns.

- **`/blog` scrolls to the top on a PUSH arrival, never on a POP**
  (2026-09-07). ⚠️ **Not a preference — it fixes a defect the bottom control
  created.** React Router carries scroll position across a navigation, and
  the bottom control sits ~900px down a post; a shorter filtered index then
  clamped to its own bottom. Measured `scrollY 912` against `maxScroll 911`,
  which put the cards on screen and the search box, chips and CLEAR ALL
  above the fold — exactly the controls the owner wanted reachable after a
  read.

  ⚠️ **Three things make it correct, and removing any one breaks it:**
  skipping `POP` so Back and Forward still RESTORE the reader's place in the
  grid; a **once-per-mount ref**, because this page rewrites its URL on every
  keystroke (REPLACE) and every chip click (PUSH) and would otherwise yank
  to the top mid-filter; and `'instant'` rather than `'smooth'`, which is
  what page arrival does and which sidesteps the fact that a JS `scrollTo`
  with an explicit behavior ignores `motion.css`'s reduced-motion override.


## PF-100 — the 404, and the first screen with no prototype source (2026-09-07)

**⚠️ `docs/design/` HAS NO 404 AND NEVER DID.** Measured, not assumed:
zero matches for `404` or "not found" across all three `.dc.html` files,
and `github.md`'s screen map lists ten screens, none an error page. So
this is the first Phase 2 surface built with nothing to transcribe from.

**The rule that made it safe: recompose, don't invent.** The ARRANGEMENT
is new and owner-approved; every VALUE in it is transcribed verbatim from
an existing prototype element, and each names its source in the module.

| element | value | transcribed from |
| --- | --- | --- |
| headline | Anton, `clamp(34px,5vw,64px)`, `.95`, uppercase | `Portfolio Revolution.dc.html:210` — the "WHO I AM" heading |
| eyebrow | mono, `12px`, `.24em`, `var(--acc)` | the five numbered section eyebrows (195, 247, 312, 417, 493) |
| body | `15px` / `1.75` / `var(--muted)` | `BlogPostPage.module.css`'s `.notFoundBody` |
| pills | `999px`, `16px 26px`, mono `12.5px`, `.1em`, filled 700 / outlined 500 | `Portfolio Revolution.dc.html:118-119` — the hero CTA pair |
| entrance | `riseIn`, `.8s`, `cubic-bezier(.16,1,.3,1)`, `both` | `BlogPostPage.module.css:53-57` |

**No new keyframe**, so `keyframes.test.js`'s pinned count is untouched.

### ⚠️ THE GHOST `404` WAS APPROVED AND THEN WITHDRAWN — SAME SESSION

A giant translucent `404` behind the headline was the owner's first
choice on 2026-09-07. It was **withdrawn once it was pointed out that it
reinstates the treatment removed on 2026-08-22** — the featured card's
ghost `01`, gone from the home teaser with "/blog inherits the removal".

**Both halves recorded because the reversal is the useful part:**
- The design was chosen from a preview, without the removal in view. A
  visual choice can conflict with a locked decision without anyone
  noticing, and the preview is exactly where that is invisible.
- The counter-argument was real and was still not taken: the removed one
  was clipped in a card corner by `overflow: hidden`, this would have
  been centred on an open page, and the more recent owner decision wins
  by this project's own rule. The owner chose consistency anyway.

⚠️ **So the 404 carries NO decorative numeral, and that is DECIDED, not
overlooked.** Guarded as an absence in `NotFoundPage.test.jsx` — the
third such guard, after `BlogSection` and `BlogPage`. Mutation-tested:
adding an `aria-hidden` numeral back fails it.

⚠️ The guard is **scoped to the `<section>`, not the container** —
`CursorGlow` and `GrainOverlay` each render a legitimate `aria-hidden`
div inside `PageShell`, so a container-wide count would assert the
ambient layer is missing, under a name pointing somewhere else.

### The pill pair is a SECOND transcription of the hero's, deliberately

`NotFoundPage.module.css` re-declares the hero CTA pair rather than
sharing `HeroSection.module.css:275-317`. Composing across would make a
section module a library; extracting to `patterns.module.css` would
couple two screens that are free to diverge, and `docs/design/` is frozen
so the next instruction moves one and not the other. **Same call, same
reason, as `BlogPostPage`'s byte-identical tag pill.**

### What this page does NOT have, each stated rather than omitted

- **No `Reveal`** — one `riseIn` on the container, `BlogPostPage`'s
  precedent. ⚠️ PF-93's transition rule is therefore VACUOUS here, which
  is why the pills correctly declare their own.
- **No `ErrorBoundary`** — the other two Phase 2 pages wrap content that
  FETCHES; this markup is static and has nothing to catch.
- **No `.section-hero`** — noted because it looks like the obvious thing
  to compose. It is an orphan with **zero consumers**, and its padding
  was transcribed for the hero specifically.

### Accessible name: sentence case in the DOM, uppercase in CSS

The prototype's own idiom (the hero writes "Parindra", not "PARINDRA").
⚠️ **Consequence the two suites do not share:** the accessible name is
`Page not found`. testing-library matches names in FULL and
case-SENSITIVELY; Playwright matches by SUBSTRING and
case-INSENSITIVELY. Both specs name the DOM string, and the E2E one
passes `exact: true`. Asserting `PAGE NOT FOUND` would fail in one suite
and pass in the other for the wrong reason.

### ⚠️ `FIELD NOTES →` collides with the Footer under Playwright strict mode

The Footer carries its own `Field Notes` link on every route, so a
page-level locator for the new pill resolves two elements and throws —
which reads as the feature being gone. The E2E locator is scoped to
`main`. Built in deliberately, not discovered.


## PF-101 — the two missing states, and the sweep (2026-09-07)

### `/blog`'s ERROR state is an ADDITION with no prototype source

`Blog.dc.html` has an empty state (`:196-202`) and **no error state**. Before
PF-101 a failed fetch rendered *nothing*: `showGrid = !isError` killed the
featured block and the grid, and `isEmpty` excluded `isError` so neither
empty branch fired. The page went blank under a still-rendered search
header, recorded only by a `console.error`.

**Owner-approved 2026-09-07, on the explicit condition that it invents no
new visual language.** It reuses the `.empty` surface PF-98 already shipped
— same dashed `rgba(252,163,17,.34)` border, same `rgba(252,163,17,.04)`
wash, same `clamp(22px,3vw,34px)` heading — with error copy and a retry in
place of `RESET FILTERS`.

⚠️ **NOT folded into `isEmpty`.** "No posts match" and "the API failed" are
different sentences, and PF-104's `notFoundMessage` names the search term —
meaningless when nothing was fetched.

⚠️ **`role="alert"`, where the filtered-empty panel is `role="status"`.**
That one is deliberately polite because live search fires it on nearly
every keystroke; this one is not keystroke-driven and is a real failure, so
it interrupts. **Both directions are pinned by tests** — the two panels
could otherwise silently converge on one role.

⚠️ `type="button"` on the retry, even though it sits outside the search
`<form>`. PF-97 shipped the opposite and a confirm dialog silently saved
the form.

Measured, composited, one clean load per theme: heading **19.48** dark /
**15.01** light, body **7.38 / 6.21**, retry **8.62 / 5.74**.

### The home teaser's EMPTY state

`hasData = !isLoading && !!featured` is false for a *successful* fetch of an
empty blog, so both branches fell to their loading placeholders and nothing
ever flipped them back — `aria-hidden` grey blocks, permanently, with no
copy. The new branch mirrors `BlogPage`'s zero-posts panel **word for word**
so the two surfaces agree about what an empty blog looks like.

⚠️ The values are transcribed into `BlogSection.module.css` rather than
shared with `BlogPage.module.css`. Same call, same reason, as
`BlogPostPage`'s byte-identical tag pill: `docs/design/` is frozen, so the
next owner instruction moves one and not the other.

⚠️ **BROWSE ALL WRITING stays.** The empty panel replaces the featured slot
and the rows render `null`; the link is a fixed child of the column with no
dependency on the query, exactly as it already survives the loading state.

### `sweep` now animates `background-position`

One line in `base.css:136`, matching both prototypes byte-for-byte. All
three consumers already carried the correct `background-size`, so **no
consumer changed** and `animations.css` did not either.

⚠️ **The sheen is subtle at the design's own values** — effective source
alpha **0.0635** at the band's peak, about **+16 R / +10 G / +1 B** through
`mix-blend-mode: screen`. It is clearest in motion. **That is the
prototype's number; amplifying it is a design change and needs asking.**

⚠️ `AboutSection`'s `.portraitSweep` is on the **home page**, outside this
ticket's blog scope, and changed anyway — batching all three was the whole
reason the fix was parked in PF-101.

### Titles wrap rather than clip

`.featuredTitle` (`/blog`) and `.title` (`/blog/:slug`) take
`overflow-wrap: anywhere`, matching `.emptyTerm`'s existing precedent.
⚠️ Not a narrow-viewport fix: an unbroken 85-character token exceeded the
box at **1280px** as well as 320. The teaser's rows and the reading view's
nav cards were measured and need no guard — `.rowBody`'s `min-width: 0`
already covers the first.


## The blog teaser's featured card fills its cell (2026-09-07)

**Owner-requested, and a DEVIATION — not a repair.** `Portfolio
Revolution.dc.html:421` declares `align-items: start` on the teaser's outer
grid and its featured card carries no `height` or `min-height`;
`BlogSection.module.css` matched it value for value. The transcription was
faithful. The owner asked for the change after seeing the result.

**What it looked like.** Measured live, both themes: featured card **394px**
against a right column of **631px**, leaving **238px** of page background
under the card.

**The change, and why it is scoped the way it is:**

| element | declaration | why |
| --- | --- | --- |
| `.featuredCard` | `align-self: stretch` | fills the cell |
| `.featuredFooter` | `margin-top: auto` | spends the reclaimed height on the CTA alone |
| `.featuredPlaceholder` | `align-self: stretch` | keeps the load from jumping |
| `.grid` | **unchanged — `align-items: start`** | see below |

⚠️ **The grid is deliberately NOT changed.** `align-items: stretch` there
would also stretch the right column, which is the case PF-86 was right to
prevent: with few rows the column becomes the shorter item and its 12px
gaps spread to fill. That never happens at three rows — the column is the
taller one — so PF-86's reasoning was sound about a case that does not
ship. **Both halves are true; they apply to different post counts.** The
deviation is one property on one element.

⚠️ **`justify-content: space-between` on the card was tried and REJECTED.**
It redistributes all six children, floating the `LATEST POST` badge alone
and pulling the title off its excerpt — it overrides the card's transcribed
`gap: 16px`. `margin-top: auto` moves only the CTA and leaves every other
spacing intact. Pinned as an absence so it cannot return as a tidy-up.

⚠️ **`margin-top: auto` REPLACES the prototype's `margin-top: 6px`; it is
not a floor on top of it.** `auto` resolves to **0** where there is no free
space, so in the single-column layout the gap above the CTA is the card's
own 16px rather than 22px. Six pixels, at widths where the card is
full-bleed. Measured and accepted, recorded so it is not later filed as a
regression.

⚠️ **The placeholder pairing is load-bearing, not tidiness.**
`min-height: 394px` was measured by PF-86 to match the real card so the
grid does not shift when data lands. Stretching the card without it would
have reintroduced that shift. Measured after: placeholder **629px** →
card **631px**, a **2px** jump; unpaired it would have been **237px**.

⚠️ **`.empty` does NOT stretch, deliberately.** When the blog is empty the
rows render `null`, so the column is just `.browseAll` and the panel is
already the taller item — stretching would inflate a short message to full
height if the column ever grew.

**Accepted consequence, stated rather than discovered later:** the card is
**38%** empty inside at 1440/1280, **47%** at 1024 and **54%** at 768. At
the mid widths the two tracks are only ~340px each, so the rows wrap and
the column balloons — that emptiness exists today as bare background under
a short card, and this change relocates it inside the card rather than
creating it. Owner reviewed the 768px case specifically and chose to keep
one behaviour at all widths. **The mid-width strain of this two-column
layout is a separate, pre-existing weakness, not this change's to fix.**


## The blog teaser's featured card carries a FIXED BACKDROP PHOTOGRAPH — one per theme (2026-09-07)

**Owner-requested, an ADDITION with no prototype source.** The prototype's
featured card has its gradient and `.sweep` and no image. **Fixed**
backdrops, deliberately not per-post — `Blog.coverImage` exists in the
schema (`Blog.js:113`) with no consumer and is **not** wired to this.

Implemented as `.featuredCard::before` — pure CSS, no JSX change.

### ⚠️ THIS SUPERSEDES AN ALWAYS-DARK CARD DECIDED THE SAME DAY

For part of 2026-09-07 the card was **dark in both themes**, with the light
theme restoring `tokens.css`'s `:root` palette on `.featuredCard` so
descendants inherited dark values. **That decision was sound** — the navy
photograph could not carry the light theme's dark ink, and PF-91's terminal
panel is the precedent ("the SURFACE decides, not the colour").

It was replaced only because the owner then supplied a **light-appropriate
photograph**, which removes the constraint that forced it. Both halves are
recorded so the reversal is legible rather than looking like drift.

⚠️ **Do not re-add the light token block.** A test asserts its absence.
Layered on top of the current design it would leave a dark card wearing a
light photograph.

### Two photographs, two crops

| | dark | light |
| --- | --- | --- |
| asset | `blog_section_first_card.jpg` (299,131 b) | `blog_section_first_card_Light_Mode.jpg` (349,837 b) |
| crop | `left center` | **`center`** |
| scrim (`--gnd` alphas) | .88 → .56 | **.84 / .84 / .80 / .34 / .16** |

⚠️ **The crops differ on purpose and normalising them breaks one.** The
light photograph contains the WORD "BLOG" in Scrabble tiles; rendered at
all three positions, `left center` **slices the G**. The dark photograph's
objects sit in its left third and want `left center`. Vertical has no slack
to tune — `cover` yields exactly 631px — so the word cannot be moved out of
the text's way; its upper half is scrimmed.

⚠️ **The light scrim is a legibility requirement, not a look.** 19.7% of
that photograph's pixels are dark (wood between tiles, black letters); its
5th-percentile backdrop luminance gives **1.07** against `--strong`.
Measured as the top alpha rose:

| top alpha | excerpt | meta | |
| --- | --- | --- | --- |
| .62 | 2.64 | 3.60 | fail |
| .72 | 3.90 | 4.50 | fail |
| .80 | 4.64 | 5.08 | pass, 0.14 margin |
| **.84** | **5.08** | **5.45** | **shipped** |
| .88 | 5.54 | 5.82 | pass, visibly more washed |

⚠️ **The two stops BELOW the text were then opened up separately** — 74%
`.52 → .34` and 100% `.40 → .16`, on the owner's note that the card read
too "glowy". That band carries no text, so the text-band alphas
(0/34/56%) were left alone and **excerpt and meta did not move** (5.08 /
5.45). Only the footer changed, 8.89 → **7.02**, still well clear.
**This is the lever to reach for if the wash is ever too heavy again** —
lightening the text band instead costs legibility directly.

⚠️ **A first estimate of ~.50 was wrong in an instructive way**: it eased
the wash off across 34–56%, exactly the band the excerpt occupies. The top
alpha is not the whole story — **the 56% stop matters as much.**

### ⚠️ `::before` paints ABOVE the element's own background

The card's transcribed gradient sits **under** this layer and does **not**
attenuate the photograph. An early attempt assumed gradient-over-image and
measured as safe; it was not. The scrim lives **inside** `::before`.

⚠️ `position: absolute` is load-bearing beyond placement: `.featuredCard`
is `display: flex`, so a `::before` is a **flex item** in flow and pushes
every child down.

### ⚠️ First theme-scoped image in the repo

Only the **active** theme's file is fetched — CSS requests a background
lazily and only for a rule matching a rendered element — so this costs one
image per visit, not two. The consequence is that a **theme toggle fetches
the other one at that moment and can pop.** Not preloaded, deliberately:
preloading would make every visitor pay for both.

### Contrast, measured against a validated control

| node | light control | light | dark |
| --- | --- | --- | --- |
| title | 14.84 | **14.49** | **17.41** |
| excerpt | 6.47 | **5.08** | **5.80** |
| meta | 5.92 | **5.45** | **5.80** |
| footer | 13.82 | **7.02** | **14.42** |

⚠️ **THREE MEASUREMENT INSTRUMENTS FAILED BEFORE ONE WORKED.** Full account
in `silent-failures.md`. The control — measure with the image removed and
require the known numbers back — is the only thing that separated them.

### The assets

Both arrived at full camera resolution and were resampled before
committing, with `sips -Z 1600 --setProperty formatOptions 75`:

| | supplied | shipped |
| --- | --- | --- |
| dark | 6016×4016 / 3,849,085 b | 1600×1068 / **299,131 b** (−92.2%) |
| light | 6000×4000 / 4,137,524 b | 1600×1066 / **349,837 b** (−91.5%) |

They load on the home page; do not replace either with an unresampled
original.


## The About portrait's sweep is removed (2026-09-07)

**Owner-requested.** `.portraitSweep` — the amber sheen travelling down the
About photograph — is gone, **element and rule**, not merely its animation.

⚠️ **PF-101 IS WHY IT WAS VISIBLE, and the two are hours apart.** Until
that commit, `base.css`'s `sweep` animated `transform` where both
prototypes declare `background-position`, so the gradient's band sat
outside the paint area for the whole cycle and **the sheen had never
painted on any consumer**. PF-101 corrected the keyframe, the owner saw
this animation for the first time, and asked for it gone. Recorded together
or the removal reads as unrelated to the fix that caused it.

⚠️ **The prototype STILL CARRIES IT** at `Portfolio Revolution.dc.html:204`
and `docs/design/` is frozen, so a fidelity pass will see the gap. The
module preserves the full declaration block in prose beside the note.

⚠️ **`.portraitFade` STAYS** — a different absolute child, the soft bottom
edge, predating the sweep. **This is the second time that sibling has been
at risk in this file**; it nearly went with the caption in 2026-08. Its
survival is asserted in the same tests as the removal, deliberately.

⚠️ **`kf-sweep` is NOT dead.** Two consumers remain —
`BlogSection.module.css` and `BlogPage.module.css` — so the carrier in
`animations.css` stays. Verified live: the blog card still reports one
running `sweep` after the removal, and the portrait frame reports **zero**
running animations across **two** children (img + fade), both themes.

⚠️ **`AboutSection.module.css` now declares NO animation at all**, and its
header comment asserted the opposite. Corrected rather than left — a reader
asking "which animation does About run" would otherwise get a stale answer.

### ⚠️ A guard that was vacuous on first write

The absence test pairs "the sweep is gone" with "`.portraitFade` is still
declared". The survivor half was first written
`expect(stripped).toContain('.portraitFade')` — **vacuous**: renaming the
rule to `.portraitFadeX` still contains that substring, and a mutation
doing exactly that **passed all 28 tests**. Same family as `pill`/`pillRow`
and `card`/`cardPlaceholder`. Now anchored on the opening brace,
`/\.portraitFade\s*\{/`, and that mutation fails as it should.

