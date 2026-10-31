import { useState } from 'react';
import { useAbout, useUpdateAbout } from '../../../hooks/useAbout';
import { useAdminFlash } from '../../../hooks/useAdminFlash';
import { useFormGuard } from '../../../hooks/useFormGuard';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges';
import { useStagedFile } from '../../../hooks/useStagedFile';
import { isEntryDirty, moveId, dropId } from '../../../utils/entryForm';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { formatBytes, messageFor, prepareFile, pictureOrPdfSpec, isPdfFile, MAX_UPLOAD_MB } from '../../../utils/mediaFile';
import { MonthYearField } from '../MonthYearField';
import { DropZone } from '../DropZone';
import { badgeFor } from '../mediaBadge';
import { UploadPill } from '../UploadPill';
import { ConfirmDialog } from '../ConfirmDialog';
import { LoadError } from '../LoadError';
import a      from '../../../styles/admin.module.css';
import styles from './EntryListPanel.module.css';

/**
 * PF-143 — the admin panel of an ORDERED LIST of owner-written entries:
 * Education and Certificates. Both live the same life, so both panels are this
 * component with their own fields (AdminEducationPanel, AdminCertificatesPanel).
 *
 * Three cards, every standing admin rule (product-requirements.md):
 *   1. SECTION TEXT — the words around the list on the site, saved to About.
 *   2. THE FORM — a new entry SAVES AS DRAFT (title only, invisible); an
 *      existing one REVERTS. Stages until SAVE (the picture too), SAVE dim until
 *      dirty, an invalid save is refused with every field marked.
 *   3. THE LIST — PUBLISH/UNPUBLISH, EDIT, DELETE (ConfirmDialog), and the
 *      ORDER: dragged or moved with ↑ ↓, staged until SAVE ORDER — the order is
 *      what decides the home page (its first six certificates).
 * Leaving with any of the three unsaved asks first (useUnsavedChanges).
 *
 * The record's shape lives in `config`:
 *   FID, noun, hooks, toForm, toPayload, formErrors, titleField,
 *   renderFields(helpers), rowMeta(entry), media { field, label, help, spec? },
 *   textFields (optional — no Section text card without them; Education has none)
 */
