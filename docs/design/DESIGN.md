# Portfolio Revolution — Design Documentation

**Project:** Portfolio Revolution Concept
**Owner:** Parindra Gallage (Chami-02)
**Source repo:** `Chami-02/My_Portfolio` (branch `master`)
**Status:** Design concept only — no code is written back to the repository.
**Last updated:** 31 July 2026

---

## 1. What this project is

A complete redesign concept for Parindra Gallage's portfolio, built as three self-contained, interactive HTML design components:

| File | Purpose |
| --- | --- |
| `Portfolio Revolution.dc.html` | The main site — splash, hero, about, skills, projects, blog teaser, contact, footer |
| `Blog.dc.html` | Full "Field Notes" blog — searchable index + reading view |
| `Admin.dc.html` | Portfolio CMS — sign-in gate + six management panels |

Supporting files:

| File | Purpose |
| --- | --- |
| `assets/logo.png` | Circular brand logo (nav, footer, splash, admin) |
| `assets/hero-ai.png` | Hero portrait (edge-faded PNG) |
| `assets/about-portrait.png` | About section portrait |
| `assets/about-wide.png`, `assets/me-lake.png`, `assets/avatar.png` | Earlier graded photo assets |
| `github.md` | Repo association, sync log and screen map |

All three pages share one design language, one colour token system, one dark/light theme engine and one persisted theme preference.

---

## 2. Design system

### 2.1 Typography

| Role | Font | Usage |
| --- | --- | --- |
| Display | **Anton** | Huge condensed uppercase headlines, section titles, stat numbers, card titles |
| Body | **Space Grotesk** (400/500/700) | Paragraphs, card copy, form labels and inputs |
| Mono | **JetBrains Mono** (400/500/700) | Section numbers, eyebrow labels, chips, buttons, metadata, terminal |

Signature treatment: the **outline word** — the second word of a headline rendered with `-webkit-text-stroke: 1.5px var(--acc)` and `color: transparent`. Used on "WHO **I AM**", "Field **Notes**", "Admin **sign in**", "Welcome back, **Parindra**".

### 2.2 Colour tokens

Every colour flows through CSS custom properties so one attribute (`html[data-theme="light"]`) flips both themes. Channel-triplet tokens (`--gnd`, `--srf`, `--ln`, `--ftr`, `--shd`) let alpha vary per use while the base colour stays themeable.

**Dark (default)**

```
--acc      #FCA311   accent (orange)
--acc2     #7AA6D6   secondary accent (steel — theme toggle only)
--accInk   #0a0a0a   text on accent fills
--bg       #050609   page ground
--text     #E5E5E5   body text
--strong   #ffffff   headings
--muted    #93a0b8 · --muted2 #6b7891 · --faint #5c677d
--gnd 5,6,9 · --srf 20,33,61 · --ln 229,229,229 · --ftr 10,16,32 · --shd 0,0,0
--ok #34d399 · --danger #f87171
```

**Light**

```
--acc      #7E4800   deepened amber (AA on both paper and tan chrome)
--acc2     #2F5D8C
--accInk   #ffffff   white ink on accent fills
--bg       #EDE8DF   warm paper
--text     #16223B · --strong #0B1220
--muted    #45536D · --muted2 #4F5D76 · --faint #55637C
--gnd 255,255,255 · --srf 255,255,255 · --ln 20,33,61 · --ftr 226,212,190 (tan chrome) · --shd 20,33,61
--ok #0E7A55 · --danger #B4231F
```

**Key rule learned the hard way:** `applyTheme()` must **not** write `--acc` inline on `<html>` unless the user genuinely overrode the accent prop — an inline value beats the CSS theme block and makes every future token edit dead code. It now clears the inline value and reads the computed one.

### 2.3 Contrast discipline

