// frontend/src/components/sections/ContactSection.jsx
import { useEffect, useState } from 'react';
import { Reveal } from '../motion';
import { MailIcon, GitHubIcon, LinkedInIcon } from '../icons';
import { useAbout } from '../../hooks/useAbout';
import { contactService } from '../../services/contactService';
import { cvAnchorProps } from '../../utils/resume';
import styles from './ContactSection.module.css';

/*
 * ── The DOWNLOAD CV constants MOVED to utils/resume.js in PF-112 ────────────
 *
 * They lived here from PF-87, when this was the only wired `[data-cv]` element
 * of the prototype's two. PF-112 wires the hero's as well, so there is a second
 * consumer and the same bar applies that moved formatMonth into blogMeta.js:
 * one consumer is a local constant, two is a module.
 *
 * The reasoning that used to sit here — that `href="#contact" download` is the
 * PROTOTYPE'S OWN empty state rather than a dead anchor, because
 * `applyResume()` rewrites both branches at runtime — moved with them, because
 * that is the note whoever next reads `cvAnchorProps` needs.
 */

/*
 * ── PF-112: EMAIL, GITHUB_URL and LINKEDIN_URL are gone ─────────────────────
 *
 * All three were module consts, so editing them in the admin panel changed
 * nothing here. They come from the About document now. The fallback below covers
 * only the first paint before the query resolves — it is not a second source of
 * truth, and it is deliberately the SAME string the const held, so a failed
 * fetch degrades to what the page has always shown rather than to a blank.
 *
 * ⚠️ Named OWNER_EMAIL_FALLBACK, not EMAIL. `validate({ email })` below means the
 * VISITOR's address, and two things called `email` a few lines apart is exactly
 * the sort of collision that gets one of them wired to the wrong place.
 */
const OWNER_EMAIL_FALLBACK = 'parindrachameekara@gmail.com';

const EMPTY_FORM = { name: '', email: '', message: '' };

/**
 * The prototype's own validation, transcribed rather than rewritten —
 * both the checks and the copy (lines 1138-1139).
 *
 * The email pattern is deliberately loose. `type="email"` is NOT used
 * (see the input below), so this is the only client-side shape check,
 * and it is the prototype's: something, an @, something, a dot,
 * something. Anything stricter starts rejecting addresses that work.
 *
 * ⚠️ It is not the whole contract. The backend additionally requires a
 * message of at least 10 characters and caps name/message length
 * (contactController.js's `contactRules`). A 5-character message passes
 * here and comes back 400 with the server's own sentence, which is what
 * the catch below surfaces. Duplicating the server's rules here would be
 * a second source of truth that drifts silently; letting the server
 * answer keeps one.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ name, email, message }) {
  if (!name.trim() || !email.trim() || !message.trim()) {
    return 'All three fields are required.';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'That email address looks off.';
  }
  return '';
}

/**
 * Contact — PF-87. Full replacement of the Phase 1 component,
 * transcribed from `docs/design/Portfolio Revolution.dc.html` lines
 * 489-541.
 *
 * The last section of the main page rebuild, and the last one that was
 * still Phase 1. Three things that had been waiting on it land here: the
 * `scroll-margin-top` fix (see the module's own note — `#contact` has
 * been landing 9px low since PF-80), the résumé subsystem's first
 * frontend caller, and the form focus styling PF-83 left alone so this
 * ticket could transcribe the prototype's own treatment.
 *
 * Posts through the existing `contactService.submit` — there is no second
 * service and no new hook. The submission is a one-off command rather
 * than cached server state, so it stays a plain async call with local
 * state, exactly as Phase 1 had it; TanStack Query is for the reads.
 */