export function EntryListPanel({ config }) {
  const { FID, noun, hooks, toForm, toPayload, formErrors, titleField, media } = config;
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const listQuery = hooks.useAdmin();
  const { data: entries = [], isLoading } = listQuery;
  const isError = listQuery.isError && listQuery.data === undefined;
  const create        = hooks.useCreate();
  const update        = hooks.useUpdate();
  const remove        = hooks.useRemove();
  const reorder       = hooks.useReorder();
  const uploadPicture = hooks.useUploadPicture();
  const removePicture = hooks.useRemovePicture();
  const { showFlash } = useAdminFlash();

  // ── 2. The form — DERIVED from the open record until the first edit ───────
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const saved = editingId ? entries.find((e) => e._id === editingId) ?? null : null;
  const form = draft ?? toForm(saved);

  const picture = useStagedFile();
  const guard = useFormGuard(formErrors, FID);
  const spec = media.spec ?? pictureOrPdfSpec(media.label);

  const [pickError, setPickError]   = useState(null);
  const [preparing, setPreparing]   = useState(false);
  const [saveErrors, setSaveErrors] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [pressed, setPressed]       = useState('publish');
  const [confirmId, setConfirmId]   = useState(null);

  const formDirty = isEntryDirty(form, saved, { toForm, toPayload }) || Boolean(picture.file);
  const editingDraft = Boolean(saved) && saved.published !== true;

  const edit = (patch, field) => {
    setDraft({ ...form, ...patch });
    if (field) guard.clearField(field);
  };

  /** Back to the last SAVED state — never to blank — and the staged file too. */
  const discard = () => {
    setDraft(null);
    picture.clear();
    setPickError(null);
    setSaveErrors([]);
    guard.reset();
  };

  const open = (id) => {
    discard();
    setEditingId(id);
  };

  const pick = async (file) => {
    setPreparing(true);
    try {
      const result = await prepareFile(file, spec);
      if (result.error) { setPickError(result.error); return; }
      setPickError(null);
      picture.stage(result.file, { resizedFrom: result.resizedFrom });
    } catch {
      setPickError('This file could not be prepared for upload — try another file.');
    } finally {
      setPreparing(false);
    }
  };

  const clearPicture = () => {
    setPickError(null);
    picture.stage(picture.file instanceof File ? null : 'remove');
  };

  /**
   * SAVE. `publish` is the button's intent. Record first (a new entry needs
   * its id), then the picture; a failed upload leaves the owner EDITING the
   * saved record with the file still staged — never a "saved" flash for half.
   */
  const submit = async (publish) => {
    setPressed(publish ? 'publish' : 'draft');
    if (!guard.check({ ...form, published: publish })) return false;

    setPickError(null);
    setSaveErrors([]);
    setSaving(true);

    const failures = [];
    let id = editingId;
    let recordSaved = false;

    try {
      const payload = toPayload(form, { publish });
      if (id) await update.mutateAsync({ id, data: payload });
      else id = (await create.mutateAsync(payload))._id;
      recordSaved = true;
    } catch (err) {
      failures.push(`${Noun}: ${messageFor(err)}`);
    }

    if (id && picture.file) {
      try {
        if (picture.file === 'remove') await removePicture.mutateAsync(id);
        else await uploadPicture.mutateAsync({ id, file: picture.file });
        picture.clear();
      } catch (err) {
        failures.push(`${media.label}: ${messageFor(err)}`);
      }
    }

    setSaving(false);

    if (failures.length) {
      if (recordSaved) {
        setDraft(null);
        setEditingId(id);
        guard.reset();
      }
      setSaveErrors(recordSaved ? [`${publish ? Noun : 'Draft'} saved.`, ...failures] : failures);
      return false;
    }

    open(null);
    showFlash(!publish ? 'Draft saved' : editingId ? `${Noun} updated` : `${Noun} added`);
    return true;
  };

  // ── 1. Section text ───────────────────────────────────────────────────────
  const aboutQuery = useAbout();
  const updateAbout = useUpdateAbout();
  const textFields = config.textFields ?? [];
  const storedText = Object.fromEntries(textFields.map(({ name }) => [name, aboutQuery.data?.[name] ?? '']));
  const [textDraft, setTextDraft] = useState(null);
  const text = textDraft ?? storedText;
  const textErrors = (values) => textFields
    .filter(({ name, max }) => String(values[name] ?? '').trim().length > max)
    .map(({ name, label, max }) => ({ field: name, message: `${label} cannot exceed ${max} characters.` }));
  const TFID = `${FID}-text`;
  const textGuard = useFormGuard(textErrors, TFID);
  const textPayload = (values) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v).trim()]));
  const textDirty = JSON.stringify(textPayload(text)) !== JSON.stringify(textPayload(storedText));
  const [textSaveError, setTextSaveError] = useState(null);

  const saveText = async () => {
    if (!textGuard.check(text)) return false;
    setTextSaveError(null);
    try {
      await updateAbout.mutateAsync(textPayload(text));
      setTextDraft(null);
      showFlash('Section text saved');
      return true;
    } catch (err) {
      setTextSaveError(`Section text: ${messageFor(err)}`);
      return false;
    }
  };

  const revertText = () => { setTextDraft(null); setTextSaveError(null); textGuard.reset(); };

  // ── 3. The order — staged until SAVE ORDER ────────────────────────────────
  const [orderDraft, setOrderDraft] = useState(null);
  const savedIds = entries.map((e) => e._id);
  // A staged order is reconciled with the live list: deleted entries drop out,
  // entries added since go to the end.
  const orderedIds = orderDraft
    ? [...orderDraft.filter((id) => savedIds.includes(id)), ...savedIds.filter((id) => !orderDraft.includes(id))]
    : savedIds;
  const orderDirty = orderedIds.join() !== savedIds.join();
  const ordered = orderedIds.map((id) => entries.find((e) => e._id === id));
  const [orderError, setOrderError] = useState(null);

  const saveOrder = async () => {
    setOrderError(null);
    try {
      await reorder.mutateAsync(orderedIds);
      setOrderDraft(null);
      showFlash('Order saved');
      return true;
    } catch (err) {
      setOrderError(`Order: ${messageFor(err)}`);
      return false;
    }
  };

  const [dragId, setDragId] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const endDrag = () => { setDragId(null); setDropAt(null); };

  // ── Leaving asks first — whichever of the three is unsaved ────────────────
  // SAVE in the dialog only when exactly ONE thing is pending: with two, a
  // single "SAVE" would silently pick one (Skills' rule).
  const keepsLive = Boolean(saved) && saved.published === true;
  const parts = [
    formDirty && {
      save: () => submit(keepsLive),
      saveLabel: !saved ? 'SAVE AS DRAFT' : keepsLive ? 'SAVE CHANGES' : 'SAVE DRAFT',
      what: saved ? `“${saved[titleField]}”` : `your new ${noun}`,
    },
    textDirty && { save: saveText, saveLabel: 'SAVE TEXT', what: 'the section text' },
    orderDirty && { save: saveOrder, saveLabel: 'SAVE ORDER', what: `the ${noun} order` },
  ].filter(Boolean);
  const leave = parts.length === 1 ? parts[0] : { what: parts.map((p) => p.what).join(' and ') };
  const requestLeave = useUnsavedChanges({ dirty: parts.length > 0, ...leave });

  /** Switching records only risks the FORM — ask only when the form is dirty. */
  const switchTo = (fn) => (formDirty ? requestLeave(fn) : fn());

  const publishFromRow = async (entry) => {
    const publish = entry.published !== true;
    if (publish) {
      const intent = { ...toForm(entry), published: true };
      if (formErrors(intent).length > 0) {
        switchTo(() => {
          open(entry._id);
          setPressed('publish');
          guard.check(intent);
          window.scrollTo({ top: 0 });
        });
        return;
      }
    }
    try {
      await update.mutateAsync({ id: entry._id, data: { published: publish } });
      showFlash(publish ? `${Noun} published` : `${Noun} unpublished`);
    } catch (err) {
      setSaveErrors([`${publish ? 'Publish' : 'Unpublish'}: ${messageFor(err)}`]);
    }
  };

  const handleDelete = async () => {
    const id = confirmId;
    try {
      await remove.mutateAsync(id);
      if (id === editingId) open(null);
      showFlash(`${Noun} deleted`);
    } catch (err) {
      setSaveErrors([`Delete: ${messageFor(err)}`]);
    }
    setConfirmId(null);
  };

  // ── Field helpers handed to the panel's renderFields ──────────────────────
  // Each helper notes its field's label, so the refused-save banner can NAME
  // the fields (owner, 2026-10-31), not only count them.
  const labels = {};

  const textField = (name, label, { placeholder, multiline, rows = 3, mono, required } = {}) => {
    labels[name] = label;
    return (
    <div key={name}>
      <Label htmlFor={`${FID}-${name}`} label={label} required={required} />
      {multiline ? (
        <textarea
          {...fieldProps(guard.errors, FID, name)}
          className={a.textarea}
          rows={rows}
          name={name}
          placeholder={placeholder}
          value={form[name]}
          onChange={(e) => edit({ [name]: e.target.value }, name)}
        />
      ) : (
        <input
          {...fieldProps(guard.errors, FID, name)}
          className={mono ? a.inputMono : a.input}
          name={name}
          aria-required={required || undefined}
          placeholder={placeholder}
          value={form[name]}
          onChange={(e) => edit({ [name]: e.target.value }, name)}
        />
      )}
      <FieldError field={name} guard={guard} fid={FID} />
    </div>
    );
  };

  const monthYearField = (name, label, { required, withDay } = {}) => {
    labels[name] = label;
    return (
    <div key={name}>
      <MonthYearField
        label={label}
        required={required}
        withDay={withDay}
        value={form[name]}
        field={fieldProps(guard.errors, FID, name)}
        onChange={(value) => edit({ [name]: value }, name)}
      />
      <FieldError field={name} guard={guard} fid={FID} />
    </div>
    );
  };

  // ── Buttons ───────────────────────────────────────────────────────────────
  // `disabled` is `!dirty`, never `|| invalid` (owner rule); PUBLISH on an
  // untouched draft is the one exception — publishing IS the change.
  const primaryLabel = !saved ? `ADD ${noun.toUpperCase()}` : editingDraft ? 'PUBLISH' : 'SAVE CHANGES';
  const primaryLit   = formDirty || editingDraft;
  const draftLabel   = saved ? 'SAVE DRAFT' : 'SAVE AS DRAFT';
  const showDraft    = !saved || editingDraft;
  const shakeOn = (which) => (guard.shaking && pressed === which ? a.shake : '');
  const confirmTarget = entries.find((e) => e._id === confirmId);
  const canMove = !dragId;

  // Rendered BEFORE the JSX below, so `labels` is filled when the banner reads it.
  const fields = config.renderFields({ textField, monthYearField });
  const named = guard.errors.map((e) => labels[e.field]);
  const problemList = named.every(Boolean)
    ? named.join(', ')
    : `${guard.errors.length} ${guard.errors.length === 1 ? 'field' : 'fields'}`;

  return (
    <div className={a.stack}>
      {/* ── 1. Section text (only for a panel that has some) ── */}
      {textFields.length > 0 && (
      <section className={a.panel} aria-labelledby={`${TFID}-title`}>
        <h2 className={a.panelTitle} id={`${TFID}-title`}>Section text</h2>
        <p className={styles.note}>The words around the list on the site. Leave one empty to use the built-in wording.</p>
        {aboutQuery.isLoading ? (
          <div aria-busy="true"><div className={a.skelRow} /></div>
        ) : aboutQuery.isError && aboutQuery.data === undefined ? (
          <LoadError what="THE SECTION TEXT" query={aboutQuery} />
        ) : (
          <form className={a.form} noValidate onSubmit={(e) => { e.preventDefault(); saveText(); }}>
            {textGuard.errors.length > 0 && (
              <div className={a.bannerError} role="alert">
                <span className={a.bannerDot} aria-hidden="true" />
                <span>
                  CHECK THE CHANGES AGAIN — {textGuard.errors.length}{' '}
                  {textGuard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
                </span>
              </div>
            )}
            {textSaveError && (
              <div className={a.bannerError} role="alert">
                <span className={a.bannerDot} aria-hidden="true" />
                <span>{textSaveError}</span>
              </div>
            )}
            <div className={styles.textGrid}>
              {textFields.map(({ name, label, hint, multiline }) => (
                <div key={name} className={multiline ? styles.wide : undefined}>
                  <label className={a.label} htmlFor={`${TFID}-${name}`}>{label}</label>
                  {multiline ? (
                    <textarea
                      {...fieldProps(textGuard.errors, TFID, name)}
                      className={a.textarea}
                      rows={2}
                      placeholder={hint}
                      value={text[name]}
                      onChange={(e) => { setTextDraft({ ...text, [name]: e.target.value }); textGuard.clearField(name); }}
                    />
                  ) : (
                    <input
                      {...fieldProps(textGuard.errors, TFID, name)}
                      className={a.input}
                      placeholder={hint}
                      value={text[name]}
                      onChange={(e) => { setTextDraft({ ...text, [name]: e.target.value }); textGuard.clearField(name); }}
                    />
                  )}
                  <FieldError field={name} guard={textGuard} fid={TFID} />
                </div>
              ))}
            </div>
            <div className={styles.saveRow}>
              <button
                key={`text-${textGuard.shakeKey}`}
                type="submit"
                className={`${a.btnPrimary} ${textGuard.shaking ? a.shake : ''}`}
                onAnimationEnd={textGuard.onShakeEnd}
                disabled={!textDirty || updateAbout.isPending}
              >
                {updateAbout.isPending ? 'SAVING…' : 'SAVE TEXT'}
              </button>
              {textDirty && !updateAbout.isPending && (
                <button type="button" className={a.btnGhost} onClick={revertText}>REVERT CHANGES</button>
              )}
              {textDirty && !updateAbout.isPending && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
            </div>
          </form>
        )}
      </section>
      )}

      {/* ── 2. The form ── */}
      <section className={a.panel} aria-labelledby={`${FID}-form-title`}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id={`${FID}-form-title`}>
            {saved ? `Edit ${noun}` : `Add new ${noun}`}
          </h2>
          {editingDraft && <span className={a.badgeMuted}>DRAFT</span>}
          <span className={a.spacer} />
          {saved && (
            <button type="button" className={styles.cancelEdit} onClick={() => switchTo(() => open(null))}>
              CANCEL EDIT
            </button>
          )}
        </div>

        {/* `noValidate` is mandatory: a native bubble would pre-empt the guard. */}
        <form className={a.form} noValidate onSubmit={(e) => { e.preventDefault(); submit(true); }}>
          {guard.errors.length > 0 && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>
                CHECK THE CHANGES AGAIN — {problemList} {guard.errors.length === 1 ? 'needs' : 'need'} attention.
              </span>
            </div>
          )}
          {saveErrors.length > 0 && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>{saveErrors.join(' ')}</span>
            </div>
          )}

          <p className={styles.requiredNote}><span aria-hidden="true">*</span> Indicates required</p>
          {fields}

          <PictureBlock
            id={`${FID}-picture-file`}
            label={media.label}
            help={media.help}
            stored={saved?.[media.field]}
            staged={picture}
            accept={spec.accept}
            onPick={pick}
            onReject={setPickError}
            onClear={clearPicture}
            error={pickError}
          />

          <div className={styles.saveRow}>
            <button
              key={`publish-${guard.shakeKey}`}
              type="submit"
              className={`${a.btnPrimary} ${shakeOn('publish')}`}
              onAnimationEnd={guard.onShakeEnd}
              disabled={!primaryLit || saving || preparing}
            >
              {saving && pressed === 'publish' ? 'SAVING…' : primaryLabel}
            </button>
            {showDraft && (
              <button
                key={`draft-${guard.shakeKey}`}
                type="button"
                className={`${a.btnOutline} ${shakeOn('draft')}`}
                onClick={() => submit(false)}
                onAnimationEnd={guard.onShakeEnd}
                disabled={!formDirty || saving || preparing}
              >
                {saving && pressed === 'draft' ? 'SAVING…' : draftLabel}
              </button>
            )}
            {formDirty && !saving && (
              <button type="button" className={a.btnGhost} onClick={discard}>REVERT CHANGES</button>
            )}
            {formDirty && !saving && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
          </div>
        </form>
      </section>

      {/* ── 3. The list ── */}
      <section className={a.panel} aria-labelledby={`${FID}-list-title`}>
        <h2 className={styles.listTitle} id={`${FID}-list-title`}>
          {config.listTitle}{!isLoading && !isError && ` (${entries.length})`}
        </h2>

        {isLoading ? (
          <div className={styles.list} aria-busy="true">
            <div className={a.skelRow} /><div className={a.skelRow} /><div className={a.skelRow} />
          </div>
        ) : isError ? (
          <LoadError what={config.listTitle.toUpperCase()} query={listQuery} />
        ) : entries.length === 0 ? (
          <p className={a.emptyState}>Nothing yet. Add one above.</p>
        ) : (
          <>
            <p className={styles.note}>{config.orderHint}</p>
            <ul
              className={styles.list}
              role="list"
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dropAt !== null) setOrderDraft(dropId(orderedIds, dragId, dropAt));
                endDrag();
              }}
            >
              {ordered.map((entry, i) => {
                const classes = [a.row];
                if (entry._id === editingId) classes.push(a.rowActive);
                if (entry._id === dragId) classes.push(styles.dragging);
                if (dropAt === i) classes.push(styles.dropBefore);
                if (dropAt === ordered.length && i === ordered.length - 1) classes.push(styles.dropAfter);
                const title = entry[titleField];
                return (
                  <li
                    key={entry._id}
                    className={classes.join(' ')}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', entry._id);   // Firefox will not drag without data
                      setDragId(entry._id);
                    }}
                    onDragEnd={endDrag}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      const box = e.currentTarget.getBoundingClientRect();
                      const at = e.clientY > box.top + box.height / 2 ? i + 1 : i;
                      if (dropAt !== at) setDropAt(at);
                    }}
                  >
                    <span aria-hidden="true" className={styles.grip}>⠿</span>
                    <span className={a.rowBody}>
                      <span className={styles.rowHead}>
                        <span className={a.rowTitle}>{title}</span>
                        {entry.published !== true && <span className={a.badgeMuted}>DRAFT</span>}
                        {config.rowBadge?.(entry, i, ordered)}
                      </span>
                      <span className={a.rowMeta}>{config.rowMeta(entry)}</span>
                    </span>
                    <span className={a.rowActions}>
                      <button type="button" className={a.btnRow} disabled={!canMove || i === 0}
                        onClick={() => setOrderDraft(moveId(orderedIds, entry._id, -1))}
                        aria-label={`Move ${title} up`}>↑</button>
                      <button type="button" className={a.btnRow} disabled={!canMove || i === ordered.length - 1}
                        onClick={() => setOrderDraft(moveId(orderedIds, entry._id, 1))}
                        aria-label={`Move ${title} down`}>↓</button>
                      <button type="button" className={a.btnRow} onClick={() => publishFromRow(entry)}
                        aria-label={`${entry.published !== true ? 'Publish' : 'Unpublish'} ${title}`}>
                        {entry.published !== true ? 'PUBLISH' : 'UNPUBLISH'}
                      </button>
                      <button type="button" className={a.btnRow}
                        onClick={() => switchTo(() => { open(entry._id); window.scrollTo({ top: 0 }); })}
                        aria-label={`Edit ${title}`}>
                        EDIT
                      </button>
                      <button type="button" className={a.btnRowDanger} onClick={() => setConfirmId(entry._id)}
                        aria-label={`Delete ${title}`}>
                        DELETE
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            {(orderDirty || orderError) && (
              <div className={styles.saveRow}>
                {orderError && (
                  <div className={a.bannerError} role="alert">
                    <span className={a.bannerDot} aria-hidden="true" />
                    <span>{orderError}</span>
                  </div>
                )}
                {orderDirty && (
                  <>
                    <button type="button" className={a.btnPrimary} onClick={saveOrder} disabled={reorder.isPending}>
                      {reorder.isPending ? 'SAVING…' : 'SAVE ORDER'}
                    </button>
                    {!reorder.isPending && (
                      <button type="button" className={a.btnGhost}
                        onClick={() => { setOrderDraft(null); setOrderError(null); }}>
                        REVERT ORDER
                      </button>
                    )}
                    <span className={styles.unsaved}>UNSAVED ORDER</span>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {confirmId && (
        <ConfirmDialog
          title={`Delete ${noun}?`}
          busy={remove.isPending}
          onCancel={() => setConfirmId(null)}
          onConfirm={handleDelete}
        >
          This will permanently remove &ldquo;{confirmTarget?.[titleField] ?? `this ${noun}`}&rdquo; and
          its picture from your portfolio and cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}

/** The inline message under a field. `role="alert"` so it is announced. */
/** A field's label; a required one gets LinkedIn's `*` (owner, 2026-10-31). */
function Label({ htmlFor, label, required }) {
  return (
    <label className={`${a.label} ${required ? styles.required : ''}`} htmlFor={htmlFor}>{label}</label>
  );
}

function FieldError({ field, guard, fid }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return <p className={a.fieldError} id={errorId(fid, field)} role="alert">{message}</p>;
}

/**
 * The picture (or PDF) block. Everything STAGES: a pick previews from its own
 * blob URL (a PDF shows a tile — a browser cannot paint a PDF in an <img>) and
 * goes up on SAVE; CLEAR on a stored picture stages its removal.
 */
function PictureBlock({ id, label, help, stored, staged, accept, onPick, onReject, onClear, error }) {
  const hasStored = Boolean(stored?.url);
  const stagedFile = staged.file instanceof File ? staged.file : null;
  const pendingRemove = staged.file === 'remove';
  const badge = badgeFor(staged.file, hasStored, 'NONE');
  const stagedPdf = stagedFile && isPdfFile(stagedFile);

  const src = stagedFile ? (stagedPdf ? null : staged.previewUrl) : pendingRemove ? null : stored?.url || null;

  const meta = stagedFile
    ? [stagedFile.name, formatBytes(stagedFile.size),
        staged.resizedFrom && `resized from ${formatBytes(staged.resizedFrom)}`,
        stagedPdf && 'its first page becomes the picture', 'not saved yet']
        .filter(Boolean).join(' · ')
    : pendingRemove ? 'Will be deleted when you save'
    : hasStored ? `${stored.format === 'pdf' ? 'From a PDF · ' : ''}Uploading a new one permanently deletes this file`
    : 'No picture yet';

  return (
    <div className={styles.picBlock}>
      <div className={styles.picHead}>
        <p className={styles.picLabel}>{label} — {help}</p>
        <span className={a.spacer} />
        <span className={badge.cls}>{badge.text}</span>
      </div>
      <DropZone onFile={onPick} onReject={onReject}>
        <div className={styles.picRow}>
          {src ? (
            <img className={styles.picPreview} src={src} alt="" data-testid="picture-preview" />
          ) : (
            <span className={styles.picPreview} aria-hidden="true">{stagedPdf ? 'PDF' : ''}</span>
          )}
          <div className={styles.picBody}>
            <span className={styles.picMeta}>{meta}</span>
            <div className={styles.picActions}>
              <UploadPill
                id={id}
                className={styles.picUpload}
                accept={accept}
                label={hasStored || stagedFile ? '↑ REPLACE FILE' : '↑ UPLOAD FILE'}
                onPick={onPick}
              />
              {(stagedFile || (hasStored && !pendingRemove)) && (
                <button type="button" className={styles.clear} onClick={onClear}>CLEAR</button>
              )}
            </div>
          </div>
        </div>
      </DropZone>
      {error && <p className={a.fieldError} role="alert">{error}</p>}
      {/* The caption follows the slot's own rules: a logo takes no PDF (owner, 2026-10-31). */}
      <p className={styles.caption}>
        {accept.includes('.pdf') ? 'PNG, JPEG, WEBP OR PDF' : 'PNG, JPEG OR WEBP'} · MAX {MAX_UPLOAD_MB} MB · LARGER PHOTOS ARE RESIZED
      </p>
    </div>
  );
}
