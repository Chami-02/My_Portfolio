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
