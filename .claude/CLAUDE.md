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
Improve it freely, no need to ask first — this is covered by the same standing
authorization already given for committing to the sprint branch (see the
Working agreement), and inherits that scope exactly: sprint branches only,
`master` excluded, both mandatory checks every time.

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
| 6 | PF-80 | Hero + marquee strip | 8 | PF-74, PF-78 | — |
| 7 | PF-81 | About — parallax, stats, outline type | 5 | PF-74, PF-80 | — |
| 8 | PF-82 | Skills | 3 | PF-81 | — |
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

**Sprint 11 is in progress** — PF-75, PF-76, PF-77, PF-78 and PF-79 done and on
the branch (25 of 46 points), PF-80 next.

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
import './styles/motion.css';   // must be LAST
```

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
- **`rgba(#hex, .5)`** → invalid, produces nothing. The five channel triplets
  (`--gnd --srf --ln --ftr --shd`) must stay as bare `R,G,B`
- **Redefined `@keyframes` of the same name** → later definition wins by
  document order
- **Connection string with no database path** → driver silently defaults to a
  database named `test`
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
  **One sanctioned exception exists to the "nothing is reduced" half**, and it
  is the only one: the star-to-star
  cursor web in `StarfieldCanvas.jsx` reads more prominently on the real site
  than in the prototype, so on 2026-08-16 the user asked for it to be toned
  down. `WEB_LINK_PX` is 130 (prototype: 150) and `WEB_ALPHA` is 0.1
  (prototype: 0.14), both named constants at the top of that file with the
  reason attached. The cursor's accent-coloured spray is a separate line family
  and stays at the prototype's 0.3. Do not "restore" these — the mismatch is a
  design decision by the site's owner, not a transcription slip, and it is
  exactly the kind of thing a fidelity check flags as a bug.
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

Prefer `lsof -ti:PORT | xargs kill` over pattern-matched `pkill`.

Backend tests live in `backend/src/__tests__/`. Run via `npm test`, never
`npx jest` — the wrapper rewrites the Mongo URI to `/portfolio_test`, which is
the only thing making `clearDB`'s wipe safe.

Frontend tests use **per-module `__tests__` directories** — `src/utils/`,
`src/styles/`, `src/providers/`, `src/hooks/`, `src/components/motion/`,
`src/components/ambient/`, `src/components/splash/` and
`src/components/layout/` each have their own. Not a top-level `src/__tests__/`.

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

**Committing on sprint branches — standing authorization.** On any
`sprint-N-*` branch, commit as work completes; no per-commit confirmation
needed. Two things are mandatory every single time, no exception:

1. `git status --short` and `git diff --cached --stat` **immediately before**
   each `git commit` runs — not earlier in the session. The drift incidents
   below are why "earlier in the session" does not count.
2. After every push, confirm the remote actually moved:
   `git ls-remote --heads origin <branch>` must match local `HEAD`. Compare
   them and report the comparison — never assume a push landed because the
   command exited cleanly.

`master` is excluded, always. A commit directly on `master` requires explicit
sign-off every time; this authorization is scoped to sprint branches only.

Granted in `dfe813e`, revoked about two hours later inside `9ad74c0` — the
PF-77 *feature* commit — and restored here on 2026-08-16, after the
revocation's stated evidence was checked and did not survive:

- The revocation claimed the authorization had been "countermanded in practice
  twice (PF-61 on 2026-08-08, PF-77 on 2026-08-16)". **PF-61 cannot count.**
  This file did not exist on 2026-08-08: it was created 2026-08-13 in
  `5be0e66`, and the authorization was not granted until 2026-08-16 in
  `dfe813e`. Nothing said during PF-61 could countermand a permission that
  would not exist for another eight days. Under the blanket rule in force at
  the time — "Never run `git commit`" — "I will commit myself" restates the
  rule rather than overriding a permission.
- That leaves PF-77: one instance, not a pattern.
- And the revocation went in unmentioned. `9ad74c0`'s message is five bullets
  about grain texture and cursor glow; it says nothing about rewriting the
  Working agreement. The change carries no recorded reasoning anywhere in git
  beyond the assertion it inserted into this file.

If this needs revoking again, revoke it in a commit whose message says so, and
cite evidence that postdates `dfe813e`.

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