Every text node was swept for WCAG AA. Fixes applied:
- White ink (`--accInk`) on the light accent instead of near-black → 5.47:1.
- Light-mode text tokens tuned against the **lighter** of the two grounds (tan chrome #E2D4BE), not just the paper.
- The terminal card keeps hardcoded light-on-dark colours because it is deliberately dark in both themes.
- Ghost numerals (`rgba(252,163,17,.09–.3)`) are intentional decoration and exempt.

### 2.4 Motion vocabulary

| Name | Where |
| --- | --- |
| `riseIn` / `typeIn` | Staggered entrance reveals |
| `glowdot` | Pulsing status dots |
| `glowpulse` | Breathing outline on the Contact / Admin pills |
| `sweep` / `sheen` / `shimmerline` | Travelling light across cards and buttons |
| `marq` | Marquee strips (15 s) |
| `flt` / `breathe` / `floatY` | Slow floating for chips, portrait, logo |
| `spin` / `orbdot` / `ringPulse` | Orbiting rings and loaders |
| `auroraA` / `auroraB` | Drifting colour orbs (admin login) |
| `scanline` / `flicker` | CRT texture (splash, admin login) |

Scroll reveals use an IntersectionObserver plus a 140 ms interval safety sweep, so nothing is ever left invisible if an observer misfires.

---

## 3. Image assets — how the photos were made

The uploaded photos were raw and unstyled. Each was processed programmatically on canvas:

1. **Crop** to the useful frame.
2. **Grade** to the palette — navy in shadows, orange through midtones, cream in highlights, with contrast lift and a vignette.
3. **Mask** — arch cutout for the standing portrait, circular mask for the avatar and logo, radial edge feather so PNG edges dissolve into the page.
4. **Logo** — zoomed ~1.2× and centred so the face sits fully inside the circle with no empty margin.

The hero portrait additionally gets a JS-applied radial mask in light mode (`radial-gradient(62% 68% at 50% 44%, #000 30%, …, transparent 92%)`) plus a paper-toned plate behind it, so its dark-graded edges blend into the light ground instead of showing a halo.

---

## 4. `Portfolio Revolution.dc.html`

### 4.1 Splash screen
Logo with orbiting dots and a pulsing ring, `PG` monogram, boot-log lines that type in, a percentage loader, scanlines and flicker, then the whole screen slides up like a curtain. Skip button; Replay Intro in the footer. Skipped entirely when arriving with `?nosplash=1`.

### 4.2 Hero
- Badge: "OPEN TO OPPORTUNITIES" with a glowing ring and text shadow.
- Name **PARINDRA GALLAGE** in Anton with opened letter-spacing.
- Three pop-in role pills, each led by a pulsing dot: Full-Stack Web Developer · Cloud & DevOps Enthusiast · Continuous Learner.
- Portrait on orbit rings with floating tech chips (React, Node.js, Docker, MongoDB, Python, PostgreSQL, Git).
- Stat counters that count up on reveal.
- Background: animated galaxy canvas — drifting nebula, twinkling stars, and a spider-web of strands from the cursor to nearby stars (theme-aware colours).

### 4.3 About
Real bio from the repo seed, corrected to "**Computer Science undergraduate at the University of Westminster**". Four stat cards, outlined portrait with parallax, "WHO **I AM**" headline in the house outline style.

### 4.4 Skills
Six category cards (Languages, Frontend, Backend, Database, DevOps) with 26 chips matching the repo seed exactly — every chip fills orange, inverts its text and lifts on hover.

### 4.5 Projects
Four real projects — Personal Portfolio (featured), ClearDrive.lk, Smart Campus API, Life Below Water — with seed-exact descriptions, tech chips, GitHub and live links, and a live terminal card.

**Card background images:** each card carries `data-projectcard` plus two layers — an image layer and a readability scrim. On mount the page reads `localStorage['pg-project-bgs']` (written by the admin panel), applies the image `cover`/centred at the saved visibility (default 75%), scales the scrim to match, and lifts all card content to `z-index: 2` so titles and descriptions stay perfectly legible. Re-applies on `storage` and `focus` events, so editing in the admin tab updates the site tab live.

### 4.6 Blog teaser & contact
Four seeded posts with tags and reading times; "Browse all writing" links to `Blog.dc.html`. Contact has an email CTA, Download CV, GitHub, LinkedIn.

### 4.7 Footer
Brand block with the corrected bio, Portfolio links, Elsewhere links (GitHub, LinkedIn, **Facebook, Instagram**, Email), fast marquee strip, centred copyright, Replay Intro left, Scroll back up right.

### 4.8 Navbar
About · Skills · Projects · Blog · Contact (glowing pill) — then a `|` divider — then the **Light mode toggle** and the **ADMIN** pill as a separate right-hand control group. A scroll-progress line runs under the bar.

---

## 5. `Blog.dc.html`

- Header: "Field **Notes**", glowing post-count badge, location badge.
- **Live search** over titles, excerpts and tags, plus tag filter chips for all 12 tags, an empty state and Reset filters.
- **Featured latest post** as a large card with a light sweep and oversized index numeral; remaining posts in a hover-lifting grid.
- **Reading view** — numbered sections, bulleted lists with glowing dots, tags, an Email me CTA, and Previous / Next post navigation.
- Same galaxy canvas, grain, marquee and footer language. Footer card is LinkedIn ("Stay in the loop" → Connect on LinkedIn).
- Back-to-portfolio links carry `?nosplash=1` so the intro never replays.

---

## 6. `Admin.dc.html`

Built from the **real repo source** (`AdminLoginPage.jsx`, `AdminLayout.jsx` and all six panel components) rather than screenshots, so every field and control matches the actual implementation.

### 6.1 Sign-in
Glass card on an animated stage: two drifting aurora orbs, a scanline sweep, a floating logo with a pulsing ring, a growing accent rule, staggered field reveals and a sheen that travels across the button. Real error banner on bad credentials and a signing-in state.

**Demo credentials:** `admin@portfolio.dev` / `Admin@1234!`

### 6.2 Shell
Navbar (logo, CMS badge, admin email, ↗ Home, Sign out, isolated theme toggle) · sidebar with all six sections and live counts · per-tab title and meta line · rich footer (brand, live session card with running counts, Back to home page, Sign out, centred copyright). Background is a dense node lattice with cursor-linked strands — no clouds, no marquee, per the brief.

### 6.3 Panels

| Panel | Capabilities |
| --- | --- |
| **Overview** | "Welcome back, **Parindra**" with a time-aware greeting, four stat cards, quick actions that jump into the right panel |
| **Projects** | Create/edit form (title, GitHub, live URL, order, description, tech, featured), tech-stack chip picker, background-image upload + visibility meter, list with Featured badges, Edit prefill, Delete with confirm modal |
| **Skills** | Add form (name, category, level) → chips grouped by category with × removal and live count |
| **About** | Availability toggle, five basic fields, add/remove bio paragraphs, six social links (GitHub, LinkedIn, **Facebook, Instagram**, Twitter, Email), Save with success flash |
| **Blog** | List ⇄ editor, + New Post, tag chip picker, publish/unpublish, edit, delete with confirm, Published/Draft badges, date · read time · views |
| **Messages** | Unread dot and count, Mark read, Reply (mailto), Delete with confirm |

### 6.4 Chip pickers (projects → tech, blog → tags)

Each chip is two controls in one pill:
- **Label** — click to pick (fills orange, shows ✓), click again to unpick.
- **×** — removes the chip from the vocabulary entirely, and strips it from the current field.

Below each list: a "New tag name…" field and **+ ADD TAG** (or Enter) that adds the tag to the list permanently and selects it, so it becomes reusable as a default chip.

### 6.5 Project background images

- Paste a URL or **↑ Upload image** (read in-browser as a data URL).
- Live thumbnail preview, auto-fitted `cover`/centred — any aspect ratio fills the card.
- **Image visibility meter** — 10–100%, default 75%, with a live percentage readout; the preview dims with the slider.
- **Clear** removes the image.
- On save, `{ title: { src, opacity } }` is written to `localStorage['pg-project-bgs']`; the home page reads it and paints the matching card.

---

## 7. Cross-page systems

**Theme engine.** `readTheme()` → `applyTheme(theme)` → `localStorage['pg-theme']`. `applyTheme` sets `data-theme`, retints grain opacity, slides the toggle knob, and updates canvas colours. State is synced from storage on mount so the toggle label ("LIGHT MODE" / "DARK MODE") always names the mode you'd switch *to*.

**Canvas backgrounds.** Portfolio and blog use the galaxy field (nebula + stars + cursor web); admin uses a denser node lattice with brighter cursor strands. Canvas colour strings are literals, never `var()` — CSS custom properties are invalid in canvas paint calls.

**Grain.** Generated on a canvas at runtime and applied as a repeating background; opacity drops in light mode.

**Navigation.** `?nosplash=1` on every inbound link from blog and admin. Admin footer has Back to home page; blog footer has Back to portfolio.

---

## 8. GitHub sync

`github.md` records `repo`, `branch`, a `## Last sync` block (date, what changed) and a `## Screen map` tying each screen to the repo files it was built from, plus a `## Sync history`.

Latest sync (31 Jul 2026) confirmed `master` unchanged; project titles, descriptions, tech lists, URLs, all 26 skills, all 4 posts and the stats row match the seed.

**Two intentional local overrides**, both worth fixing upstream:
1. Bio says "Computer Science undergraduate at the University of Westminster" (seed says "Software Engineering Undergraduate").
2. Fourth project reads "Life Below Water" (seed has the typo "Life below warter").

---

## 9. Known limitations

- **Design only.** All admin edits live in component state; they reset on reload. The one exception is project background images, which persist via `localStorage` so the home page can read them. Everything is ready to be wired to the Express API.
- **Download CV** has no file behind it yet — drop in a PDF and the link can point at it.
- The hero portrait is an edge-faded PNG; a true background-removed cutout or a 3D avatar render would drop straight into the same slot.
- Card background images are user-supplied; no images ship with the concept.

---

## 10. Suggested next steps

1. Wire the admin panel to the real REST API (each panel maps 1:1 to an existing endpoint).
2. Add a **sprint timeline** section — the 8 sprints / 44 tickets story is the strongest differentiator against other student portfolios.
3. Turn project cards into full case-study pages: problem → architecture → what broke → what was learned.
4. Pull a live GitHub Actions badge and commit feed so the site proves it is alive.
5. Add `prefers-reduced-motion` fallbacks for the heavier animations.