export function ContactSection() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSent, setFormSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Read only for `hasResume` — a schema virtual (models/About.js:148)
  // that exists so "a résumé exists if and only if it has a url" is one
  // rule rather than one per consumer. `useAbout()` is the existing hook,
  // already used by AdminAboutPanel, so this adds no new query key and
  // TanStack Query caches it for the page.
  //
  // Note this does NOT re-wire About's copy to the API — PF-81 took that
  // off deliberately and re-wiring it is still its own ticket. This is
  // one boolean, for one link.
  const { data: about, isError: aboutFailed, error: aboutError } = useAbout();

  // Fail closed: a failed or in-flight About fetch renders the inert CV
  // link rather than one pointing at a download that may not exist. Also
  // the prototype's own error path — its try/catch around the
  // localStorage read falls through to `r = null`, i.e. the empty state.
  const hasResume = Boolean(about?.hasResume);
  // PF-112 — the owner's data, with the long-standing literal as a first-paint
  // fallback. ⚠️ An empty social URL renders NOTHING rather than a dead link —
  // the rule About.js has stated since PF-60.
  const contactEmail = about?.email || OWNER_EMAIL_FALLBACK;
  const location     = about?.location || 'Galle, Sri Lanka';
  const github       = about?.social?.github?.trim() || '';
  const linkedin     = about?.social?.linkedin?.trim() || '';

  // Logged from an effect keyed on the error, not from the render body: a
  // render-phase console.error fires again on every unrelated re-render.
  //
  // ⚠️ Both `isError` and `error` are destructured, and the pair matters.
  // Logging the boolean prints "ContactSection: useAbout() failed true",
  // which names the symptom and drops the cause — caught in PF-87's E2E
  // run, where that exact line appeared and said nothing about why.
  useEffect(() => {
    if (aboutFailed) console.error('ContactSection: useAbout() failed', aboutError);
  }, [aboutFailed, aboutError]);

  // Transcribed from the prototype's `onField` (line 1130): typing clears
  // BOTH status messages, so a stale error or a stale "sent" never sits
  // above a form the visitor has started editing again.
  const onField = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError('');
    setFormSent(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // Guard against a double submit that beats the disabled attribute —
    // a second Enter keypress in the same tick, or a synthetic event.
    if (sending) return;

    const message = validate(form);
    if (message) {
      setFormError(message);
      setFormSent(false);
      return;
    }

    setSending(true);
    setFormError('');
    setFormSent(false);

    try {
      await contactService.submit(form);
      setFormSent(true);
      // Cleared on success ONLY. On failure the visitor's typed message
      // survives, so a network blip does not cost them the thing they
      // came here to write. No design source — the prototype's submit
      // cannot fail, because it is a 900ms setTimeout.
      setForm(EMPTY_FORM);
    } catch (err) {
      // The server's own sentence when there is one: it carries the rules
      // the client does not duplicate (message length, field caps). The
      // fallback covers the no-response case — a backend that is down
      // produces no `err.response` at all, and `loginError.js` exists
      // because that case once rendered as a credential rejection.
      setFormError(
        err.response?.data?.message ||
        'Could not send that — check your connection and try again.'
      );
    } finally {
      setSending(false);
    }
  };

  // The prototype's own three labels (line 1129).
  const submitLabel = sending ? 'SENDING…' : formSent ? 'SENT ✓' : 'SEND MESSAGE';

  return (
    <section id="contact" className={styles.contact}>
      <div className={styles.inner}>
        <Reveal type="up" className={styles.eyebrow}>
          <span className={styles.eyebrowLabel}>05 / CONTACT</span>
          <span aria-hidden="true" className={styles.eyebrowLine} />
        </Reveal>

        <Reveal as="h2" type="up" delay={60} className={styles.heading}>
          Let&apos;s build <span className={styles.outlined}>something loud!</span>
        </Reveal>

        <div className={styles.grid}>
          <div>
            <Reveal as="p" type="up" delay={120} className={styles.intro}>
              I&apos;m actively looking for junior developer and Software Engineering
              internship opportunities. If you have a role, a project, or just want to
              connect — send me a message. I respond within 24 hours.
            </Reveal>

            <Reveal type="up" delay={180} className={styles.ctaRow}>
              {/* Icons added 2026-08-29 at the owner's request; the
                  prototype labels all three of these links with bare
                  text. `.emailLink` and `.cvLink` were already
                  inline-flex rows with a 10px gap, so only `.socialLink`
                  needed a CSS change. */}
              <a href={`mailto:${contactEmail}`} className={styles.emailLink}>
                <MailIcon />
                {contactEmail}
              </a>
            </Reveal>

            <Reveal type="up" delay={200} className={styles.ctaRow}>
              {/* Both branches of the prototype's `applyResume()`, as
                  markup rather than as a post-render attribute sweep.
                  `download` is a boolean attribute, so React omits it
                  entirely when false — which is what the empty branch
                  needs, since a `download` on an inert `#contact` href
                  would try to download the page itself. */}
              <a {...cvAnchorProps(hasResume)} className={styles.cvLink}>
                ↓ DOWNLOAD CV
              </a>
            </Reveal>

            <Reveal type="up" delay={220} className={styles.socialRow}>
              {/* ⚠️ Contact stays GITHUB + LINKEDIN only — owner decision
                  2026-09-25, and the prototype's own choice (lines 508-512). The
                  FOOTER is the complete list; this row is deliberately the short
                  one. Each link disappears entirely when its URL is blank. */}
              {github && (
                <a
                  href={github}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.socialLink}
                >
                  <GitHubIcon />
                  GITHUB
                </a>
              )}
              {linkedin && (
                <a
                  href={linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.socialLink}
                >
                  <LinkedInIcon />
                  LINKEDIN
                </a>
              )}
            </Reveal>

            {/* Same delay as the social row above — 220 twice, the
                prototype's own choice (lines 508 and 512), so the two
                arrive together rather than in sequence. Not a slip. */}
            <Reveal as="p" type="up" delay={220} className={styles.location}>
              {/* Uppercased HERE rather than stored uppercase, so the admin panel
                  shows the location the way it reads and the footer can print the
                  same value in title case. ⚠️ The UTC offset stays a literal — a
                  timezone, not part of the location field. */}
              {location.toUpperCase()} · UTC+5:30
            </Reveal>
          </div>

          <Reveal
            as="form"
            type="up"
            delay={160}
            className={styles.form}
            onSubmit={onSubmit}
            noValidate
          >
            <div className={styles.nameEmailRow}>
              {/* The prototype wraps each input in its <label>, which is
                  an implicit association — no htmlFor/id pair needed, and
                  it keeps working if two forms ever share a page. */}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>NAME</span>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  placeholder="Parindra Gallage"
                  onChange={onField}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>EMAIL</span>
                {/* ⚠️ `type="text" inputmode="email"`, not `type="email"`
                    — the prototype's own choice, and it changes behaviour
                    rather than just semantics. `type="email"` triggers
                    native browser validation, whose bubble is
                    browser-styled and has no treatment anywhere in this
                    design. `inputmode` still gets the right mobile
                    keyboard. Validated in JS instead, with the
                    prototype's own pattern and copy. `noValidate` on the
                    form above keeps the two consistent if a `type` ever
                    changes. */}
                <input
                  name="email"
                  type="text"
                  inputMode="email"
                  value={form.email}
                  placeholder="you@company.com"
                  onChange={onField}
                  className={styles.input}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>MESSAGE</span>
              <textarea
                name="message"
                rows={4}
                value={form.message}
                placeholder="Tell me about the role, project, or just say hi…"
                onChange={onField}
                className={styles.textarea}
              />
            </label>

            {/* Live regions, which the prototype has no equivalent of.
                Invisible to a sighted visitor — no layout, no colour, no
                timing change — so this is an implementation choice under
                CLAUDE.md's test rather than a design change. Without
                them a screen-reader user submits the form and hears
                nothing at all, because neither paragraph takes focus.
                `alert` is assertive for the failure, `status` polite for
                the success. */}
            {formError && (
              <p role="alert" className={styles.errorText}>{formError}</p>
            )}
            {formSent && (
              <p role="status" className={styles.sentText}>
                ✓ Message sent — I&apos;ll reply within 24 hours.
              </p>
            )}

            <button type="submit" disabled={sending} className={styles.submit}>
              {submitLabel}
            </button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
