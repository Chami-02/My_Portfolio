# Standing product requirements

Owner requirements that OUTLIVE the ticket implementing them. Moved verbatim
from CLAUDE.md on 2026-10-08 (headings demoted one level); CLAUDE.md keeps one
bullet per requirement. Read the full entry before changing behaviour in the
area it names.

### Standing product requirements

Requirements the owner has stated that **outlive the ticket implementing
them**. A ticket can satisfy one of these; nothing here expires when its
ticket closes. Read before changing behaviour in the area each names.

#### Contact messages are emailed to the owner

**Owner requirement, 2026-09-12. Built by PF-123 (Sprint 15) — NOT built yet.**

A submission through the public contact form must **both** persist to the
`Contact` collection **and** send a copy of the message to the owner's address
as a notification.

⚠️ **The email is a NOTIFICATION, not the system of record.** The admin
Messages panel is. Three consequences, and they are the whole shape of the
requirement:

- **A failed send must never fail the submission.** The message is already
  saved by the time the mail is attempted; returning an error would tell the
  visitor their message was lost when it was not.
- **A failed send must never be silent either.** `Contact.notifiedAt` records
  it, so "did that email actually go out" is answerable.
- **Never delete a message because it was emailed.** The panel remains the
  place messages live.

⚠️ **The backend has ZERO email capability today** — no dependency, no config,
no service, nothing in `backend/src` mentioning a provider. Do not assume a
mailer exists; PF-123 builds the first one, and PF-125 reuses it rather than
building a second.

#### The admin can change, reset and recover the password — proved twice

**Owner requirement, 2026-10-13 (raised in PF-120). Built in Sprint 15 by
REWRITTEN PF-123 / PF-124 / PF-125 — NOT built yet.**

- **Change (signed in):** current password **AND** a one-time code emailed to the
  address signed in with (`signedInAs`).
- **Forgot (signed out):** type either login address → the SAME 200 whether it
  exists or not → a one-time code to that address → a new password.
- **Every change signs out every other session** (`revokeAllForUser`).
- **One password for both addresses; the addresses stay fixed** (2026-10-12).
- **Mail: Gmail SMTP (app password) now**, behind `services/mailer.js`; **Resend
  once the custom domain exists** (its free tier only reaches the signup address
  until a domain is verified). One adapter, so the swap is one file + env.
- **Break-glass stays:** `npm run admin:password` (PF-120) works with no email.

#### Admin panels STAGE — the public site changes only on SAVE

**Owner requirement, 2026-09-25. Built for About by PF-112; binds every panel
after it.** Owner's words: *"when i upload a new resume then it will upload but
until i press the save changes it should [not] appear on the main page — that's
how usually happen in the admin portals isn't it?"*

**Nothing in an admin panel reaches the public site until SAVE is pressed.**
Three consequences, each worked out in PF-112 and each non-obvious:

- **REMOVE must stage too.** A REMOVE that fires its `DELETE` immediately makes
  the file vanish from the live site *before* SAVE, breaking the same rule the
  upload deferral exists to keep. Stage `'remove'`; delete on SAVE.
- **A toggle that drives the public site must stage.** `availableForWork` moved
  onto `PUT /api/about` for this reason, which left `useToggleAvailability` dead
  (deleted; the backend PATCH route stays, clientless).
- **Deferring costs error feedback, and it is paid back client-side.** Type and
  size are readable from the `File`, so a wrong pick is refused instantly with
  the server's own wording. ⚠️ **That check is a COURTESY, never a gate** — a
  `.jpg` renamed `.pdf` passes every browser test and is refused by the
  magic-byte check in `utils/fileType.js`, which is the real control.

⚠️ **This SUPERSEDES PF-111 §3.4**, which deferred only the portrait and left
the résumé uploading on pick. **PF-113 → PF-115 inherit it.**

#### Admin panels STAGE, and SAVE is dim until there is something to save

**Owner requirement, 2026-09-25 (extends the staging rule above). Built for About
by PF-112; binds every panel after it.**

