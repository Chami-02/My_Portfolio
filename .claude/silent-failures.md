# Silent failures — full catalogue

Split out of `.claude/CLAUDE.md` on 2026-09-02. CLAUDE.md keeps a compact
list of every trap here (the rule, the fix, the tell). This file is the
full entry for each: mechanism, build output, measurement tables, the
discovery context, and the mutation-test record.

Read the compact list in CLAUDE.md first; come here when you need the
measurements or the "how it was found".

---

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
- **⚠️ A guard against a FUTURE change is vacuous unless its fixture can
  tell the two outcomes apart — and "we will notice when it breaks" is
  the belief that stops anyone checking.** PF-95 left an explicit
  absence-assertion in `BlogSection.test.jsx` — `it('leaves post order
  alone — publishedAt is not wired to sort yet')` — and `sprint-log.md`
  recorded it as making PF-96's sort change "a deliberate act with a
  failing test attached". It could never have done that. The fixture,
  `LIVE_POSTS`, gives p1..p4 `publishedAt` values in DESCENDING order,
  which is the identical sequence to the `_id`-ascending tiebreak it was
  pinning; and the file's main `POSTS` fixture has **no `publishedAt` key
  at all**, so a `publishedAt ?? createdAt` comparator falls back to
  `createdAt` and behaves the same. Measured in PF-96 by reverting the
  comparator: **61 of 63 passed**, the two failures being tests PF-96 had
  just added.

  **The tell is structural, not statistical**: a guard pinning "field A
  decides" needs a fixture where ordering by A and by B give DIFFERENT
  answers. If A-order and B-order coincide — even incidentally, as they
  did here because the seed's publish dates descend in insertion order —
  the test passes under both rules and is decoration. **Fix: build the
  discriminating fixture, where the two orders are exact reverses, and
  mutation-test the guard when you write it, not when you rely on it.**
  ⚠️ Generalises past ordering: any assertion of the form "X is what
  decides" is vacuous if the fixture's X and Y agree.

- **⚠️ `insertMany` does NOT stamp a batch with one identical
  `createdAt`, and a test asserting it does will pass most of the time.**
  `timestamps: true` stamps from the driver's clock as the batch is
  built, so a 4-document insert routinely straddles a millisecond and
  produces two distinct values. Measured twice here: five trials in PF-95
  (three straddled), and again in PF-96's own dev seeds (one of three
  straddled). PF-96 wrote `expect(new Set(stamps).size).toBe(1)` as a
  fixture guard — repeating the exact belief PF-95 had already corrected
  as false — and it passed alone and in three consecutive file runs
  before failing inside the full suite. **A flaky assertion whose failure
  rate is ~40% still looks deterministic across three runs.**

  ⚠️ The deeper error was choosing a property STRONGER than the one
  needed. The fixture only required that `createdAt` order differ from
  `publishedAt` order — true whether or not the stamps tie. Asserting
  identity imported an unrelated, false assumption about Mongoose.
  **Rule: assert the weakest property the test actually depends on**; a
  stronger one adds failure modes without adding coverage.

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

## A `<button>` with no `type` inside a `<form>` submits it (PF-97, 2026-09-04)

**Where it fired.** `AdminBlogPanel.jsx`'s `ChipDeleteConfirm` — the
confirm dialog for deleting a tag from the shared vocabulary. It renders
inside the post `<form>`, because it hangs off `TagPicker`, which is a
form field.

**The mechanism.** HTML's default for `<button>` is `type="submit"`. A
dialog is *visually* a separate surface, so nothing about the rendered
result suggests its buttons belong to a form several hundred pixels up
the tree. Clicking **"Yes, Remove"** therefore did two things: ran its
`onClick`, and submitted the enclosing form.

**Why it survived a manual check.** The visible outcome looked correct.
The tag really was deleted. The chip really did disappear. The post was
*also* saved and the editor closed — but "returned to the list after an
action" is exactly what the panel does after a legitimate save, so the
extra behaviour was camouflaged by a plausible one.

**How it was actually found.** A component test asserted the tags field
still existed after confirming. The debug run:

```
mutateAsync calls: 1        ← the delete fired
TAGS AFTER: <element gone>  ← the editor had unmounted
```

**The fix.** `type="button"` on both dialog buttons, plus two regression
guards asserting `updateMutation.mutateAsync` was NOT called on either
confirm or cancel.

⚠️ **The sibling dialog in the same file is fine purely by accident** —
the Delete-Post modal is rendered outside the `<form>`, so its untyped
buttons never mattered. Do not read its existence as proof the pattern is
safe.

**Rule: any `<button>` that is not the form's submit gets an explicit
`type="button"`.** Cheap, and the failure mode is invisible.

## A mutation restore is only as good as WHEN the snapshot was taken (PF-97, 2026-09-04)

