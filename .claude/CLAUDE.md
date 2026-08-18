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

Numbering note: six Jira epics were created after PF-52, consuming keys
PF-53–PF-58. The jump from PF-52 to PF-59 is intentional.

**⚠️ Before cutting `sprint-11-main-page`:** confirm PR #4 from
`sprint-10-design-system` has actually merged into `master`
(`gh pr view 4 --json state,mergedAt`). If Sprint 11 branches before that
lands, none of PF-66–74's primitives exist on the new branch and the first
import in PF-75 fails. Check, don't assume.

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
| 9 | PF-83 | Reduced-motion + a11y pass | 3 | all | — |
| 10 | PF-84 | Sprint gate, PR, close | 2 | all | — |

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

**Sprint 11 is in progress** — PF-75 through PF-82 done and on the branch
(41 of 46 points), PF-83 next.

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

Mobile nav treatment and the cursor-web budget lever are decided — see
Locked decisions. The canvas-palette question that was on this list earlier
turned out not to be a decision at all: `pal()` is called fresh inside the
`requestAnimationFrame` loop itself, every frame, not once at setup, so the
star field already tracks theme toggling live. PF-76 read that same live flag
through a ref updated by its own small effect, rather than putting `isLight`
in the draw loop's dependency array — which would have torn the loop down and
regenerated every star's position on each toggle.

What's ready to build with — **all of this exists on the branch today**. Exact
paths, because they are not guessable from the ticket names:

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
        base.css                 the 22 shared by every screen
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
- **32 keyframes** (`frontend/src/styles/keyframes/`) — `base.css` holds the 22
  shared by every screen. `flt`/`drift`/`sheen` are per-screen variants, and
  there are **8 of them, not 9**: the Blog prototype has no `drift` animation
  at all, so `drift-blog` does not exist and never should. `auroraA`/`auroraB`
  are Admin-only and live in `admin.css`. 22 + 8 + 2 = 32.
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

**Built by PF-75 — all of this exists on the branch today:**

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
- **The card hover transition is a sanctioned deviation, not a
  transcription** — see Locked decisions. The prototype declares none.