- **SAVE is disabled until the form is dirty**, and carries its normal accent glow
  once it is. Costs no new colour: `admin.module.css`'s `.btnPrimary:disabled`
  already dims, and `.btnPrimary` already glows.
- **A REVERT control appears beside it while dirty**, and it **restores the last
  SAVED state — it never empties the section.** ⚠️ That distinction is the whole
  requirement. The old Projects `cancelEdit` set the form to `EMPTY`, so a
  mis-click mid-edit lost the record's content — **fixed by PF-113**, which gave
  Projects this REVERT and made CANCEL EDIT merely leave edit mode.
- **Reverting must discard staged FILES too.** A revert that restores the text and
  leaves a picked portrait staged is a half-revert, and the tell is nasty: the
  fields look restored, then SAVE uploads a file the owner thought they discarded.
- Keep the `UNSAVED CHANGES` marker. ~~Deliberately a marker, **not** a navigation
  blocker or a `beforeunload` dialog.~~ **REVERSED 2026-10-12 (PF-118 batch 2)** —
  owner asked for the guard below; the marker stays as well.

#### Admin panels REFUSE an invalid save — shake, count, and mark the field

**Owner requirement, 2026-09-25. Built for About and Blog; binds every panel
after it.** Owner's words: *"when i add a stat it must reqired a value.
otherwise cant save the change… when miss something if i try to save the save
button should shake and say check the changes again and pop up the text feild
or somthing around the missing field saying fill the missing values… this is a
common rule for all other sections as well in admin panel."*

**Four parts, and all four are required for the behaviour to make sense:**

1. **SAVE stays PRESSABLE while the form is dirty** — never disabled *because*
   something is invalid. ⚠️ This does NOT reopen "SAVE is dim until dirty";
   dirty still gates it, validity does not. A button that will not light up
   cannot explain why, and that is the confusion this replaces.
2. **An invalid save is refused and NO REQUEST IS SENT.** A save that fires and
   then reports a 400 has already told the owner the wrong thing about which
   system refused them.
3. **A banner names the SCALE, never the detail** — `CHECK THE CHANGES AGAIN —
   N fields need attention.` Listing every message duplicates all of them and
   leaves two places to read, one of which cannot say which input it means.
4. **Every offending field is marked in place**, and the FIRST one is focused
   and scrolled to centre.

**The shared layer — compose from it, do not reinvent it:**

- `utils/formErrors.js` — an error is `{ field, message }` where `field` is a
  PATH (`'email'`, `'stats.0.value'`, `'sections.2.heading'`). Plus
  `fieldProps()`, `fieldId()`, `isUsableUrl()`, `isUsableEmail()`.
- `hooks/useFormGuard.js` — `check()` / `clearField()` / `shaking` / `shakeKey`.
- `admin.module.css` — `.fieldError`, `.shake`, and
  `.input[aria-invalid='true']`.

⚠️ **The invalid state keys on `aria-invalid`, NOT a class.** With a class the
red border and the screen-reader state are two things to remember and the ARIA
half is the one that gets forgotten. One attribute means what LOOKS wrong is
guaranteed to ANNOUNCE wrong.

⚠️ **A field's `id` is DERIVED from the error's path**, never typed twice. Two
independently written strings for one identity drift, and when they do the
error renders nowhere at all while every test that checks "an error was
reported" still passes.

⚠️ **`noValidate` ON THE FORM IS MANDATORY.** A native `required` fires the
browser's own bubble, which pre-empts `onSubmit` entirely so the panel's
validation never runs. That is not hypothetical: `blogForm.js`'s `'Title is
required.'` and `'Excerpt is required.'` branches had NEVER executed since they
were written, while `blogForm.test.js` passed throughout because a unit test
calls the validator directly. Keep `required` for its semantics; suppress only
the bubble.

⚠️ **Clear a mark, never re-validate, on keystroke** — per field. Re-running
the validator as someone types marks a URL invalid halfway through writing it,
and clearing the whole list wipes marks off fields that are still wrong while
the banner's count disagrees with the screen.

⚠️ **SERVER failures are a SEPARATE CHANNEL.** A rejected request or a dead
backend has no field to mark. Routing one through the guard prints "Cannot
reach the server" under a text input and counts it as a field needing
attention. `utils/loginError.js` exists because this repo once collapsed
exactly these two categories.

