import { useState, useMemo } from 'react';
import {
  useAbout, useUpdateAbout,
  useUploadAvatar, useRemoveAvatar,
  useUploadHeroImage, useRemoveHeroImage,
  useUploadResume, useRemoveResume,
} from '../../../hooks/useAbout';
import { useAdminFlash } from '../../../hooks/useAdminFlash';
import { apiUrl } from '../../../services/api';
// ⚠️ Reused from blogMeta rather than re-implemented. `formatDate` is THE site's
// date format by the PF-104 locked decision ("card dates are full dates and the
// helper is formatDate"), and a second one-line formatter here is how one of
// them drifts. The module's name is about its origin, not a fence.
import { formatDate } from '../../../utils/blogMeta';
import { timezoneGroups } from '../../../utils/timezone';
import {
  BASIC_FIELDS, COPY_FIELDS, SOCIAL_FIELDS,
  aboutToForm, formToPayload, isAboutDirty, aboutFormErrors,
} from '../../../utils/aboutForm';
import { useFormGuard } from '../../../hooks/useFormGuard';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { useStagedFile } from '../../../hooks/useStagedFile';
import {
  imageSpec, formatBytes, messageFor, prepareFile, RESUME_SPEC, MAX_UPLOAD_MB,
} from '../../../utils/mediaFile';
import { DropZone } from '../DropZone';
import { badgeFor } from '../mediaBadge';
import { UploadPill } from '../UploadPill';
import { LoadError } from '../LoadError';
import a      from '../../../styles/admin.module.css';
import styles from './AdminAboutPanel.module.css';

// ── The two media specs ─────────────────────────────────────────────────────
// ⚠️ THESE MIRROR THE SERVER AND ARE NOT THE GATE. `utils/fileType.js` decides
// by MAGIC BYTES; everything here reads `file.name` and `file.type`, both of
// which the client chooses. A .jpg renamed .pdf passes every check below and is
// refused with a 415 on SAVE, which is correct and must stay that way.
//
// The point of checking at all is that type and size are the two things the
// browser genuinely knows, so the owner does not wait until SAVE to be told
// they picked the wrong file. The wording matches the server's own messages so
// the two never read as different systems disagreeing.
// RESUME_SPEC lives in utils/mediaFile.js since PF-113 batch 2 (4 MB, beside
// the reason it cannot be higher).

// Shared with the project background (PF-113) — same handler limit, same types.
const PORTRAIT_SPEC = imageSpec('Portrait');
const HERO_SPEC     = imageSpec('Hero image');

// ── The two image cards: one component, the words per slot ─────────────────
// The portrait (PF-112) and the hero cut-out (owner, 2026-10-14) stage, preview,
// badge and remove identically; only what they SAY differs. `noteLead` +
// `noteTail` wrap the shared "permanently deletes" warning.
const PORTRAIT_CARD = {
  id: 'about-portrait', title: 'Portrait', noun: 'portrait', upload: '↑ UPLOAD PORTRAIT',
  noteLead: 'Replaces the photograph in the About section. Uploading a new one',
  noteTail: 'the previous file. Any aspect ratio works — the section crops it to a 3:4 portrait.',
  fallback: 'The About section falls back to the bundled photograph',
};
const HERO_CARD = {
  id: 'about-hero-image', title: 'Hero image', noun: 'hero image', upload: '↑ UPLOAD HERO IMAGE',
  noteLead: 'Replaces the cut-out at the top of the home page. Uploading a new one',
  noteTail: 'the previous file. A transparent PNG cut-out works best — the hero fades its edges into the page.',
  fallback: 'The hero falls back to the bundled cut-out',
};

/**
 * The id namespace for every validatable input in this panel.
 *
 * ⚠️ Chosen to MATCH the ids these fields already had (`about-email`,
 * `about-social-github`), so wiring validation renamed nothing and broke no
 * existing `htmlFor`. `fieldId(FID, 'social.github')` flattens to exactly the
 * string that was hand-written here before.
 */
const FID = 'about';

/**
 * The inline message under a field.
 *
 * ⚠️ `role="alert"` so it is ANNOUNCED when it appears, not merely present.
 * The field also points at it with `aria-describedby`, which covers the other
 * direction: tabbing back to an already-marked field reads the reason.
 */
function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return (
    <p className={a.fieldError} id={errorId(FID, field)} role="alert">
      {message}
    </p>
  );
}