- **The pill's transition IS the prototype's, declared bare.** Unlike the
  card, the pill is not a `Reveal` — the prototype wraps only the card (line
  253) and the pills arrive with it — so nothing competes for the property
  and it needs no `[data-reveal='in']` gate. Wrapping pills individually
  would stagger 26 entrances where the design has five; guarded.
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
- **The stat card's hover transition is gated on `[data-reveal='in']`.** The
  card is itself a `Reveal`, so its hover transition and Reveal's entrance
  transition compete for one element and cannot merge. Declared bare — as the
  ticket had it — `.statCard` ties with `.reveal` at (0,1,0) and wins on
  stylesheet order, replacing the 1.05s entrance ease with a 0.25s hover
  transition. `.statCard[data-reveal='in']` is (0,2,0) and takes over only once
  the entrance has finished. Same fix as `.rolePill`, one attribute shorter:
  type `up` takes its transition from the base `.reveal` rather than from a
  `[data-type]` override, so there is nothing extra to clear.
  The hover *lift* is a genuine order-dependent tie —
  `.statCard:hover` against `.reveal[data-reveal='in']{transform:none}`, both
  (0,2,0) — and it resolves correctly because the section module is emitted
  after Reveal's. Measured rather than assumed, in the **production** build:
  the card reaches exactly `translateY(-4px)` and the border goes accent.
  `.rolePill` has the identical shape and also works.
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

  **The fix — gate the hover transition behind the finished entrance:**

  ```css
  .statCard[data-reveal='in'] {          /* (0,2,0) — beats .reveal outright */
    transition: border-color .25s, transform .25s;
  }
  ```

  `Reveal` sets `data-reveal="in"` at the moment the entrance completes, so
  the element carries no hover transition until there is nothing left to
  animate in, and the two never contend.

  **Two things about the fix that are easy to get wrong:**
  - **The `:hover` rule itself stays bare.** `.statCard:hover` is (0,2,0)
    and ties with `.reveal[data-reveal='in'] { transform: none }`; it wins
    on emission order, which holds because section modules come after
    `Reveal`'s. Verified in a **production** build, not assumed.
  - **`type="pop"` needs one more attribute.** `.reveal[data-type='pop']`
    declares its own transition at (0,2,0), so a `[data-reveal='in']` gate
    only ties with it. `.rolePill` uses
    `.rolePill[data-reveal='in'][data-type='pop']` — (0,3,0) — for exactly
    this reason. Types `up`/`rise`/`left` take their transition from the
    base `.reveal` and need only the one attribute.

  **Detection.** `getComputedStyle(el).transitionDuration` during the
  entrance reads the hover value (`0.25s`) instead of `1.05s`. Under Vitest
  this is invisible — CSS Modules are compiled but no stylesheet is applied
  (`document.styleSheets.length === 0`), so assert the stylesheet as text:
  the bare `.cls` rule must contain no `transition`, and a
  `.cls[data-reveal='in']` rule must exist. `SkillsSection.test.jsx` and
  `AboutSection.test.jsx` both do this.

  **Swept 2026-08-18** across Hero, About and Skills — 20 `Reveal`-wrapped
  classes, 4 declare a transition (`.rolePill`, `.loudCta`, `.statCard`,
  `.card`), all 4 gated, 0 ungated. The sweep also checked `composes:`
  inheritance, not just directly-declared transitions, and confirmed no
  `<Reveal>` uses a `className` the sweep could miss.

  **`patterns.module.css`'s `.pill` was the one latent trap, and it has
  been fixed pre-emptively rather than left as a warning** (2026-08-18).
  It carried a bare `transition: color .2s, border-color .2s, background
  .2s, transform .2s` with no consumer outside `.pill-accent` in that same
  file — nothing broken, but a pill is precisely what gets wrapped in a
  `Reveal` (Hero's `.rolePill` and `.loudCta` both are), so a single
  `composes: pill from '../../styles/patterns.module.css'` would have been
  occurrence three, arriving through a file nobody edited.

  **The gate needed three selectors, not one**, because a shared pattern
  cannot know how a consumer wraps it — worth reading before gating any
  other shared class:

  ```css
  .pill:not([data-reveal]),                      /* (0,2,0) no Reveal at all */
  .pill[data-reveal='in'],                       /* (0,2,0) up / rise / left  */
  .pill[data-reveal='in'][data-type='pop'] {     /* (0,3,0) pop — see below   */
    transition: color .2s, border-color .2s, background .2s, transform .2s;
  }
  ```

  - **`:not([data-reveal])` is load-bearing.** A plain `.pill[data-reveal='in']`
    gate matches only elements a `Reveal` rendered. A pill used as an
    ordinary button has no such attribute, so the gate would silently take
    its hover transition away entirely — trading one silent failure for
    another.
  - **`pop` needs the third selector.** `.reveal[data-type='pop']` declares
    its own transition at (0,2,0), so the two-part gate merely *ties* with
    it and the winner falls out of bundle emission order. The three-part
    selector settles it. Same reasoning as `.rolePill`'s.
  - Mid-entrance the element is `data-reveal="out"`, so none of the three
    match and `Reveal`'s easing owns the property — which is the point.

  Guarded by three tests in `styles/__tests__/patterns.test.js`; all three
  mutations caught. Two of them were **blind on the first attempt** and
  passed against the explanatory comment rather than the rule — see the
  Silent-failures entry on raw-text CSS assertions matching comments, which
  has the full inventory.
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

Where a mistake would be silent, add a test that would catch it.

## Locked decisions — do not reopen

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

- **Card hover transitions (2026-08-18, owner-approved).** The prototype
  declares **no** `transition` on either About's stat card (line 216) or
  Skills' category card (line 253) — only the `style-hover` end state, so
  both snap instantly. Of its 108 `style-hover` elements only about a
  dozen declare a transition at all; the hero's role pill (line 100) is
  one that does, and PF-80 transcribed it faithfully.
  PF-81 gave `.statCard` a 0.25s transition anyway, without flagging it.
  PF-82 found the mismatch, raised it, and the owner chose to keep the
  eased version and extend it to `.card` rather than revert About — two
  sibling sections disagreeing on hover reads as a bug. So:
  **both cards ease at 0.25s, the prototype snaps, and that gap is
  deliberate.** Do not "restore" either to instant.
  Both are gated on `[data-reveal='in']` — see the Silent-failures entry on
  a bare `transition:` eating a `Reveal`'s entrance. That gating is a
  correctness requirement, not part of this deviation.
- **Splash timing and the progress bar (2026-08-17, owner-requested).** Two
  more deviations from the prototype, both in `Splash.jsx`:
  - **`SPLASH_MS` is 7000, not the prototype's 4600.** The owner asked for
    ~2.5s more. Boot lines were re-scaled by the same ratio to
    `850 + i*1250` (850, 2100, 3350, 4600); left at the prototype's
    `560 + i*820` they finish by 3s and the remaining 4s reads as a stall.
  - **The bar is derived from the exit, not racing it.** The prototype's
    increment is random — `Math.random()*6 + 2.2` every 140ms — so it finished
    around 2.9s and then sat at 100% for ~1.7s while the splash ran on. That
    dead gap is what the owner reported. It now counts ticks:
    `pct = ticks / BAR_TICKS`, with
    `BAR_TICKS = ceil((SPLASH_MS - BAR_START_MS - BAR_TRANSITION_MS) / BAR_TICK_MS)`.
    **Derived, so changing `SPLASH_MS` alone keeps the two in step** — the
    desync came from two independently chosen numbers, and hardcoding the tick
    count would reintroduce exactly that. The `BAR_TRANSITION_MS` subtraction
    is not incidental: `.progressFill` has `transition: width .25s`, so writing
    100% at the exit moment would leave the bar visibly still growing as the
    splash slides away. Measured in a browser: bar writes 100% at ~6.7s,
    visually full at the exit, exit at ~7.0s.
  - **The percentage is unpadded** — `2%`, `50%`, `100%`, not the prototype's
    zero-filled `002%` / `050%`. The `padStart(3, '0')` is gone.
  - The exit is still a fixed timer and still **not** triggered by the bar
    reaching 100%. Do not "simplify" it into one — the bar measures nothing,
    and letting it drive the sequence hands the length to a decoration.
  All four are guarded by `components/splash/__tests__/Splash.test.jsx`, which
  mirrors the constants deliberately rather than importing them.
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