⚠️ **The panel's check is a COURTESY, never the gate** — the same rule PF-112
recorded for uploads. Every client rule mirrors one the server already
enforces.

**Applied to About, Blog, Projects (PF-113) and Skills (PF-114).** Messages has
no form, so there is nothing for it to apply to (PF-115).

#### New records SAVE AS DRAFT; existing records REVERT

**Owner requirement, 2026-10-03. Built for Projects by PF-113 and Blog by PF-115;
binds every panel after it.** Owner's words: *"when i create a new project or a
new blog post suddenly i have to close it and go, there should be an option
called save as a draft… when i am editing an existing project or a blog or
whatever existing, even a word in a section, there is an option called revert
changes like the about section."*

- **Creating** → `SAVE AS DRAFT` beside the publish button. A draft needs **only
  a title**, is **invisible on the public site**, and publishing it later
  requires everything (shake + mark as usual).
- **Editing** → `REVERT CHANGES` restores the last SAVED state, never blank.
- ✅ **Blog half BUILT by PF-115.** ⚠️ Blog's draft rules live in the MODEL
  (`published === true` gates excerpt, section rules and "needs a body"),
  because `togglePublish` never runs `blogRules` — a rule only in a route's
  validators would have let a list-row PUBLISH put an empty draft live.

#### A blank FIXED field may be empty; a row you ADDED may not

**Owner clarification, 2026-09-25.** Owner's words: *"social links tab there is
twitter Url and its empty its ok. but when add link press the button we need to
fill it out before hit the save button if not it will shake the save button and
giving error. it is the only thing with a empty block so thats fine."*

Two cases that sit side by side in the same card, look identical — an empty
text input — and are **opposite**:

- **A fixed schema key may be blank.** `social.github`…`social.twitter` have
  defaults; the key cannot cease to exist, and clearing the value is the ONLY
  way to hide the icon — the rule `About.js` has stated since PF-60. Twitter
  ships blank on purpose. **Never an error, in any state.**
- **A row created with `+ ADD LINK` / `+ ADD STAT` must be complete before
  SAVE.** It exists only because the owner made it, and its `×` is how that is
  undone. Blank or half-filled, it is unfinished work rather than a blank
  value.

⚠️ **Pin both halves in one test.** The only thing separating them is which
control produced the field, so a guard on the error case alone passes against
an implementation that also refuses a blank Twitter — and that implementation
makes `socialEntries()`'s "an empty URL renders nothing" rule unreachable from
the panel.

⚠️ **Consequence: adding a row must make the form DIRTY.** `formToPayload`
drops incomplete rows, so a payload-based dirty check could not see an added
row at all — SAVE stayed dim, nothing could be reported, and the row vanished
on the next render from cache. That was the owner's original report.

#### A blank social URL renders NOTHING — never a dead link

**Stated in `backend/src/models/About.js` since PF-60, unimplemented until
PF-112.** The model's own words, on the deliberately-empty twitter field: *"Fill
it in from the admin panel if one is created — the public site must treat an empty
value as 'hide this icon', not render a dead link."*

`utils/social.js`'s `socialEntries(about)` is the one place that decides which
rows exist; `components/icons/socialIcons.js` decides how they look.
⚠️ **`iconFor` FALLS BACK to a generic link glyph rather than returning
undefined** — React does not reliably throw for `<undefined />`, so an unmapped
key would render a label with no mark and no error.

