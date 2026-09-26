import { useState, useRef, useEffect } from 'react';
import {
  useAbout, useUpdateAbout,
  useUploadAvatar, useRemoveAvatar,
  useUploadResume, useRemoveResume,
} from '../../../hooks/useAbout';
import { useAdminFlash } from '../../../hooks/useAdminFlash';
import { apiUrl } from '../../../services/api';
// ⚠️ Reused from blogMeta rather than re-implemented. `formatDate` is THE site's
// date format by the PF-104 locked decision ("card dates are full dates and the
// helper is formatDate"), and a second one-line formatter here is how one of
// them drifts. The module's name is about its origin, not a fence.
import { formatDate } from '../../../utils/blogMeta';
import {
  BASIC_FIELDS, SOCIAL_FIELDS,
  aboutToForm, formToPayload, isAboutDirty, aboutFormErrors,
} from '../../../utils/aboutForm';
import { useFormGuard } from '../../../hooks/useFormGuard';
import { fieldProps, errorId } from '../../../utils/formErrors';
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
const RESUME_SPEC = {
  label:    'Résumé',
  accept:   '.pdf',
  maxBytes: 5 * 1024 * 1024,                       // MAX_RESUME_BYTES
  looksRight: (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  typeMessage: 'Résumé must be a PDF.',
};

const PORTRAIT_SPEC = {
  label:    'Portrait',
  accept:   '.png,.jpg,.jpeg,.webp',
  maxBytes: 2 * 1024 * 1024,                       // MAX_IMAGE_BYTES — NOT 5 MB
  looksRight: (f) =>
    ['image/png', 'image/jpeg', 'image/webp'].includes(f.type) ||
    /\.(png|jpe?g|webp)$/i.test(f.name),
  typeMessage: 'Portrait must be a PNG, JPEG or WEBP image.',
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

const formatBytes = (bytes) =>
  !bytes ? ''
    : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const rejectReason = (file, spec) => {
  if (!spec.looksRight(file)) return spec.typeMessage;
  if (file.size > spec.maxBytes) {
    return `${spec.label} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ` +
           `${spec.maxBytes / 1024 / 1024} MB.`;
  }
  return null;
};

/**
 * Turn a failed mutation into something an operator can act on.
 *
 * The server already separates 415 / 413 / 503 with distinct messages
 * (aboutController.js), so its own text is used verbatim — three statuses, three
 * sentences, not one catch-all. The 503 gets an addition because its message
 * describes the server's state without saying that the operator is not the
 * person who can fix it.
 *
 * ⚠️ The `!err.response` branch is the one that would otherwise collapse into
 * the others — a dead backend and a rejected file are different problems, and
 * `utils/loginError.js` exists because that exact conflation shipped once.
 */
const messageFor = (err) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;
  if (!err?.response) return 'the server could not be reached — check your connection and try again.';
  if (status === 503) {
    return `${message || 'file storage is unavailable.'} Nothing can be done from this panel — ` +
           'the storage keys are missing on the server.';
  }
  return message || 'the request was rejected.';
};

const badgeFor = (pending, stored) => {
  if (pending instanceof File)  return { text: 'PENDING SAVE',   cls: a.badge };
  if (pending === 'remove')     return { text: 'REMOVE ON SAVE', cls: a.badge };
  if (stored)                   return { text: 'LIVE',           cls: a.badgeOk };
  return { text: 'MISSING', cls: a.badgeMuted };
};

/**
 * Hold one picked file, with its object-URL preview.
 *
 * ⚠️ The URL is created in the EVENT HANDLER, not in an effect. An effect that
 * called `setState` with the new URL would trip
 * `react-hooks/set-state-in-effect` — the rule CI runs at --max-warnings=0 —
 * and would also paint one frame without the preview. The only effect here is
 * the unmount revoke, which reads a ref so it needs no dependencies and never
 * re-runs.
 *
 * Two consumers in this file (portrait, résumé) is what justifies it being a
 * function rather than duplicated inline; it deliberately does NOT know which
 * route it belongs to, so there is no way for one card's arguments to reach the
 * other's request.
 */
function useStagedFile() {
  const [file, setFile] = useState(null);           // File | 'remove' | null
  const [previewUrl, setPreviewUrl] = useState(null);
  const urlRef = useRef(null);

  const stage = (next) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next instanceof File ? URL.createObjectURL(next) : null;
    setPreviewUrl(urlRef.current);
    setFile(next);
  };

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return { file, previewUrl, stage, clear: () => stage(null) };
}

