import { useState } from 'react';
import {
  useSkills, useCreateSkill, useUpdateSkill, useReorderSkills, useDeleteSkill,
} from '../../../hooks/useSkills';
import { useSkillCategories } from '../../../hooks/useSkillCategories';
import { useAdminFlash } from '../../../hooks/useAdminFlash';
import { useFormGuard } from '../../../hooks/useFormGuard';
import {
  LEVELS, emptySkillForm, skillToForm, formToPayload, isSkillDirty, skillFormErrors,
  sortedSections, defaultSectionKey, mergeLayout, moveInLayout, layoutChanges, isLayoutDirty,
} from '../../../utils/skillForm';
import { fieldProps, errorId } from '../../../utils/formErrors';
import { messageFor } from '../../../utils/mediaFile';
import { ConfirmDialog } from '../ConfirmDialog';
import { SkillSectionsCard } from '../SkillSectionsCard';
import a      from '../../../styles/admin.module.css';
import styles from './AdminSkillsPanel.module.css';

/** The id namespace — every validatable input's id derives from it. */
const FID = 'skill';

/**
 * The guard's validator. ⚠️ Module-level, with its context passed IN through
 * `check()` rather than closed over: a `useCallback` over `skills` memoizes
 * nothing, because `data: skills = []` is a new array on every render while
 * loading, and the React Compiler lint refuses it for exactly that reason.
 */
const validateSkill = ({ form, skills, editingId, sectionKeys }) =>
  skillFormErrors(form, skills, editingId, sectionKeys);

function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return <p className={a.fieldError} id={errorId(FID, field)} role="alert">{message}</p>;
}

/**
 * PF-114 — the Skills panel. Admin.dc.html:307-360, transcribed, plus what the
 * prototype has no way to do. Owner decisions, 2026-10-05:
 *
 *  - NO DRAFTS — a skill is too small to hold back; ADD publishes.
 *  - Click a chip → the top card becomes "Edit skill": SAVE CHANGES, REVERT
 *    CHANGES, CANCEL EDIT. Level is editable, because the home page now SHOWS
 *    it (SkillsSection's dots).
 *  - ◀ ▶ while editing, and DRAG-AND-DROP of any pill — within a box or into
 *    another — move skills. Both write ONE staged layout, so they can never
 *    disagree; nothing reaches the site until SAVE.
 *  - The boxes are the owner's SECTIONS (SkillSectionsCard), not a fixed list.
 *  - × asks first, through the shared ConfirmDialog.
 */