function ResumeCard({ stored, staged, onPick, onReject, onRemove, onUndo, error }) {
  const hasStored = Boolean(stored?.url);
  const badge = badgeFor(staged.file, hasStored);
  const stagedFile = staged.file instanceof File ? staged.file : null;
  const pendingRemove = staged.file === 'remove';

  const fileName = stagedFile ? stagedFile.name
    : pendingRemove || !hasStored ? 'No résumé uploaded yet'
    : stored.fileName || 'resume.pdf';

  const meta = stagedFile
    ? [formatBytes(stagedFile.size), staged.resizedFrom && `resized from ${formatBytes(staged.resizedFrom)}`, 'not saved yet']
        .filter(Boolean).join(' · ')
    : pendingRemove ? 'Will be deleted when you save'
    : hasStored
      ? [formatBytes(stored.bytes), stored.uploadedAt && `replaced ${formatDate(stored.uploadedAt)}`]
          .filter(Boolean).join(' · ')
      : 'Upload a PDF to activate the Download CV buttons';

  // The tile is tinted only for a file that is actually serving the public site
  // right now — a staged pick is not live yet, and a staged removal no longer is.
  const live = hasStored && !stagedFile && !pendingRemove;

  return (
    <section className={a.panel} aria-labelledby="about-resume-title">
      <div className={styles.cardHead}>
        {/* ⚠️ h2, not the prototype's h3. AdminLayout renders the panel name as
            the page's h1, and this panel deliberately does NOT repeat it as an
            h2 the way the other four still do — so the cards ARE the second
            level. An h3 here would skip one. Heading level is semantics; the
            look comes from the class either way. */}
        <h2 className={styles.cardTitle} id="about-resume-title">Résumé / CV</h2>
        <span className={a.spacer} />
        <span className={badge.cls}>{badge.text}</span>
      </div>

      <p className={styles.cardNote}>
        Uploading a new file <strong>replaces</strong> the current résumé everywhere — the hero
        and contact Download CV buttons both point at whatever is stored here. One file, one
        source of truth.
      </p>

      <DropZone onFile={onPick} onReject={onReject}>
      <div className={styles.mediaRow}>
        <span
          className={live ? `${styles.sheet} ${styles.sheetLive}` : styles.sheet}
          aria-hidden="true"
        >
          <span className={live ? `${styles.sheetExt} ${styles.sheetExtLive}` : styles.sheetExt}>
            {(stagedFile ? 'PDF' : stored?.ext || 'PDF').toUpperCase()}
          </span>
          <span className={styles.sheetFold} />
        </span>

        <div className={styles.mediaBody}>
          <span className={styles.mediaName}>{fileName}</span>
          <span className={styles.mediaMeta}>{meta}</span>
          <div className={styles.mediaActions}>
            <UploadPill
              id="about-resume-file"
              accept={RESUME_SPEC.accept}
              label={hasStored || stagedFile ? '↑ REPLACE FILE' : '↑ UPLOAD RÉSUMÉ'}
              onPick={onPick}
            />
            {/* The staged file previews from its own blob URL, so the owner can
                confirm they picked the right PDF BEFORE committing it. */}
            {stagedFile && (
              <a className={a.btnRow} href={staged.previewUrl} download={stagedFile.name}>
                ↓ PREVIEW
              </a>
            )}
            {!stagedFile && hasStored && !pendingRemove && (
              <a className={a.btnRow} href={apiUrl('/resume')} download>↓ PREVIEW</a>
            )}
            {(stagedFile || pendingRemove) && (
              <button type="button" className={a.btnRow} onClick={onUndo}>UNDO</button>
            )}
            {hasStored && !pendingRemove && !stagedFile && (
              <button type="button" className={a.btnRowDanger} onClick={onRemove}>REMOVE</button>
            )}
          </div>
        </div>
      </div>
      </DropZone>

      {/* PF-113 batch 2: a refused file is reported HERE, beside the button that
          picked it — it used to go to a banner at the top of the form, off-screen
          by the time you are down at this card. */}
      {error && <p className={a.fieldError} role="alert">{error}</p>}

      {/* ⚠️ PDF only, and the caption says so. The prototype offers
          `.pdf,.doc,.docx` and captions it that way, but "résumé is PDF only" is
          a locked decision and uploadResume 415s anything whose magic bytes are
          not %PDF-. Offering DOCX would promise a file the server refuses. */}
      <p className={styles.caption}>PDF ONLY · MAX {MAX_UPLOAD_MB} MB</p>
    </section>
  );
}