⚠️ **The FOOTER is the complete list; CONTACT is deliberately GitHub + LinkedIn
only** (the prototype's own choice, reaffirmed by the owner 2026-09-25). Do not
"unify" the two rows — a test pins that Contact renders no custom links.

#### The owner's address is `pcgallege@gmail.com`

**Owner decision, 2026-09-12.** Changed from the owner's personal address,
which receives too much other mail for a portfolio enquiry to be noticed in.
This is both the public contact address and the admin login account. **Done in
PF-119 (which absorbed PF-122), 2026-10-12 — see the next section for the
second admin login address.**

#### One public address; two admin login addresses (PF-119)

**Owner requirement, 2026-10-12. Built.** Everything the website shows or sends
— Contact, About, footer, customer mail — uses **`pcgallege@gmail.com` only**.
The admin signs in with **`pcgallege@gmail.com` OR `parindrachameekara@gmail.com`**,
by **Google OR email + password**, and both are the full admin (one account,
one password). The old demo address is removed from the project for good.
`parindrachameekara@gmail.com` is the owner's account on the services (Atlas,
Vercel, Cloudinary, GitHub) — never a site address.

#### A panel that could not load says so — never "nothing here", never a form

**Owner requirement, 2026-10-11 (PF-117). Built.**

When a panel's data fails to load it shows `LoadError` (`components/admin/
LoadError.jsx`) — `COULDN'T LOAD YOUR <THING>` + RETRY:

- **Never the empty state.** "No projects yet" with a count of 0 tells the owner
  their content is gone. No count is shown until there is something to count.
- **Never a form over missing data.** About renders NO fields without a profile:
  an empty editable form has an empty saved baseline, and SAVE would write the
  blanks over the real profile. A list panel keeps its ADD form.
- **A RETRY that fails again says so** — `STILL CAN'T REACH THE SERVER — TRY
  AGAIN IN A MINUTE.` — and shows `RETRYING…` while in flight.
- **On a phone, RETRY sits on its own line** under the message.
- Only when the data is MISSING (`isError && data === undefined`): a failed
  background refetch keeps the last good data on screen.

Every new admin panel must handle this branch before its empty branch.

#### Leaving unsaved admin work asks first — every exit

**Owner requirement, 2026-10-12 (PF-118 batch 2). Built.** Owner's words: *"when i
editing something or creating something in a panel… mistakenly i press another
section… not saving the existing work… mention as a alert… edit this or save as
draft or complete this before go anywhere."* **Reverses the 2026-09-25 "a marker,
not a blocker" rule above.**

- **Every exit asks while a panel is dirty:** sidebar / phone strip, a panel's own
  record switches (EDIT another, + NEW, CANCEL EDIT, BACK TO LIST, CANCEL), ↗ HOME,
  ← BACK TO HOME PAGE, both SIGN OUTs, browser Back/Forward (in-app history), and
  reload / close tab / typed URL (the browser's own prompt — wording not ours).
- **The dialog:** KEEP EDITING (focused; also Escape and backdrop) · SAVE · DISCARD &
  LEAVE (red). SAVE is the panel's REAL save: refused (invalid) or failed → you STAY
  and see why; only a save that fully landed continues.
- **SAVE never publishes:** a NEW record saves as a DRAFT (`SAVE AS DRAFT`); an
  existing one keeps its state (`SAVE CHANGES` live, `SAVE DRAFT` draft). About:
  `SAVE PROFILE`. Skills with a new skill AND an unsaved order: Keep / Discard only.
- Nothing typed → no question, ever (re-clicking the current panel never asks).
- SIGN OUT asks BEFORE the server call — after it, saving is impossible.
- A new admin panel with a form must register through `useUnsavedChanges`.

#### One panel field drives EVERY place the site shows it

**Owner requirement, 2026-10-12 (PF-118). Built for About.** Owner's words: *"when i
change the time zone in contact section it should change in footer status panel time
zone."*

- A value the site prints in several places is ONE field read by every render site —
  never a second literal, never a second field. Today: `timezone` (Contact + footer
  status), `location` (Contact, footer, `/blog` byline), `availableForWork` (hero
  badge, About line, footer row, footer band, Contact intro), `availabilityNote`
  (About line, Contact intro).
- Wiring a new field means finding ALL its render sites first (grep the literal),
  and a test per site.
- Blank text copy falls back to the component's literal; a blank *label-like* value
  (timezone, a social URL) is hidden, separator included.
- **A value with a fixed set of valid answers is CHOSEN, never typed** (owner,
  2026-10-12: "otherwise mistakes can happen… typos"). Timezone is a dropdown of IANA
  places; the server refuses anything else.

---