export function AdminSkillsPanel() {
  const { data: skills = [], isLoading: skillsLoading } = useSkills();
  const { data: rawCategories = [], isLoading: sectionsLoading } = useSkillCategories();
  const categories = sortedSections(rawCategories);
  const sectionKeys = categories.map((c) => c.key);
  const labelOf = Object.fromEntries(categories.map((c) => [c.key, c.label]));
  const isLoading = skillsLoading || sectionsLoading;

  const createSkill   = useCreateSkill();
  const updateSkill   = useUpdateSkill();
  const reorderSkills = useReorderSkills();
  const deleteSkill   = useDeleteSkill();
  const { showFlash } = useAdminFlash();

  // ── Which skill, and the form DERIVED from it ─────────────────────────────
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  // After an ADD the name clears but section and level stay — the prototype's
  // own behaviour (Admin.dc.html:949).
  const [addDefaults, setAddDefaults] = useState({ category: null, level: 'beginner' });
  const saved = editingId ? skills.find((s) => s._id === editingId) ?? null : null;
  const addCategory = sectionKeys.includes(addDefaults.category)
    ? addDefaults.category : defaultSectionKey(categories);
  const base = saved ? skillToForm(saved) : { ...emptySkillForm(addCategory), level: addDefaults.level };
  const form = draft ?? base;

  // ── The staged LAYOUT — every box's ids, in order ─────────────────────────
  const [layoutDraft, setLayoutDraft] = useState(null);
  const layout = mergeLayout(layoutDraft, skills, categories);
  const layoutDirty = isLayoutDirty(layout, skills, categories);

  const guard = useFormGuard(validateSkill, FID);

  const [saveErrors, setSaveErrors] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [confirmId, setConfirmId]   = useState(null);

  const fieldsDirty = saved ? isSkillDirty(form, saved) : form.name !== '';
  const dirty = fieldsDirty || (Boolean(saved) && layoutDirty);
  const categoryChanged = Boolean(saved) && form.category !== saved.category;

  /** Edit a field, and clear (never re-validate) that field's mark. */
  const edit = (patch, field) => {
    setDraft({ ...form, ...patch });
    if (field) guard.clearField(field);
    if (patch.category !== undefined && saved && patch.category !== saved.category) {
      setLayoutDraft(null);   // the server puts it at the END of the new box
    }
  };

  /** Back to the last SAVED state — never to blank. Layout included. */
  const discard = () => {
    setDraft(null);
    setLayoutDraft(null);
    setSaveErrors([]);
    guard.reset();
  };

  const open = (id) => {
    discard();
    setEditingId(id);
  };

  const startEdit = (skill) => {
    open(skill._id);
    // No `behavior` — inherits the root's scroll-behavior, so the
    // reduced-motion override reaches it (the ScrollToHash rule).
    window.scrollTo({ top: 0 });
  };

  const card = saved ? layout[saved.category] ?? [] : [];
  const position = card.indexOf(editingId);
  // moveInLayout takes the slot BEFORE which to drop; "one later" is +2
  // because removing the pill first shifts everything after it down one.
  const move = (dir) =>
    setLayoutDraft(moveInLayout(layout, editingId, saved.category, position + (dir < 0 ? -1 : 2)));

  /** Send a staged layout: moves FIRST (the server appends), then reorders. */
  const commitLayout = async () => {
    const { moves, reorders } = layoutChanges(layout, skills, categories);
    for (const m of moves) {
      await updateSkill.mutateAsync({ id: m.id, data: { category: m.category } });
    }
    for (const ids of reorders) await reorderSkills.mutateAsync(ids);
  };

  // ── SAVE (the form) ───────────────────────────────────────────────────────
  /**
   * Sequential: fields first, then the layout. A failed reorder after a saved
   * edit keeps the owner on the skill with the move still staged, and never
   * flashes "Skill updated" for a half-saved change.
   */
  const submit = async () => {
    // FIRST, and it returns before anything is sent.
    if (!guard.check({ form, skills, editingId, sectionKeys })) return;

    setSaveErrors([]);
    setSaving(true);
    const failures = [];
    let fieldsSaved = !fieldsDirty;

    try {
      if (!saved) {
        await createSkill.mutateAsync(formToPayload(form));
        fieldsSaved = true;
      } else if (fieldsDirty) {
        await updateSkill.mutateAsync({ id: editingId, data: formToPayload(form) });
        fieldsSaved = true;
      }
    } catch (err) {
      failures.push(`Skill: ${messageFor(err)}`);
    }

    // No category check needed: changing the category clears the staged layout
    // inside edit(), so layoutDirty is already false by the time it matters.
    if (saved && fieldsSaved && layoutDirty) {
      try {
        await commitLayout();
      } catch (err) {
        failures.push(`Position: ${messageFor(err)}`);
      }
    }

    setSaving(false);

    if (failures.length) {
      if (fieldsSaved && fieldsDirty) {
        setDraft(null);         // the fields are stored; the move stays staged
        guard.reset();
      }
      setSaveErrors(fieldsSaved && fieldsDirty ? ['Skill saved.', ...failures] : failures);
      return;
    }

    if (!saved) {
      setAddDefaults({ category: form.category, level: form.level });
      setDraft(null);
      setSaveErrors([]);
      guard.reset();
      showFlash('Skill added');
    } else {
      open(null);
      showFlash('Skill updated');
    }
  };

  // ── SAVE ORDER (drag-and-drop, outside edit mode) ─────────────────────────
  const [orderErrors, setOrderErrors] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const saveOrder = async () => {
    setOrderErrors([]);
    setSavingOrder(true);
    try {
      await commitLayout();
      setLayoutDraft(null);
      showFlash('Order saved');
    } catch (err) {
      setOrderErrors([`Order: ${messageFor(err)}`]);
    }
    setSavingOrder(false);
  };

  const handleDelete = async () => {
    const id = confirmId;
    try {
      await deleteSkill.mutateAsync(id);
      if (id === editingId) open(null);
      // A staged layout naming the deleted skill is reconciled by mergeLayout.
      showFlash('Skill deleted');
    } catch (err) {
      setSaveErrors([`Delete: ${messageFor(err)}`]);
    }
    setConfirmId(null);
  };

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  // Native HTML5 DnD — no library (locked decision). ⚠️ OFF while a skill is
  // open in the edit card: one staging path at a time, so SAVE CHANGES never
  // has to explain a drag made in a different card.
  // ⚠️ Pointer-only by nature; the keyboard and touch path is the edit card's
  // ◀ ▶ arrows plus its Category dropdown.
  const canDrag = !saved && !savingOrder;
  const [dragId, setDragId] = useState(null);
  const [dropAt, setDropAt] = useState(null);   // { key, index }

  const onChipDragOver = (e, key, index) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    const at = { key, index: index + (after ? 1 : 0) };
    if (dropAt?.key !== at.key || dropAt?.index !== at.index) setDropAt(at);
  };
  const onBoxDragOver = (e, key) => {
    if (!dragId) return;
    e.preventDefault();
    if (dropAt?.key !== key) setDropAt({ key, index: (layout[key] ?? []).length });
  };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragId && dropAt) setLayoutDraft(moveInLayout(layout, dragId, dropAt.key, dropAt.index));
    setDragId(null);
    setDropAt(null);
  };
  const endDrag = () => { setDragId(null); setDropAt(null); };

  const byId = Object.fromEntries(skills.map((s) => [s._id, s]));
  const counts = Object.fromEntries(sectionKeys.map((k) => [k, (layout[k] ?? []).length]));
  // Skills whose section no longer exists (the API moves or deletes them, so
  // this should not happen) are listed rather than silently lost.
  const orphans = skills.filter((s) => !sectionKeys.includes(s.category));
  const confirmTarget = byId[confirmId];

  const chip = (s, key, i, last) => {
    const classes = [a.chip];
    if (s._id === editingId) classes.push(styles.chipActive);
    if (s._id === dragId) classes.push(styles.chipDragging);
    if (key && dropAt?.key === key && dropAt.index === i) classes.push(styles.dropBefore);
    if (key && last && dropAt?.key === key && dropAt.index === i + 1) classes.push(styles.dropAfter);
    return (
      <li
        key={s._id}
        className={classes.join(' ')}
        draggable={key ? canDrag : false}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', s._id);   // Firefox will not drag without data
          setDragId(s._id);
        }}
        onDragEnd={endDrag}
        onDragOver={key ? (e) => onChipDragOver(e, key, i) : undefined}
        onDrop={key ? onDrop : undefined}
      >
        {/* The chip body opens the editor — a real button, so a keyboard
            reaches it. */}
        <button
          type="button"
          className={styles.chipEdit}
          onClick={() => startEdit(s)}
          // ⚠️ Opening a skill resets the staged layout (open → discard), so
          // while a drag is unsaved a click here would silently throw the new
          // arrangement away. Save or revert it first — the note says so.
          disabled={!saved && layoutDirty}
          aria-label={`Edit ${s.name}`}
          aria-pressed={s._id === editingId}
        >
          <span>{s.name}</span>
          <span className={`${a.chipMeta} ${styles.chipLevel}`}>· {s.level}</span>
        </button>
        <button
          type="button"
          className={a.btnIcon}
          onClick={() => setConfirmId(s._id)}
          aria-label={`Delete ${s.name}`}
        >
          ×
        </button>
      </li>
    );
  };

  return (
    <div className={a.stack}>
      <section className={a.panel} aria-labelledby="skill-form-title">
        <div className={styles.cardHead}>
          {/* h2: AdminLayout renders the panel name as the page's h1. */}
          <h2 className={styles.cardTitle} id="skill-form-title">
            {saved ? 'Edit skill' : 'Add new skill'}
          </h2>
          <span className={a.spacer} />
          {saved && (
            <button type="button" className={styles.cancelEdit} onClick={() => open(null)}>
              CANCEL EDIT
            </button>
          )}
        </div>

        {/* ⚠️ `noValidate` is mandatory — a native `required` bubble pre-empts
            onSubmit, so the guard would never run. */}
        <form
          className={a.form}
          noValidate
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          {guard.errors.length > 0 && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>
                CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
                {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
              </span>
            </div>
          )}

          {/* Server failures — a SEPARATE channel from field marks. */}
          {saveErrors.length > 0 && (
            <div className={a.bannerError} role="alert">
              <span className={a.bannerDot} aria-hidden="true" />
              <span>{saveErrors.join(' ')}</span>
            </div>
          )}

          {/* Admin.dc.html:312 — one wrapping row, button on the baseline. */}
          <div className={styles.fieldRow}>
            <div className={styles.nameField}>
              <label className={a.label} htmlFor={`${FID}-name`}>Skill name</label>
              <input
                {...fieldProps(guard.errors, FID, 'name')}
                className={a.input}
                required
                placeholder="e.g. TypeScript"
                value={form.name}
                onChange={(e) => edit({ name: e.target.value }, 'name')}
              />
              <FieldError field="name" guard={guard} />
            </div>

            <div className={styles.categoryField}>
              <label className={a.label} htmlFor={`${FID}-category`}>Category</label>
              <select
                {...fieldProps(guard.errors, FID, 'category')}
                className={a.select}
                value={form.category}
                onChange={(e) => edit({ category: e.target.value }, 'category')}
              >
                {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <FieldError field="category" guard={guard} />
            </div>

            <div className={styles.levelField}>
              <label className={a.label} htmlFor={`${FID}-level`}>Level</label>
              <select
                {...fieldProps(guard.errors, FID, 'level')}
                className={a.select}
                value={form.level}
                onChange={(e) => edit({ level: e.target.value }, 'level')}
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <FieldError field="level" guard={guard} />
            </div>

            {!saved && (
              <button
                key={`add-${guard.shakeKey}`}
                type="submit"
                className={`${a.btnPrimary} ${styles.addButton} ${guard.shaking ? a.shake : ''}`}
                onAnimationEnd={guard.onShakeEnd}
                disabled={!dirty || saving}
              >
                {saving ? 'ADDING…' : '+ ADD SKILL'}
              </button>
            )}
          </div>

          {saved && (
            <div className={styles.positionRow}>
              <span className={`${a.label} ${styles.positionLabel}`}>Position in section</span>
              {categoryChanged ? (
                <span className={styles.positionNote}>
                  Moves to the end of {(labelOf[form.category] ?? '').toUpperCase()} on save.
                </span>
              ) : (
                <span className={styles.positionControls}>
                  <button
                    type="button"
                    className={a.btnRow}
                    onClick={() => move(-1)}
                    disabled={position <= 0}
                    aria-label={`Move ${saved.name} earlier`}
                  >
                    ◀
                  </button>
                  <span className={styles.positionNote} aria-live="polite">
                    {position + 1} of {card.length} in {(labelOf[saved.category] ?? '').toUpperCase()}
                  </span>
                  <button
                    type="button"
                    className={a.btnRow}
                    onClick={() => move(1)}
                    disabled={position === -1 || position >= card.length - 1}
                    aria-label={`Move ${saved.name} later`}
                  >
                    ▶
                  </button>
                </span>
              )}
            </div>
          )}

          {saved && (
            <div className={styles.saveRow}>
              <button
                key={`save-${guard.shakeKey}`}
                type="submit"
                className={`${a.btnPrimary} ${guard.shaking ? a.shake : ''}`}
                onAnimationEnd={guard.onShakeEnd}
                disabled={!dirty || saving}
              >
                {saving ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
              {dirty && !saving && (
                <button type="button" className={a.btnGhost} onClick={discard}>
                  REVERT CHANGES
                </button>
              )}
              {dirty && !saving && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
            </div>
          )}
        </form>
      </section>

      <section className={a.panel} aria-labelledby="skill-list-title">
        {/* `{{ skillsCountLabel }}` — Admin.dc.html:1139. */}
        <h2 className={styles.listTitle} id="skill-list-title">
          All skills ({skills.length})
        </h2>
        {!isLoading && skills.length > 1 && (
          <p className={styles.cardNote}>
            {!canDrag
              ? 'Dragging is paused while a skill is open above.'
              : layoutDirty
                ? 'Save or revert the new order before editing a skill.'
                : 'Drag a skill to reorder it, or into another section. Click one to edit it.'}
          </p>
        )}

        {orderErrors.length > 0 && (
          <div className={a.bannerError} role="alert">
            <span className={a.bannerDot} aria-hidden="true" />
            <span>{orderErrors.join(' ')}</span>
          </div>
        )}

        {isLoading ? (
          <div className={styles.chipRow} aria-busy="true">
            {[1, 2, 3, 4, 5].map((n) => <span key={n} className={a.skelPill} />)}
          </div>
        ) : skills.length === 0 && categories.length === 0 ? (
          <p className={a.emptyState}>No skills yet. Add one above.</p>
        ) : (
          <div className={styles.groups}>
            {categories.map(({ key, label }) => {
              const ids = (layout[key] ?? []).filter((id) => byId[id]);
              return (
                <div key={key}>
                  <h3 className={styles.groupLabel}>{label}</h3>
                  <ul
                    className={`${styles.chipRow} ${styles.dropBox} ${dropAt?.key === key ? styles.dropBoxActive : ''}`}
                    role="list"
                    aria-label={`${label} skills`}
                    onDragOver={(e) => onBoxDragOver(e, key)}
                    onDrop={onDrop}
                  >
                    {ids.map((id, i) => chip(byId[id], key, i, i === ids.length - 1))}
                    {ids.length === 0 && (
                      <li className={styles.emptyBox}>
                        Empty — not shown on the home page.{' '}
                        {canDrag ? 'Drag a skill here, or pick' : 'Pick'} this section when adding one.
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
            {orphans.length > 0 && (
              <div>
                <h3 className={styles.groupLabel}>Not in any section</h3>
                <ul className={styles.chipRow} role="list">
                  {orphans.map((s, i) => chip(s, null, i, false))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!saved && layoutDirty && (
          <div className={`${styles.saveRow} ${styles.orderBar}`}>
            <button type="button" className={a.btnPrimary} onClick={saveOrder} disabled={savingOrder}>
              {savingOrder ? 'SAVING…' : 'SAVE ORDER'}
            </button>
            {!savingOrder && (
              <button type="button" className={a.btnGhost} onClick={() => setLayoutDraft(null)}>
                REVERT ORDER
              </button>
            )}
            {!savingOrder && <span className={styles.unsaved}>UNSAVED ORDER</span>}
          </div>
        )}
      </section>

      {!isLoading && <SkillSectionsCard categories={categories} counts={counts} />}

      {confirmId && (
        <ConfirmDialog
          title="Delete skill?"
          busy={deleteSkill.isPending}
          onCancel={() => setConfirmId(null)}
          onConfirm={handleDelete}
        >
          This will permanently remove &ldquo;{confirmTarget?.name ?? 'this skill'}&rdquo; from
          your portfolio and cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