function ImageCard({ card, spec, stored, staged, onPick, onReject, onRemove, onUndo, error }) {
  const hasStored = Boolean(stored?.url);
  const badge = badgeFor(staged.file, hasStored);
  const stagedFile = staged.file instanceof File ? staged.file : null;
  const pendingRemove = staged.file === 'remove';

  const src = stagedFile ? staged.previewUrl : pendingRemove ? null : stored?.url || null;

  const fileName = stagedFile ? stagedFile.name
    : pendingRemove || !hasStored ? `No ${card.noun} uploaded yet`
    : stored.fileName || card.noun;

  const meta = stagedFile
    ? [formatBytes(stagedFile.size), staged.resizedFrom && `resized from ${formatBytes(staged.resizedFrom)}`, 'not saved yet']
        .filter(Boolean).join(' · ')
    : pendingRemove ? 'Will be deleted when you save'
    : hasStored
      ? [
          formatBytes(stored.bytes),
          stored.width && stored.height && `${stored.width} × ${stored.height}`,
          stored.uploadedAt && `replaced ${formatDate(stored.uploadedAt)}`,
        ].filter(Boolean).join(' · ')
      : card.fallback;

  return (
    <section className={a.panel} aria-labelledby={`${card.id}-title`}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id={`${card.id}-title`}>{card.title}</h2>
        <span className={a.spacer} />
        <span className={badge.cls}>{badge.text}</span>
      </div>

      <p className={styles.cardNote}>
        {card.noteLead}{' '}<strong>permanently deletes</strong> {card.noteTail}
      </p>

      <DropZone onFile={onPick} onReject={onReject}>
      <div className={styles.mediaRow}>
        {src
          ? <img className={styles.thumb} src={src} alt="" />
          : <span className={styles.thumbEmpty} aria-hidden="true">IMG</span>}

        <div className={styles.mediaBody}>
          <span className={styles.mediaName}>{fileName}</span>
          <span className={styles.mediaMeta}>{meta}</span>
          <div className={styles.mediaActions}>
            <UploadPill
              id={`${card.id}-file`}
              accept={spec.accept}
              label={hasStored || stagedFile ? '↑ REPLACE FILE' : card.upload}
              onPick={onPick}
            />
            {(stagedFile || pendingRemove) && (
              <button type="button" className={a.btnRow} onClick={onUndo}>UNDO</button>
            )}
            {hasStored && !pendingRemove && !stagedFile && (
              <button type="button" className={a.btnRowDanger} onClick={onRemove}>REMOVE</button>
            )}
          </div>
        </div>
      </div>
      </DropZone>

      {/* PF-113 batch 2: a refused file is reported HERE, beside the button that
          picked it — it used to go to a banner at the top of the form, off-screen
          by the time you are down at this card. */}
      {error && <p className={a.fieldError} role="alert">{error}</p>}

      <p className={styles.caption}>PNG, JPEG OR WEBP · MAX {MAX_UPLOAD_MB} MB · LARGER PHOTOS ARE RESIZED</p>
    </section>
  );
}

/**
 * PF-118 batch 2 — the Timezone dropdown. Every IANA place ICU knows, grouped by
 * region and labelled with today's offset ("Asia/Colombo — UTC+5:30"); a native
 * <select>, so typing a few letters jumps to them.
 *
 * ⚠️ A stored value that is NOT in the list (batch 1's free-text "UTC+5:30") is
 * shown as its own first option rather than silently swapped for the first
 * place — a save must never change a field the owner did not touch. The form
 * guard then asks for a real place (`aboutFormErrors`).
 *
 * Options are built once per mount: ~420 rows, and an offset only moves twice a
 * year.
 */