/** The accent upload pill. A real focusable input, visually hidden by CSS. */
function UploadPill({ label, accept, onPick, id }) {
  return (
    <label className={styles.uploadPill} htmlFor={id}>
      {label}
      {/*
        ⚠️ Visually hidden by CSS, NOT by `hidden` or `display: none`. Both of
        those remove the input from the focus order, and the prototype's
        label-wrapping-a-display-none-input pill cannot be reached or operated
        by a keyboard at all. Clipped-but-focusable keeps the pill's look, keeps
        Tab and Enter working, and keeps the control in the accessibility tree.
      */}
      <input
        id={id}
        type="file"
        accept={accept}
        className={styles.fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so re-picking the SAME file fires change again — otherwise a
          // rejected pick cannot be retried without choosing something else
          // first. The prototype does this too (Admin.dc.html:1181).
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

function ResumeCard({ stored, staged, onPick, onRemove, onUndo }) {
  const hasStored = Boolean(stored?.url);
  const badge = badgeFor(staged.file, hasStored);
  const stagedFile = staged.file instanceof File ? staged.file : null;
  const pendingRemove = staged.file === 'remove';

  const fileName = stagedFile ? stagedFile.name
    : pendingRemove || !hasStored ? 'No résumé uploaded yet'
    : stored.fileName || 'resume.pdf';

  const meta = stagedFile
    ? `${formatBytes(stagedFile.size)} · not saved yet`
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

      {/* ⚠️ PDF only, and the caption says so. The prototype offers
          `.pdf,.doc,.docx` and captions it that way, but "résumé is PDF only" is
          a locked decision and uploadResume 415s anything whose magic bytes are
          not %PDF-. Offering DOCX would promise a file the server refuses. */}
      <p className={styles.caption}>PDF ONLY · MAX 5 MB</p>
    </section>
  );
}

function PortraitCard({ stored, staged, onPick, onRemove, onUndo }) {
  const hasStored = Boolean(stored?.url);
  const badge = badgeFor(staged.file, hasStored);
  const stagedFile = staged.file instanceof File ? staged.file : null;
  const pendingRemove = staged.file === 'remove';

  const src = stagedFile ? staged.previewUrl : pendingRemove ? null : stored?.url || null;

  const fileName = stagedFile ? stagedFile.name
    : pendingRemove || !hasStored ? 'No portrait uploaded yet'
    : stored.fileName || 'portrait';

  const meta = stagedFile
    ? `${formatBytes(stagedFile.size)} · not saved yet`
    : pendingRemove ? 'Will be deleted when you save'
    : hasStored
      ? [
          formatBytes(stored.bytes),
          stored.width && stored.height && `${stored.width} × ${stored.height}`,
          stored.uploadedAt && `replaced ${formatDate(stored.uploadedAt)}`,
        ].filter(Boolean).join(' · ')
      : 'The About section falls back to the bundled photograph';

  return (
    <section className={a.panel} aria-labelledby="about-portrait-title">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="about-portrait-title">Portrait</h2>
        <span className={a.spacer} />
        <span className={badge.cls}>{badge.text}</span>
      </div>

      <p className={styles.cardNote}>
        Replaces the photograph in the About section. Uploading a new one{' '}
        <strong>permanently deletes</strong> the previous file. Any aspect ratio works — the
        section crops it to a 3:4 portrait.
      </p>

      <div className={styles.mediaRow}>
        {src
          ? <img className={styles.thumb} src={src} alt="" />
          : <span className={styles.thumbEmpty} aria-hidden="true">IMG</span>}

        <div className={styles.mediaBody}>
          <span className={styles.mediaName}>{fileName}</span>
          <span className={styles.mediaMeta}>{meta}</span>
          <div className={styles.mediaActions}>
            <UploadPill
              id="about-portrait-file"
              accept={PORTRAIT_SPEC.accept}
              label={hasStored || stagedFile ? '↑ REPLACE FILE' : '↑ UPLOAD PORTRAIT'}
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

      <p className={styles.caption}>PNG, JPEG OR WEBP · MAX 2 MB</p>
    </section>
  );
}

export function AdminAboutPanel() {
  const { data: about, isLoading } = useAbout();
  const updateAbout  = useUpdateAbout();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
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
  const resume = useStagedFile();

  // ── The validation guard (owner requirement, 2026-09-25) ─────────────────
  // Refuses an invalid save, shakes SAVE, and marks every offending field in
  // place. `FID` is the id namespace — every validatable input's id and its
  // error's `field` are both derived from it, so they cannot drift apart.
  const guard = useFormGuard(aboutFormErrors, FID);

  const [pickError, setPickError] = useState(null);
  const [saveErrors, setSaveErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const dirty = isAboutDirty(form, about) || Boolean(avatar.file) || Boolean(resume.file);

  // ⚠️ A rejected pick does NOT clear what is already staged. The first version
  // called `staged.clear()` here, which threw away a good file the owner had
  // already chosen because they then mis-clicked on a second one — losing work
  // in the middle of reporting an error about it. Rejecting means "this file is
  // not accepted", not "start again".
  const pick = (staged, spec) => (file) => {
    const reason = rejectReason(file, spec);
    if (reason) { setPickError(reason); return; }
    setPickError(null);
    staged.stage(file);
  };

  // ── SAVE: sequential, and honest about partial failure ────────────────────
  // The profile PUT goes FIRST because it is the only one that cannot fail for
  // environmental reasons — a storage outage then still lets a text edit land.
  // Sequential rather than Promise.all so a 503 on the first upload does not
  // fire a second doomed request, and so the banner can name exactly which file
  // was refused.
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ⚠️ FIRST, and it returns before anything is sent. The whole point of the
    // rule is that an invalid form produces no request at all — a save that
    // fires and then reports a 400 has already told the owner the wrong thing
    // about which system refused them.
    if (!guard.check(form)) return;

    setPickError(null);
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
      return;
    }

    showFlash('Profile saved');
  };

  if (isLoading) {
    return (
      <div className={a.stack} aria-busy="true">
        <div className={a.skelRow} />
        <div className={a.skelRow} />
        <div className={a.skelRow} />
      </div>
    );
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

      {(pickError || saveErrors.length > 0) && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{pickError || saveErrors.join(' ')}</span>
        </div>
      )}

      {/* ── Basic info ────────────────────────────────────────────────────── */}
      <section className={a.panel} aria-labelledby="about-basic-title">
        <h2 className={a.panelTitle} id="about-basic-title">Basic info</h2>
        <div className={a.fieldGrid}>
          {BASIC_FIELDS.map(({ name, label, placeholder }) => (
            <div key={name}>
              <label className={a.label} htmlFor={`about-${name}`}>{label}</label>
              <input
                {...fieldProps(guard.errors, FID, name)}
                className={a.input}
                name={name}
                placeholder={placeholder}
                value={form[name]}
                onChange={(e) => edit({ [name]: e.target.value }, name)}
              />
              <FieldError field={name} guard={guard} />
            </div>
          ))}
        </div>
      </section>

      <PortraitCard
        stored={about?.avatar}
        staged={avatar}
        onPick={pick(avatar, PORTRAIT_SPEC)}
        onRemove={() => avatar.stage('remove')}
        onUndo={() => { avatar.clear(); setPickError(null); }}
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
        onPick={pick(resume, RESUME_SPEC)}
        onRemove={() => resume.stage('remove')}
        onUndo={() => { resume.clear(); setPickError(null); }}
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
          disabled={!dirty || saving}
        >
          {saving ? 'SAVING…' : 'SAVE PROFILE'}
        </button>

        {/*
          REVERT restores the last SAVED state — it does not empty the section.
          That distinction is the whole request: the only other cancel in this
          admin (AdminProjectsPanel's `cancelEdit`) sets the form to EMPTY, so
          mis-clicking it while editing loses the record's content out of the form.

          Dropping `draft` hands every field back to the query cache, and clearing
          both staged slots discards a picked portrait or résumé too — a revert
          that left a file staged would be a half-revert.
        */}
        {dirty && !saving && (
          <button
            type="button"
            className={a.btnOutline}
            onClick={() => {
              setDraft(null);
              avatar.clear();
              resume.clear();
              setPickError(null);
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