**The existing rule** — "mutate, then restore from a **copy**, never `git
checkout`, while unstaged work is in the tree" — is in this file because
`git checkout` once silently reverted a real edit. PF-97 found its blind
spot.

**What happened.** The copy was made at the top of the same command that
*wrote* the feature, so it captured the state **before** the
implementation. Restoring from it after the first mutation therefore
reverted the entire feature. The three remaining mutations then ran
against code that did not contain the thing they were supposed to be
testing, and dutifully reported failures — which read exactly like
"mutation caught".

**The only tell.** The **control run** at the end came back `4 failed, 25
passed` where it should have been `29 passed`, with the file reported as
"restored". Confirmed by:

```
$ grep -c "inUse" src/controllers/vocabularyController.js
0            ← the implementation, gone
```

**Two rules, and the second is what actually saves you:**

1. Take the snapshot **after** the edit under test, and name it for what
   it contains (`vc.WITH-INUSE`), not for what it replaces (`vc.orig`).
   An `.orig` name invites exactly this mistake.
2. **Always end a mutation pass with a control run.** Without one, four
   meaningless failures get recorded as evidence for code that was not
   present. A failing control means the harness is broken, not the fix —
   diagnose the harness before believing any result in the batch.

⚠️ Generalises past mutation testing: **any verification loop that
mutates and restores can end up measuring a state nobody intended.** The
control is the cheapest instrument that detects it.

## ⚠️ The `sweep` keyframe was MIS-TRANSCRIBED and its sheen never painted (found PF-98, 2026-09-05 — FIXED PF-101, 2026-09-07)

**✅ FIXED 2026-09-07.** `base.css:136` now declares
`background-position: 0 -160% → 0 160%`, matching both prototypes. One
line; all three consumers were already carrying the correct
`background-size`, so none of them changed and `animations.css` did not
either — `.kf-sweep` only ever carried the name.

**Verified with the instrument that works, and with a control:**
`el.getAnimations()[0].effect.getKeyframes()` now reports
`backgroundPositionX`/`backgroundPositionY` (Chrome splits the shorthand);
computed `background-position` reads `0px -154.101%` mid-cycle where it
used to sit static. The band's position through the 9s cycle, measured on
`/blog`'s featured card (352px box):

| t | `background-position-y` | band | inside the box? |
| --- | --- | --- | --- |
| 0ms | -160% | 1815px | no |
| 4000ms | -17.7778% | 706px | no |
| **5300ms** | **28.4444%** | **345px** | **yes** |
| **5900ms** | **49.7778%** | **179px** | **yes** |
| **6500ms** | **71.1111%** | **13px** | **yes** |
| 7500ms | 106.667% | -265px | no |

Those three crossings are the same t-values PF-98's amplified control
predicted. The amplified control was re-run after the fix (band to solid
red, opacity 1, blend normal) and the band is plainly visible crossing the
card — where before it showed nothing at any point in the cycle.

⚠️ **The shipped bundle is the check that matters, and it flipped**:
`dist/assets/*.css` carried `@keyframes sweep{0%{transform:translateY(-120%)}…}`
and now carries `@keyframes sweep{0%{background-position:0 -160%}to{background-position:0 160%}`.

⚠️ **At the prototype's real values the sheen is SUBTLE** — measured, the
layer contributes an effective source alpha of **0.0635** at the band's
peak (`rgba(252,163,17,.14)` × `opacity: .45`), i.e. about
**+16 R / +10 G / +1 B** over whatever it sits on, through
`mix-blend-mode: screen`. Clearest in motion, easy to miss in a still.
That is the design's value, not a shortfall — do not amplify it without
asking.

⚠️ **The blind spot is closed too.** `keyframes.test.js` now pins the
PROPERTY each of the 33 keyframes animates, not just its name, and has a
coverage assertion so a new keyframe cannot join unguarded. Mutation-
tested three ways: reverting `sweep` fails it, mutating `shimmer`
(the one other `background-position` keyframe — the control that proves
the guard generalises rather than special-casing `sweep`) fails it, and
adding an untabled keyframe fails it.

**The original entry follows, because the mechanism is the reusable part.**

---

**Measured, with a control. Deliberately NOT fixed in PF-98 — owner's call:
PF-101 fixes all three consumers together, so they stay identical until then.**

**Both prototypes declare `sweep` as a `background-position` animation:**

```
docs/design/Blog.dc.html:31                 @keyframes sweep{0%{background-position:0 -160%}100%{background-position:0 160%}}
docs/design/Portfolio Revolution.dc.html:39  ...byte-identical...
```

`frontend/src/styles/keyframes/base.css:136` has it as a **transform**
(`translateY(-120%)` → `translateY(120%)`). The shipped bundle carries the
wrong one — confirmed in `dist/assets/*.css`, not just in source:

```
@keyframes sweep{0%{transform:translateY(-120%)}to{transform:translateY(120%)}
```

**The mechanism, and why translating the box cannot save it.** Both consumers
paint with `background-size: 100% 300%/320%` and leave `background-position`
at its default `0% 0%`. The gradient's amber band is at 50% of the *image*, so
it sits `background-size / 2` down from the **box's own top** — and the
background is painted only inside that box. Measured live:

| element | box height | `background-size` | band sits at | inside the box? |
| --- | --- | --- | --- | --- |
| `BlogSection.module.css` `.sweep` | 322px | `100% 320%` | **515px** | **no** |
| `AboutSection.module.css` `.portraitSweep` | 784px | `100% 300%` | **1176px** | **no** |

A `transform` moves the box and its painted background *together*, so the band
stays outside the paint area at every point in the cycle. **Generalised: with
a static `background-position`, any `background-size` over 200% puts the 50%
band outside the element and nothing renders.**

**Verified in a real browser, with the control that makes the zero meaningful.**
Amplifying the layer (opacity 1, `mix-blend-mode: normal`, the band to solid
red) and stepping the paused animation to 0% / 12.5% / 60% of its 9s cycle
showed **nothing at any point**. Swapping in the prototype's keyframe on the
same element then showed the band sweeping **bottom → top** across the whole
card at t≈5300 / 5900 / 6500ms. **Same element, same probe: one paints, one
does not.**

⚠️ **Why every previous verification passed.** PF-81 and PF-86 both asserted
`getAnimations()` → one running animation named `sweep` at 8000/9000ms
(`sprint-log.md:2701`, `:3006`, `:3222`). That is true of the wrong keyframe —
the transform animation really is running. **`getAnimations()` proves an
animation exists, never that it is the right one.** The instrument that
answers the real question is
**`el.getAnimations()[0].effect.getKeyframes()`**, which returns the computed
keyframes and named `transform` outright.

⚠️ **`keyframes.test.js:31` pins the NAME `'sweep'` and not its content**, so
the whole 32-keyframe guard is blind to this class of error. Every other
keyframe in that list has the same exposure.

⚠️ **The `+1/+1/+0` reading in `sprint-log.md:1671` is not evidence against
this.** It was recorded in LIGHT as proof that `mix-blend-mode: screen` is
invisible on paper. A layer that paints nothing at all produces the same
reading, in both themes — the two explanations were never distinguished, and
the "it works in dark" half of that entry was asserted, not measured.

## ⚠️ A `fullPage` screenshot never scrolls, so every scroll-reveal below the fold is captured at opacity 0 (PF-98, 2026-09-05)

`page.screenshot({ fullPage: true })` stitches the document without moving the
viewport, so an `IntersectionObserver` gated on visibility never fires. Every
`Reveal` below the first screen is captured in its **pre-entrance** state —
`data-reveal="out"`, `opacity: 0` — and the screenshot shows a page with a
large blank region where its content should be.

**It reads exactly like a broken layout.** During PF-98 a 375px shot of
`/blog` showed the featured card followed by empty space to the footer;
measured, all four grid cards were present at their full heights (369 / 369 /
308 / 308) and simply transparent.

**The fix, when a screenshot is the instrument:** scroll the document through
before capturing, then return to the top.

```js
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150));
  }
  window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
});
```

⚠️ **A second, opposite artefact in the same capture mode:** `position: fixed`
elements are composited once, so the fixed header can appear drawn *over*
content it does not actually cover. On the same shot the `FIELD NOTES` H1
looked clipped by the header; hit-testing with `elementFromPoint` at 320 /
375 / 430 / 768 / 1440 reported the eyebrow at 122px and the H1 at 157px
against a header bottom of 71px, **occluded: false at every width**. Same
family as the CLIPPED-vs-OCCLUDED entry above: **a screenshot cannot settle a
stacking question, and `fullPage` cannot settle a reveal question.**

## ⚠️ The E2E suite already exceeds the backend's rate limiter, and it fails silently (found PF-98, 2026-09-05)

**Measured, and it is PRE-EXISTING — not caused by PF-98.** The backend allows
100 req / 15 min / IP (`backend/src/middleware/rateLimiter.js`). A full
Playwright run makes several hundred, so the later specs are served **429**
and their sections render their error state.

```
suite WITHOUT the new blog spec :  40 tests, 27 "429" lines
suite WITH    the new blog spec :  52 tests, 29 "429" lines
```

Specs whose sections 429'd in the baseline: `admin`, `contact`, `footer`,
`homepage`, `navigation` — i.e. everything after the first few.

⚠️ **It is silent because nothing asserts on that data.** Those specs check
chrome, hrefs and scroll positions, so a section rendering its error state
changes nothing they look at. The suite is green while a large fraction of it
drives a degraded page.

⚠️ **The first spec that DOES assert on data late in the run fails, and the
failure is unreadable.** PF-98's first draft of `e2e/blog.spec.js` ran against
the real stack and failed with `Expected: > 2, Received: 1` chips — the
vocabulary request had been throttled, so the chip row rendered `'All'` alone.
Nothing about that message points at a rate limiter.

**The rule this makes concrete, already in the Playwright section above:
prefer `route.fulfill()` with a fixture.** PF-98's spec now stubs everything
except one deliberate real-stack test, which took its contribution from ~33
requests to 2. **Not fixed for the suite as a whole** — raising the limiter
for `NODE_ENV=test`, or resetting it per spec, is its own ticket. On the
Outstanding-work list.

## ⚠️ `validateSync()` runs NO middleware, so a hook-derived field is silently not derived (PF-103, 2026-09-06)

**Where it bit.** Migration `006-blog-reading-time-honest.js` needs to know
what `readingTimeMinutes` *would* become before deciding whether a post needs
writing — that is the whole `--dry-run` contract. The obvious way to get it
without writing is to validate the document in memory, and the obvious call is
`post.validateSync()`.

**It does not fire `pre('validate')`.** Measured directly, because guessing
about middleware is how PF-95's bug survived:

```
new Blog({ ...501 words... }); doc.readingTimeMinutes = 99;
doc.validateSync()   → readingTimeMinutes stays 99      ← hook never ran
await doc.validate() → readingTimeMinutes becomes 3     ← hook ran
```

**Why it is silent, and why it is worse than a normal bug.** `validateSync()`
returns `undefined` for a valid document — exactly what a successful validation
returns. Nothing throws, nothing warns, the script exits 0. The failure mode is
that the migration reports **`Updated: 0   Already correct: 4`** — the same
output a correctly-migrated database produces. So the dry run says "nothing to
do" and the live run writes nothing, on a database that is entirely wrong.

⚠️ **This is the "always run the control" rule with real stakes.** The first
006 dry run against freshly-seeded data printed `Already correct: 4`, which was
the *true* answer for that data and would have been read as proof the script
worked. The bug only surfaced by planting production's 6/7/4/5 into the dev
database with `collection.updateOne()` (which bypasses hooks, the way 005 left
them) and re-running: a working script reports `Updated: 4`, a broken one still
reports `Already correct: 4`. **A probe that reports zero looks identical to a
clean result — construct the dirty state and check the probe sees it.**

**Fix: `await post.validate()`.** It runs the middleware. `validateSync()` is
also deprecated and slated for removal in Mongoose 10, so there is no reason to
reach for it.

**Generalises beyond Mongoose:** any `*Sync` variant of an async API is a
candidate for silently skipping the async pipeline the hooks live in. Before
using one to *observe* a derived value, prove it derives — a one-line probe
that sets the field to a sentinel and checks it changed.

⚠️ **Corollary for migrations specifically.** A migration that reads a derived
value must go through the code that derives it, never re-implement the formula.
006 deliberately contains no word counter — a second copy would be a second
source of truth, which is the drift 005's own header warns about. The cost of
that choice is this trap: the derivation is invisible in the file, so the call
that triggers it has to be the right one.

## ⚠️ Playwright's `getByRole` name matches by SUBSTRING; testing-library's does not (PF-104, 2026-09-06)

Adding a clear button beside the search button on `/blog` gave the page two
controls whose accessible names are `Search` and `Clear search`. The E2E click

```js
main(page).getByRole('button', { name: 'Search' }).click();
```

failed with a strict-mode violation resolving **2 elements** — because
Playwright matches an accessible name by **case-insensitive substring** unless
`exact: true` is passed, and `Clear search` contains `search`.

⚠️ **The trap is that the unit test for the same button passes without it.**
testing-library's `getByRole({ name })` matches a *string* name in FULL, so
the identical-looking assertion in `BlogPage.test.jsx` is exact and green.
Two libraries, opposite defaults, same-looking call — so "it works in the unit
test" is no evidence at all about the E2E one.

**Fix: `{ name: 'Search', exact: true }`.** Reach for `exact: true` whenever a
name is a prefix of, or contained in, another control's name on the same page
— which is very easy to create accidentally, since `Clear X` / `X` and
`Open menu` / `menu` are natural label pairs.

This failed LOUDLY, which is why it is cheap. The dangerous version is the
inverse: a substring match that resolves exactly one element today and starts
matching two when an unrelated control is added later — the same shape as the
`[class*="name"]` selector trap already documented above.

## ⚠️ Counting every control in a landmark as a stand-in for one component (PF-104, 2026-09-06)

`e2e/blog.spec.js` asserted the tag-chip row like this:

```js
const chips = main(page).getByRole('button');
await expect(chips).toHaveCount(TAGS.length + 1);   // + 'All'
```

It passed for a sprint because the chips genuinely were the only buttons in
`<main>`. PF-104 added one search-submit button inside the same landmark and
the test failed with `Expected: 7  Received: 8` — under the name *"the chip
row is the tag pool, and does not shrink as posts filter"*, which is not what
broke. A reader chasing that failure looks at the vocabulary API first.

**Same family as the `[class*="name"]` trap**: a locator that selects the
right set today for a reason unrelated to what the assertion is about.

**Fix — assert NAMES, not a count:**

```js
const chipLabels = (page) =>
  main(page).locator('form[role="search"] button')
    .allTextContents()
    .then((l) => l.map((t) => t.trim()).filter(Boolean));

await expect.poll(() => chipLabels(page)).toEqual(['All', ...TAGS]);
```

Two things this buys beyond not breaking: the icon-only controls have empty
text so they filter themselves out — no exclusion list to keep in step as
more are added — and the assertion now fails when the row keeps its LENGTH
while swapping a tag, which a count cannot detect.

## ⚠️ Piping a long-running command through `tail` hides all progress, and reads as a hang (PF-104, 2026-09-06)

`npm test 2>&1 | tail -20` buffers every line until the process exits, so an
in-progress run writes an **empty** output file. Combined with a backend suite
that had slowed from ~40 s to ~335 s against a laggy Atlas connection, this
produced a confident and wrong diagnosis: *the suite is hanging*. Twenty
minutes were spent killing jest, checking SRV DNS and looking for a local
Mongo before the suite was simply allowed to finish — **341 passed**.

The SRV check was not wasted, and this is the part worth keeping: the system
resolver really did return **0** SRV records for the cluster at one point
while `1.1.1.1` returned all three, matching the documented broken-resolver
entry above. It recovered on its own minutes later. So there were two
independent things going on, and the measurement that mattered
(`nslookup -type=SRV … 1.1.1.1`) correctly identified one of them.

**Rules that fall out:**

- **Redirect, do not pipe, when you intend to watch progress:**
  `npm test > /tmp/be.log 2>&1` and then `tail -f` / poll the file.
- **An empty output file is not evidence of a hang** — it is evidence of
  buffering. Check `ps` for a live process and the file's mtime before
  concluding anything.
- **`timeout` does not exist on macOS.** `timeout 540 npm test | grep …`
  fails with `command not found`, the pipeline exits 0, and the empty output
  looks exactly like a clean run that matched nothing. Use `gtimeout`
  (coreutils) or the harness's own background mode.

## ⚠️ An array silently bypassing a `typeof x === 'string'` guard (PF-105, 2026-09-06)

`buildMatch` narrowed the tag filter like this:

```js
const tagValue = typeof tag === 'string' ? tag.trim() : '';
if (tagValue && tagValue.toLowerCase() !== 'all') { …apply the filter… }
```

Correct for one tag. When PF-105 started sending `?tag=Docker&tag=DevOps`,
Express's query parser handed `buildMatch` an **array**, which failed the
`typeof` test, produced `''`, and skipped the entire block. Measured before
the fix: that request returned **all 4 posts with a 200**.

**Why it is worth an entry.** The guard was written defensively and it *is*
the right shape — it is the fallback value that lies. `: ''` means "no filter"
here, so an unexpected type is indistinguishable from an absent one. The
symptom is not an error, a 400, or an empty result: it is the feature quietly
not applying, which reads as *"the tag filter stopped working"* rather than
*"the tag filter received something it did not understand"*.

**The consequence for planning:** every layer had to change in one ticket.
A half-migrated version — page sending an array, server still on the string
path — is green, 200, and silently unfiltered.

**Rules:**

- When widening a parameter from scalar to array, **grep every
  `typeof … === 'string'` on that value first**. Those are the places that
  will fail open.
- Prefer a fallback that cannot be confused with a valid state, or normalise
  at the boundary: `(Array.isArray(x) ? x : [x]).filter(…)` handles both and
  has no silent branch.
- **Always assert a zero case.** `?tag=Nonexistent` → 0 is what separates
  "filtering correctly" from "not filtering at all". Every positive assertion
  passes under a filter that matches everything.

## ⚠️ axios serialises array params differently from `URLSearchParams` (PF-105, 2026-09-06)

`useSearchParams` — what react-router writes into the address bar — produces
the **repeat** form, `tag=a&tag=b`. axios v1 produces the **bracket** form,
`tag[]=a&tag[]=b`.

Express's `qs` parser turns *both* into an array, so this "works". That is the
trap: the URL a visitor copies is then **not** the URL the app fetches, the
React Query key is built from one shape while the request goes out in the
other, and any future check on the raw query string sees a form no client code
writes.

**Fix, once on the shared instance** (`services/api.js`):

```js
paramsSerializer: { indexes: null },   // repeat form
```

**Verify it rather than assuming**, from `performance.getEntriesByType('resource')`:
count `/[?&]tag=/` occurrences in the real request URL, and assert
`tag(%5B%5D|\[\])=` appears **zero** times. Checking only that the request
"has tags in it" passes under either serialisation.

## ⚠️ A stale DOM node reference after a React re-render reads as a theming bug (PF-105, 2026-09-06)

While measuring contrast, a chip sampled after clicking the theme toggle
reported the **dark** `--srf` and `--muted` while `:root` had correctly
flipped to light. That looks exactly like a token-inheritance bug, and about
fifteen minutes went into chasing one.

There was none. The toggle re-renders the row, React replaces the button
element, and the handle captured earlier pointed at a **detached** node —
which keeps the computed style it had when it left the document. Re-querying
`document.querySelectorAll` gave the correct light values immediately.

**Rules:**

- **Re-query after any state change**, never reuse an element handle across a
  render. The stale node does not throw; it answers with old data.
- **For theme measurements, prefer one clean page load per theme** — set the
  persisted key (`pg-theme` here) and reload — over toggling mid-session.
  Three consecutive in-session measurements disagreed with each other before
  this was noticed; the reload-per-theme numbers were stable and reproducible.
- The tell was an **impossible reading**: a disabled chip measuring 1.72
  against a background where the enabled one measured 6.13, when both declare
  the same colour. When two measurements of the same declared value disagree,
  suspect the instrument before the code.

## ⚠️ `location.key` / `history.state.idx` cannot tell an initial load from a Back to the first entry (PF-106, 2026-09-06)

PF-106 needed to answer "is this HomePage mount the initial render of this
document, or a return to it?" React Router's `location.key === 'default'` reads
like the purpose-built answer: the initial history entry is the only one
without a generated key.

**It is not.** Measured in the running app by reading `history.state` at each
step:

```
initial load of "/"       history.state = { idx: 0 }             no key
click through to /blog    history.state = { idx: 1, key: 'vuv4pcku' }
browser Back to "/"       history.state = { idx: 0 }             no key
```

Going Back **restores** the original entry, state and all. There is no key to
restore, so React Router falls back to `'default'` again — and the gate would
have replayed the splash on precisely the journey the ticket existed to stop.
`history.state.idx` is 0 in both cases and fails identically.

**The general rule:** the History API is *positional*, not *temporal*. It can
tell you **where** you are in the stack, never **how many times** you have been
there. Any question of the form "is this the first time in this document" needs
state in the JS runtime — which, usefully, is also what makes a reload reset it.

⚠️ **The near-miss is what makes this worth recording.** The `location.key`
version passes every unit test you would naturally write for it (a fresh render
has key `'default'`; a pushed navigation does not), builds clean, and is wrong
only on the one journey nobody simulates in jsdom. It was caught by driving a
real browser and reading `history.state` at three points — not by reasoning.

## ⚠️ The browser-automation round-trip is slower than the thing being measured (PF-106, 2026-09-06)

Three separate point-in-time samples reported "the splash is not showing" on a
page where it demonstrably was. The reason, once instrumented:

```
performance.now() at sample time: 8465 ms
splash window:                    0 – 4500 ms
```

Every sample landed **after** the splash had already finished. The tool call
round-trip is several seconds; the thing under test lasts 4.5.

**Rules that follow:**

- **Print the timestamp of the observation, not just its result.** One extra
  field — `msSinceNavigationStart` — turned three confusing runs into an
  obvious explanation.
- **For anything transient, observe rather than sample.** A `MutationObserver`
  armed before the action survives client-side navigation and records whether
  the element *ever* appeared, independent of when the next call lands.
- ⚠️ **An observer needs its own control.** "Never fired" is indistinguishable
  from "never worked". Inject a node that matches the predicate, confirm the
  observer flips, then reset — otherwise the negative result proves nothing.
  Same family as the documented "always run the control" entries above.
- **For anything spanning a reload, the E2E suite is the right instrument** —
  it drives the same dev server (`playwright.config.js` runs `npm run dev`),
  so it also exercises StrictMode, which is where this class of change fails.


## ⚠️ The Vite dev proxy targets a DOCKER hostname, and local dev bypasses it (found PF-99, 2026-09-06)

**The tell: `502` from the page, `getaddrinfo ENOTFOUND backend` in the
Vite log, and `/api/health` returning `200` with the right database the
whole time.** It reads exactly like "the backend is down". The backend is
fine.

```
frontend/vite.config.js:49   '/api': { target: 'http://backend:5000', … }
frontend/.env.development    VITE_API_URL = …localhost:5050
```

`backend` is the **Docker Compose service name**. It does not resolve on
the host. But `.env.development` gives the app an ABSOLUTE API URL, so
`services/api.js` calls `http://localhost:5050/api/...` directly and
**never touches the proxy**. The site works perfectly; the proxy is dead
code outside Docker and has presumably been broken locally for a long
time with nothing noticing.

**How it bites a PROBE, not the app.** A browser-console probe naturally
writes a relative URL:

```js
await fetch('/api/blog')          // → 502, ENOTFOUND backend
await fetch('http://localhost:5050/api/blog')   // → 200
```

The first is a path the application itself never uses. Measured during
PF-99's verification: the reading view had already rendered real data from
the real API, and the probe issued immediately afterwards reported the API
as unreachable.

⚠️ **Same family as `?nosplash` removing the splash from an a11y audit:
the instrument took a path the product does not.** Probe the URL the app
actually calls — read `VITE_API_URL` before assuming a relative path is
equivalent — and when a probe disagrees with a page that is visibly
working, suspect the probe.

**Not "fixed" in PF-99.** Changing the proxy target is not a reading-view
ticket's business and Docker depends on it. It is on Outstanding work.


## ⚠️ A PINNED MOCK makes a "does not happen again" guard vacuous (found 2026-09-07)

**Measured: deleting the guard left all 103 tests green.**

`/blog` scrolls to the top once per mount, via a ref, so that filtering —
which rewrites the URL on every keystroke — does not yank the page upward
mid-search. The test written to protect that ref:

```js
const c = draw();
expect(window.scrollTo).toHaveBeenCalledTimes(1);
const docker = pickAll(c, 'chip').find((b) => b.textContent === 'Docker');
await act(async () => { docker.click(); });
expect(window.scrollTo).toHaveBeenCalledTimes(1);   // still one
```

`useNavigationType` is mocked, and the mock returned **one pinned value**.
The effect's `[navigationType]` dependency therefore never changed, so the
effect never re-ran, so the assertion held **with or without the ref**. The
real router genuinely reports a new type as the URL is rewritten — the mock
was the only thing holding it still.

**The fix is one line in the FIXTURE, not the assertion:**

```js
navType.current = 'REPLACE';   // what setSearchParams really produces
```

The mutation is then caught.

⚠️ **The general rule, and this is the PF-95 lesson in a new costume: any
"X does not happen again" assertion needs a fixture where the thing that
would RE-TRIGGER X actually changes.** PF-95's version was a fixture whose
publish-date order coincided with the `_id` order it pinned; this one is a
mock returning a constant where the real dependency varies. Both look like
ordinary test setup and both disarm the guard completely.

⚠️ **Only mutation testing finds it.** The test passes, reads correctly,
and names the right behaviour. Nothing about it looks wrong.


## ⚠️ An `<ErrorBoundary>` wrapping JSX in the SAME component catches nothing that JSX throws (found PF-101, 2026-09-07)

**Measured, not reasoned about.** `BlogPostPage.jsx:146` opens an
`<ErrorBoundary>`; `:223` maps `post.sections` inside it. A section whose
`body` was a string instead of an array threw
`TypeError: (section.body ?? []).map is not a function` — and the **whole
page went blank**: `document.getElementById('root').innerHTML.length === 0`,
`document.body.innerText === ''`. The boundary's fallback renders visible
content (a 3rem-padded panel with an icon), so a caught error would have
left `root` non-empty. It did not catch.

**Why, and it is not a bug in `ErrorBoundary`.** A boundary catches errors
thrown while rendering its **children as components**. JSX children are
evaluated *eagerly by the parent* — `BlogPostPage` builds the whole element
tree, including `.map()` calls, during **its own** render, before React
ever mounts the boundary it returned. The throw therefore happens in
`BlogPostPage`, one level ABOVE the boundary, and propagates to the
nearest boundary above *that* — of which there is none, so React unmounts
the tree.

```
<ErrorBoundary>            ← protects errors thrown INSIDE child COMPONENTS
  <SkillsSection />        ← ✅ HomePage's usage. Works.
</ErrorBoundary>

<ErrorBoundary>
  <article>
    {items.map(...)}       ← ❌ evaluated during THIS component's render.
  </article>                    The boundary is never mounted.
</ErrorBoundary>
```

⚠️ **So the same component and the same JSX give opposite protection
depending on whether the risky expression sits in a child component or
inline.** `HomePage`'s six boundaries are effective; `BlogPage`'s and
`BlogPostPage`'s protect their fetch-driven inline JSX not at all.

⚠️ **NOT currently reachable through the real API** — `sectionSchema`
declares `body` as `[String]`, so Mongoose rejects a string before it can
be served. The blank page above was produced by a hand-written test
fixture. Logged rather than fixed: the fix is a structural refactor
(extracting the article body into a child component), which is beyond an
audit ticket and needs its own decision.

⚠️ **The instrument.** `page.on('pageerror')` registered *before*
`goto` — a listener attached after load catches nothing and the page just
looks empty. `root.innerHTML.length` distinguishes "boundary caught and
rendered a fallback" from "React unmounted everything"; a screenshot does
not.

## ⚠️ "Element wider than the viewport" is not a responsive defect, and flags everything (found PF-101, 2026-09-07)

A first pass at a responsive audit flagged any element whose
`getBoundingClientRect().right` exceeded `innerWidth`. It reported
**72 of 72** viewport/theme/surface combinations as broken. Every hit was
intentional: marquee tracks (`4704px` wide by design), hero blobs, the
`PageShell` clip. All are clipped by an ancestor and none of them scrolls
the page.

**Two different questions, and only the second is usually a bug:**

| question | instrument |
| --- | --- |
| does the PAGE scroll sideways? | `documentElement.scrollWidth - clientWidth` |
| is CONTENT cut off inside its own box? | `el.scrollWidth > el.clientWidth` on an element whose `overflow-x` clips |

⚠️ **The second one found the real defects the first one buried** — an
unbroken 85-character title measured 1039px of content inside a 238px
`.featuredTitle` box, clipped invisibly by `.featuredCard`'s
`overflow: hidden`, with `docOverflowX` reading **0** the whole time.

⚠️ **And it is NOT a narrow-viewport bug**, which is the second lesson:
the same title clipped at **1280px** (1970 in 1106). A sweep that only
checked phone widths would have called it clean. Content can exceed every
box the design has.

⚠️ Screen-reader-only text (`.srOnly`, `clientWidth: 1`) and marquees will
always trip the self-overflow check. Exclude them by name, or the signal
drowns again.


## ⚠️ Measuring text contrast over an IMAGE: three instruments failed before one worked (2026-09-07)

Adding a photograph behind the blog teaser's featured card needed an AA
answer. **Three different instruments each produced a confident, wrong
one.** The only thing that separated them was a control: measure with the
image removed and require PF-91's already-verified numbers back.

| # | instrument | verdict | why it was wrong |
| --- | --- | --- | --- |
| 1 | analytic composite of the background layers | **pass**, worst 5.17 | modelled the gradient OVER the image. `::before` paints **above** the element's own background, so the gradient is under the image and attenuates nothing |
| 2 | screenshot, worst pixel in the text's bounding box | **fail** | a bounding box contains starfield dots, the `mix-blend-mode: screen` sweep highlight and the gaps between glyphs — pixels no letter sits on |
| 3 | screenshot diff, worst pixel a glyph covers | **fail**, harder | glyph EDGE pixels are antialiased — part text, part background. Comparing full text colour against a half-blended pixel manufactures failures |
| 4 | glyph mask from the diff, backdrop colour from the text-hidden capture, **5th percentile** | **correct** | control reproduced 5.81 / 5.79 where PF-91 recorded ~6.3 |

⚠️ **Instruments 2 and 3 both condemned a card that PF-91 had verified.**
Without the control they would have forced a redesign of something that
was not broken — and instrument 3's numbers were *internally impossible*
(contrast got WORSE as the image faded toward nothing), which is the tell
that should have stopped it sooner.

**Rules this leaves:**

- **WCAG contrast is text colour vs BACKDROP colour.** Antialiasing is not
  part of it. Never sample the rendered text.
- **Never take the single worst pixel.** Over an image use a percentile;
  the minimum is one speck under one antialiased edge.
- **The backdrop must come from a text-hidden capture**, and the sweep
  must be frozen or the two captures differ for reasons unrelated to text.
- ⚠️ **A control is not optional here.** Three of four instruments looked
  reasonable and produced confident numbers. Measuring the same page with
  the image removed, and requiring the known-good values back, is the
  cheapest thing that tells them apart.

## ⚠️ A mutation that never applies reports as "caught" — the shell ate the newline (2026-09-07)

Five mutations against `BlogSection.module.css` were driven through
`python3 -c` with regexes passed as shell arguments. `\n` arrived as two
literal characters, so **no substitution ever happened**, every run
returned the unmutated suite, and all five would have been recorded as
green guards.

The only reason it was caught: the harness diffed the file against its
snapshot and printed `changed? NO` each time.

⚠️ **Confirm the file actually changed, every mutation, every time.** The
documented rule already said so; this is the second mechanism by which it
fails silently, after "the regex hit a comment naming the value". Prefer a
script file over `python3 -c` with shell-escaped patterns, and assert the
anchor exists before replacing it.