function TimezoneSelect({ value, onChange, ...field }) {
  const groups = useMemo(() => timezoneGroups(), []);
  const known = !value || groups.some((g) => g.options.some((o) => o.value === value));
  return (
    <select
      {...field}
      className={a.select}
      name="timezone"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">None — hide the timezone</option>
      {!known && <option value={value}>{value} (old value — pick a place)</option>}
      {groups.map(({ region, options }) => (
        <optgroup key={region} label={region}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function AdminAboutPanel() {
  const aboutQuery = useAbout();
  const { data: about, isLoading } = aboutQuery;
  const updateAbout  = useUpdateAbout();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const uploadHeroImage = useUploadHeroImage();
  const removeHeroImage = useRemoveHeroImage();
  const uploadResume = useUploadResume();
  const removeResume = useRemoveResume();
  const { showFlash } = useAdminFlash();

  // ── The form is DERIVED, not synced by an effect ──────────────────────────
  // This replaced a `useEffect` that called `setForm(...)` behind an
  // `eslint-disable react-hooks/set-state-in-effect`. Deriving during render
  // removes both the suppression and the wrong first frame the effect version
  // painted: it rendered once with empty fields, then again with the data.
  // `draft` is null until the first edit, so the fields follow the query until
  // the owner starts typing and stop following it afterwards.
  const [draft, setDraft] = useState(null);
  const form = draft ?? aboutToForm(about);

  /**
   * @param patch  the form fields to change
   * @param field  the error path this edit fixes, cleared as it is typed
   *
   * ⚠️ The error is cleared, NOT re-validated. Re-running the validator on
   * every keystroke marks a URL invalid halfway through typing it, which is
   * the behaviour everyone hates. The full check runs again on SAVE, which is
   * the moment it matters.
   */
  const edit = (patch, field) => {
    setDraft({ ...form, ...patch });
    if (field) guard.clearField(field);
  };

  const avatar = useStagedFile();
  const heroImage = useStagedFile();
  const resume = useStagedFile();

  // ── The validation guard (owner requirement, 2026-09-25) ─────────────────
  // Refuses an invalid save, shakes SAVE, and marks every offending field in
  // place. `FID` is the id namespace — every validatable input's id and its
  // error's `field` are both derived from it, so they cannot drift apart.
  const guard = useFormGuard(aboutFormErrors, FID);

  // One message PER CARD (PF-113 batch 2), shown inside that card.
  const [pickErrors, setPickErrors] = useState({});
  // True while a picked photo is being resized — SAVE waits for it, or a save
  // pressed mid-resize would go out without the image the owner just chose.
  const [preparing, setPreparing] = useState(false);
  const setPickError = (slot, message) => setPickErrors((prev) => ({ ...prev, [slot]: message }));
  const [saveErrors, setSaveErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const dirty = isAboutDirty(form, about)
    || Boolean(avatar.file) || Boolean(heroImage.file) || Boolean(resume.file);

  // ⚠️ A rejected pick does NOT clear what is already staged. The first version
  // called `staged.clear()` here, which threw away a good file the owner had
  // already chosen because they then mis-clicked on a second one — losing work
  // in the middle of reporting an error about it. Rejecting means "this file is
  // not accepted", not "start again".
  //
  // PF-113 batch 2: async, because a large photo is RESIZED here before it is
  // staged (prepareFile). Both the upload pill and a drag-and-drop call this.
  const pick = (slot, staged, spec) => async (file) => {
    setPreparing(true);
    try {
      const result = await prepareFile(file, spec);
      if (result.error) { setPickError(slot, result.error); return; }
      setPickError(slot, null);
      staged.stage(result.file, { resizedFrom: result.resizedFrom });
    } catch {
      // prepareFile rethrows only the UNEXPECTED (a canvas failure, not a bad
      // file). Without this it would be an unhandled rejection and silence.
      setPickError(slot, 'This file could not be prepared for upload — try another file.');
    } finally {
      setPreparing(false);
    }
  };

  // ── SAVE: sequential, and honest about partial failure ────────────────────
  // The profile PUT goes FIRST because it is the only one that cannot fail for
  // environmental reasons — a storage outage then still lets a text edit land.
  // Sequential rather than Promise.all so a 503 on the first upload does not
  // fire a second doomed request, and so the banner can name exactly which file
  // was refused.
  //
  // PF-118 batch 2: `save()` resolves `true` only when EVERY part landed, so the
  // unsaved-changes guard can save-then-leave — and stays put on a refusal or a
  // partial failure, where the banner is the thing the owner needs to see.
  const save = async () => {
    // ⚠️ FIRST, and it returns before anything is sent. The whole point of the
    // rule is that an invalid form produces no request at all — a save that
    // fires and then reports a 400 has already told the owner the wrong thing
    // about which system refused them.
    if (!guard.check(form)) return false;

    setPickErrors({});
    setSaveErrors([]);
    setSaving(true);

    const failures = [];
    let profileSaved = false;

    try {
      await updateAbout.mutateAsync(formToPayload(form));
      profileSaved = true;
    } catch (err) {
      failures.push(`Profile: ${messageFor(err)}`);
    }

    if (avatar.file) {
      try {
        if (avatar.file === 'remove') await removeAvatar.mutateAsync();
        else                          await uploadAvatar.mutateAsync(avatar.file);
        avatar.clear();
      } catch (err) {
        failures.push(`Portrait: ${messageFor(err)}`);
      }
    }

    if (heroImage.file) {
      try {
        if (heroImage.file === 'remove') await removeHeroImage.mutateAsync();
        else                             await uploadHeroImage.mutateAsync(heroImage.file);
        heroImage.clear();
      } catch (err) {
        failures.push(`Hero image: ${messageFor(err)}`);
      }
    }

    if (resume.file) {
      try {
        if (resume.file === 'remove') await removeResume.mutateAsync();
        else                          await uploadResume.mutateAsync(resume.file);
        resume.clear();
      } catch (err) {
        failures.push(`Résumé: ${messageFor(err)}`);
      }
    }

    setSaving(false);

    // Resetting `draft` hands the fields back to the query, so they show what
    // the server now holds. Only when the profile PUT actually succeeded —
    // otherwise it would silently discard the owner's unsaved typing.
    if (profileSaved) { setDraft(null); guard.reset(); }

    if (failures.length) {
      // ⚠️ NOT a "saved" flash. A partial failure that announces success is how
      // an operator comes to believe a file is live when it was refused. The
      // failed item stays staged so SAVE can simply be pressed again.
      setSaveErrors(profileSaved ? ['Profile details saved.', ...failures] : failures);
      return false;
    }

    showFlash('Profile saved');
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    save();
  };

  // PF-118 batch 2 — leaving this panel with unsaved edits asks first.
  useUnsavedChanges({ dirty, save, saveLabel: 'SAVE PROFILE', what: 'your profile' });

  if (isLoading) {
    return (
      <div className={a.stack} aria-busy="true">
        <div className={a.skelRow} />
        <div className={a.skelRow} />
        <div className={a.skelRow} />
      </div>
    );
  }

  // ⚠️ PF-117: NO FORM without a profile. `form` derives from `about`, so a
  // failed fetch used to render every field EMPTY with an empty "saved"
  // baseline — type one field, SAVE once the server is back, and every blank
  // field overwrites the real profile. `about === undefined` rather than
  // isError: a failed BACKGROUND refetch keeps the last good profile.
  if (about === undefined) {
    return <LoadError what="YOUR PROFILE" query={aboutQuery} />;
  }

  return (
    /* ⚠️ `noValidate` — the browser's own constraint UI is turned OFF on
       purpose. Without it a native `required` fires a bubble that pre-empts
       `onSubmit` entirely, so this panel's own validation would never run and
       its messages would be dead code. (That is exactly what has been
       happening in AdminBlogPanel.) The inputs keep their semantics; only the
       browser's bubble is suppressed. */
    <form className={a.stack} onSubmit={handleSubmit} noValidate>
      {/* ── Availability ──────────────────────────────────────────────────── */}
      <div className={styles.statusRow}>
        <span className={a.labelLead}>STATUS</span>
        <span className={form.availableForWork ? styles.statusOn : styles.statusOff}>
          <span className={styles.statusDot} aria-hidden="true" />
          {form.availableForWork ? 'Open to work' : 'Not available'}
        </span>
        <span className={a.spacer} />
        {/* ⚠️ No flash here. The prototype flashes "Marked as open to work"
            (Admin.dc.html:1158), which announces a save that has not happened —
            this toggle only stages the change now. */}
        <button
          type="button"
          className={a.btnOutline}
          onClick={() => edit({ availableForWork: !form.availableForWork })}
        >
          TOGGLE
        </button>
      </div>

      {/* ⚠️ The banner names the SCALE, never the detail — the detail is under
          each field, which is where it can be acted on. A banner that listed
          every message would duplicate all of them and leave two places to
          read, one of which does not say which input it means. */}
      {guard.errors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>
            CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
            {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
          </span>
        </div>
      )}

      {saveErrors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{saveErrors.join(' ')}</span>
        </div>
      )}

      {/* ── Basic info ────────────────────────────────────────────────────── */}
      <section className={a.panel} aria-labelledby="about-basic-title">
        <h2 className={a.panelTitle} id="about-basic-title">Basic info</h2>
        <div className={a.fieldGrid}>
          {BASIC_FIELDS.map(({ name, label, placeholder, kind }) => (
            <div key={name}>
              <label className={a.label} htmlFor={`about-${name}`}>{label}</label>
              {kind === 'timezone' ? (
                <TimezoneSelect
                  {...fieldProps(guard.errors, FID, name)}
                  value={form[name]}
                  onChange={(value) => edit({ [name]: value }, name)}
                />
              ) : (
                <input
                  {...fieldProps(guard.errors, FID, name)}
                  className={a.input}
                  name={name}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={(e) => edit({ [name]: e.target.value }, name)}
                />
              )}
              <FieldError field={name} guard={guard} />
            </div>
          ))}
        </div>
      </section>

      <ImageCard
        card={PORTRAIT_CARD}
        spec={PORTRAIT_SPEC}
        stored={about?.avatar}
        staged={avatar}
        onPick={pick('avatar', avatar, PORTRAIT_SPEC)}
        onReject={(message) => setPickError('avatar', message)}
        error={pickErrors.avatar}
        onRemove={() => avatar.stage('remove')}
        onUndo={() => { avatar.clear(); setPickError('avatar', null); }}
      />

      <ImageCard
        card={HERO_CARD}
        spec={HERO_SPEC}
        stored={about?.heroImage}
        staged={heroImage}
        onPick={pick('heroImage', heroImage, HERO_SPEC)}
        onReject={(message) => setPickError('heroImage', message)}
        error={pickErrors.heroImage}
        onRemove={() => heroImage.stage('remove')}
        onUndo={() => { heroImage.clear(); setPickError('heroImage', null); }}
      />

      {/* ── Bio paragraphs ────────────────────────────────────────────────── */}
      <section className={a.panel} aria-labelledby="about-bio-title">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="about-bio-title">Bio paragraphs</h2>
          <span className={a.spacer} />
          <button
            type="button"
            className={a.btnOutline}
            onClick={() => edit({ bio: [...form.bio, ''] })}
          >
            + ADD PARAGRAPH
          </button>
        </div>
        <div className={styles.bioList}>
          {form.bio.map((paragraph, i) => (
            <div className={styles.bioRow} key={i}>
              <span className={styles.bioNo}>{i + 1}.</span>
              <textarea
                className={styles.bioText}
                rows={3}
                aria-label={`Bio paragraph ${i + 1}`}
                placeholder="Paragraph text…"
                value={paragraph}
                onChange={(e) =>
                  edit({ bio: form.bio.map((p, idx) => (idx === i ? e.target.value : p)) })
                }
              />
              {form.bio.length > 1 && (
                <button
                  type="button"
                  className={a.btnIcon}
                  aria-label={`Remove paragraph ${i + 1}`}
                  onClick={() => edit({ bio: form.bio.filter((_, idx) => idx !== i) })}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Site copy (PF-118) ────────────────────────────────────────────
          The hero intro and the footer blurb were literals in their
          components. A blank one is allowed and falls back to that literal,
          the same rule as the availability note, so nothing here can leave a
          hole in the page. */}
      <section className={a.panel} aria-labelledby="about-copy-title">
        <h2 className={a.panelTitle} id="about-copy-title">Site copy</h2>
        <p className={styles.cardNote}>
          Leave a line empty to use the site&apos;s built-in wording.
        </p>
        <div className={a.stack}>
          {COPY_FIELDS.map(({ name, label, hint }) => (
            <div key={name}>
              <label className={a.label} htmlFor={`about-${name}`}>{label}</label>
              <textarea
                {...fieldProps(guard.errors, FID, name)}
                className={styles.copyText}
                rows={3}
                name={name}
                placeholder={hint}
                value={form[name]}
                onChange={(e) => edit({ [name]: e.target.value }, name)}
              />
              <FieldError field={name} guard={guard} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Stat cards ────────────────────────────────────────────────────
          The four numerals in the public About section. The MODEL has carried
          this field since Phase 1 and the panel could never edit it — and
          nothing on the site read it either, so it looked like a working
          feature from both ends while being wired to neither.

          ⚠️ Deliberately NOT the same component as "Other links" below, even
          though the row shape is identical. They differ in what a blank row
          MEANS (an unfinished link versus an unfinished stat), in their labels,
          and in the hint text — and the shared version would take the four
          strings as props, which is most of what is here. The same call PF-111
          made about the two upload handlers. */}
      <section className={a.panel} aria-labelledby="about-stats-title">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="about-stats-title">Stat cards</h2>
          <span className={a.spacer} />
          <button
            type="button"
            className={a.btnOutline}
            onClick={() => edit({ stats: [...form.stats, { label: '', value: '' }] })}
          >
            + ADD STAT
          </button>
        </div>

        <p className={styles.cardNote}>
          A value starting with a number <strong>counts up</strong> on the site
          (<code>5+</code>, <code>10+</code>); anything else is printed as a word
          (<code>Continuous</code>). Labels are shown in capitals.
        </p>

        {form.stats.length === 0 ? (
          <p className={a.emptyState}>
            No stat cards — the site falls back to its four built-in ones.
          </p>
        ) : (
          <div className={styles.extraList}>
            {form.stats.map((row, i) => (
              <div className={styles.extraRow} key={i}>
                <input
                  {...fieldProps(guard.errors, FID, `stats.${i}.label`)}
                  className={a.input}
                  aria-label={`Stat ${i + 1} label`}
                  placeholder="Projects Built"
                  value={row.label}
                  onChange={(e) => edit({
                    stats: form.stats.map(
                      (r, idx) => (idx === i ? { ...r, label: e.target.value } : r)
                    ),
                  }, `stats.${i}.label`)}
                />
                <input
                  {...fieldProps(guard.errors, FID, `stats.${i}.value`)}
                  className={a.inputMono}
                  aria-label={`Stat ${i + 1} value`}
                  placeholder="5+"
                  value={row.value}
                  onChange={(e) => edit({
                    stats: form.stats.map(
                      (r, idx) => (idx === i ? { ...r, value: e.target.value } : r)
                    ),
                  }, `stats.${i}.value`)}
                />
                {/* ⚠️ A NAMED control, never a bare `×`. This panel already has
                    five social clears, the custom-link removes and the bio
                    removes; a screen reader reading out eight buttons called
                    "×" cannot tell them apart, and neither can a test. */}
                <button
                  type="button"
                  className={a.btnIcon}
                  aria-label={row.label ? `Remove ${row.label} stat` : `Remove stat ${i + 1}`}
                  onClick={() => edit({
                    stats: form.stats.filter((_, idx) => idx !== i),
                  })}
                >
                  ×
                </button>

                <FieldError field={`stats.${i}.label`} guard={guard} />
                <FieldError field={`stats.${i}.value`} guard={guard} />
              </div>
            ))}
          </div>
        )}
      </section>

      <ResumeCard
        stored={about?.resume}
        staged={resume}
        onPick={pick('resume', resume, RESUME_SPEC)}
        onReject={(message) => setPickError('resume', message)}
        error={pickErrors.resume}
        onRemove={() => resume.stage('remove')}
        onUndo={() => { resume.clear(); setPickError('resume', null); }}
      />

      {/* ── Social links ──────────────────────────────────────────────────── */}
      <section className={a.panel} aria-labelledby="about-social-title">
        <h2 className={a.panelTitle} id="about-social-title">Social links</h2>
        {/* ⚠️ FIVE fixed fields. The prototype and DESIGN.md §6.3 both list a
            sixth for Email; About.social has no `email` key by a documented model
            decision, and the contact address is edited once under Basic info. */}
        <p className={styles.cardNote}>
          An empty link is <strong>hidden</strong> on the site rather than shown as a dead
          one — clearing a URL removes its icon from the footer.
        </p>

        <div className={a.fieldGrid}>
          {SOCIAL_FIELDS.map(({ name, label, placeholder }) => (
            <div key={name}>
              <label className={a.label} htmlFor={`about-social-${name}`}>{label}</label>
              <div className={styles.linkRow}>
                {/* ⚠️ AN EMPTY ONE IS NEVER AN ERROR — see aboutFormErrors.
                    These are schema keys with defaults, and clearing the value
                    is the only way to remove the icon from the footer. Twitter
                    ships blank on purpose. The custom rows below carry the
                    OPPOSITE rule, in the same card. */}
                <input
                  {...fieldProps(guard.errors, FID, `social.${name}`)}
                  className={a.inputMono}
                  name={name}
                  placeholder={placeholder}
                  value={form.social[name] || ''}
                  onChange={(e) => edit(
                    { social: { ...form.social, [name]: e.target.value } },
                    `social.${name}`,
                  )}
                />
                {/*
                  ⚠️ On a FIXED row this CLEARS the URL — it deletes nothing.
                  `github`…`twitter` are schema keys with defaults, so the key
                  cannot cease to exist; emptying the value is what makes the icon
                  disappear from the site, which is the actual goal. A custom
                  row's × below removes the whole row instead.

                  ⚠️ The accessible name says "Clear", not "×". With five of these
                  plus the custom rows plus the bio rows, a panel of controls all
                  named × is unusable with a screen reader and untestable — the
                  rule here is to assert NAMES, not counts.
                */}
                {form.social[name] ? (
                  <button
                    type="button"
                    className={a.btnIcon}
                    aria-label={`Clear ${label.replace(/ URL$/, '')} link`}
                    onClick={() => edit(
                      { social: { ...form.social, [name]: '' } },
                      `social.${name}`,
                    )}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <FieldError field={`social.${name}`} guard={guard} />
            </div>
          ))}
        </div>

        {/* ── Custom links ──────────────────────────────────────────────────
            Anything beyond the five fixed platforms. Rendered on the site with
            the generic link glyph, never a guessed brand mark. */}
        <div className={styles.extraBlock}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Other links</h3>
            <span className={a.spacer} />
            <button
              type="button"
              className={a.btnOutline}
              onClick={() => edit({ socialExtra: [...form.socialExtra, { label: '', url: '' }] })}
            >
              + ADD LINK
            </button>
          </div>

          {form.socialExtra.length === 0 ? (
            <p className={a.emptyState}>No other links yet.</p>
          ) : (
            <div className={styles.extraList}>
              {form.socialExtra.map((row, i) => (
                <div className={styles.extraRow} key={i}>
                  <input
                    {...fieldProps(guard.errors, FID, `socialExtra.${i}.label`)}
                    className={a.input}
                    aria-label={`Link ${i + 1} name`}
                    placeholder="YouTube"
                    value={row.label}
                    onChange={(e) => edit({
                      socialExtra: form.socialExtra.map(
                        (r, idx) => (idx === i ? { ...r, label: e.target.value } : r)
                      ),
                    }, `socialExtra.${i}.label`)}
                  />
                  <input
                    {...fieldProps(guard.errors, FID, `socialExtra.${i}.url`)}
                    className={a.inputMono}
                    aria-label={`Link ${i + 1} URL`}
                    placeholder="https://youtube.com/@you"
                    value={row.url}
                    onChange={(e) => edit({
                      socialExtra: form.socialExtra.map(
                        (r, idx) => (idx === i ? { ...r, url: e.target.value } : r)
                      ),
                    }, `socialExtra.${i}.url`)}
                  />
                  {/* On a CUSTOM row this really does delete — name and URL
                      together, because it is an array element rather than a fixed
                      key. Staged like everything else: REVERT brings it back,
                      SAVE makes it permanent. */}
                  <button
                    type="button"
                    className={a.btnIcon}
                    aria-label={row.label ? `Remove ${row.label} link` : `Remove link ${i + 1}`}
                    onClick={() => edit({
                      socialExtra: form.socialExtra.filter((_, idx) => idx !== i),
                    })}
                  >
                    ×
                  </button>

                  {/*
                    ⚠️ `.rowHint` USED TO BE HERE — a proactive nudge shown as
                    soon as one half was filled. It existed only because SAVE
                    went dim on an incomplete row, which read as the panel being
                    broken. SAVE is pressable now and refuses with a reason, so
                    the hint had two mechanisms saying the same thing in
                    different colours. Deleted, with its class.
                  */}
                  <FieldError field={`socialExtra.${i}.label`} guard={guard} />
                  <FieldError field={`socialExtra.${i}.url`} guard={guard} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className={styles.saveRow}>
        {/*
          ⚠️ Disabled until something has actually changed — owner decision
          2026-09-25. The dim look is `a.btnPrimary:disabled`'s existing
          `opacity: .72`, and the "glow" is the accent box-shadow the class
          already carries, so neither state needed a new colour.

          ⚠️ Consequence worth knowing: a clean form can no longer be re-saved.
          That is the point, but it INVERTS a test from part 1 which pressed SAVE
          on an untouched form to prove only the profile request fired.
        */}
        {/* ⚠️ `key` is what makes a SECOND refusal shake again. Re-adding a
            class React already rendered restarts nothing — the animation runs
            once and the element keeps it — so the button would visibly refuse
            the first press and sit still for every press after, which reads as
            the button having stopped working. Changing the key swaps the
            element's identity and the animation starts from 0%.

            ⚠️ `disabled` is still `!dirty`, NEVER `|| invalid`. A button that
            will not light up cannot explain why, and that is the exact
            confusion this whole mechanism replaces. */}
        <button
          key={guard.shakeKey}
          type="submit"
          className={`${a.btnPrimary} ${guard.shaking ? a.shake : ''}`}
          onAnimationEnd={guard.onShakeEnd}
          disabled={!dirty || saving || preparing}
        >
          {saving ? 'SAVING…' : 'SAVE PROFILE'}
        </button>

        {/*
          REVERT restores the last SAVED state — it does not empty the section.
          That distinction is the whole request: AdminProjectsPanel's old
          `cancelEdit` set the form to EMPTY, so mis-clicking it while editing
          lost the record's content out of the form (fixed in PF-113, which
          gave Projects this same REVERT).

          Dropping `draft` hands every field back to the query cache, and clearing
          every staged slot discards a picked portrait, hero image or résumé too — a revert
          that left a file staged would be a half-revert.
        */}
        {dirty && !saving && (
          <button
            type="button"
            className={a.btnOutline}
            onClick={() => {
              setDraft(null);
              avatar.clear();
              heroImage.clear();
              resume.clear();
              setPickErrors({});
              setSaveErrors([]);
              // REVERT restores the last SAVED state, so the marks from a
              // refused save go with it — they describe a form that no longer
              // exists.
              guard.reset();
            }}
          >
            REVERT CHANGES
          </button>
        )}
        {/* Staging makes a picked file discardable by a tab switch with no
            warning. A visible marker is the proportionate answer — deliberately
            not a navigation blocker or a beforeunload dialog. */}
        {dirty && !saving && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
      </div>
    </form>
  );
}
