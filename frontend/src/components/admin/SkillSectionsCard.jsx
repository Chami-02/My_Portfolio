import { useState } from 'react';
import {
  useCreateSkillCategory, useRenameSkillCategory, useReorderSkillCategories, useDeleteSkillCategory,
} from '../../hooks/useSkillCategories';
import { useFormGuard } from '../../hooks/useFormGuard';
import { useAdminFlash } from '../../hooks/useAdminFlash';
import { sectionErrors, newSectionErrors, moveWithin } from '../../utils/skillForm';
import { fieldProps, errorId } from '../../utils/formErrors';
import { messageFor } from '../../utils/mediaFile';
import { ConfirmDialog } from './ConfirmDialog';
import a      from '../../styles/admin.module.css';
import styles from './panels/AdminSkillsPanel.module.css';

const FID = 'section';

const validateLabels = (labels) => sectionErrors(labels);
const validateNew = ({ label, categories }) => newSectionErrors(label, categories);

function FieldError({ field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return <p className={a.fieldError} id={errorId(FID, field)} role="alert">{message}</p>;
}

/**
 * PF-114 — the owner's Skills SECTIONS (owner, 2026-10-05): "when i want to add
 * a new skill section like soft skill… the admin panel should have the ability
 * to create a new skill category." No prototype source.
 *
 *  - ADD creates at once — like ADD SKILL, the add is its own save. An empty
 *    section is invisible on the home page, so this publishes nothing.
 *  - RENAME and ▲ ▼ are STAGED (the admin-wide rule) behind SAVE SECTIONS /
 *    REVERT.
 *  - × asks first, with the owner's three choices: CANCEL, MOVE & DELETE (pick
 *    where the skills go), or DELETE SECTION + N SKILLS — the only red one,
 *    because it is the only one that loses data.
 *
 * @param categories  sections, already in display order
 * @param counts      `{ [key]: number }` — skills per section
 */
export function SkillSectionsCard({ categories, counts }) {
  const create  = useCreateSkillCategory();
  const rename  = useRenameSkillCategory();
  const reorder = useReorderSkillCategories();
  const remove  = useDeleteSkillCategory();

  // ── Staged renames + order, reconciled with the latest list ───────────────
  const [labelDraft, setLabelDraft] = useState(null);   // { [id]: label }
  const [orderDraft, setOrderDraft] = useState(null);   // ids[]
  const storedOrder = categories.map((c) => c._id);
  const byId = Object.fromEntries(categories.map((c) => [c._id, c]));
  // A section deleted or added meanwhile must not leave the staged order stale.
  const order = orderDraft
    ? [...orderDraft.filter((id) => byId[id]), ...storedOrder.filter((id) => !orderDraft.includes(id))]
    : storedOrder;
  const labels = Object.fromEntries(categories.map((c) => [c._id, labelDraft?.[c._id] ?? c.label]));

  const renamed = categories.filter((c) => labels[c._id].trim() !== c.label);
  const reordered = order.join() !== storedOrder.join();
  const dirty = renamed.length > 0 || reordered;

  const guard    = useFormGuard(validateLabels, FID);
  const addGuard = useFormGuard(validateNew, FID);

  const [newLabel, setNewLabel] = useState('');
  const [errors, setErrors]     = useState([]);
  const [saving, setSaving]     = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [moveTo, setMoveTo]     = useState('');

  const { showFlash } = useAdminFlash();

  const discard = () => {
    setLabelDraft(null);
    setOrderDraft(null);
    setErrors([]);
    guard.reset();
  };

  const add = async (e) => {
    e.preventDefault();
    if (!addGuard.check({ label: newLabel, categories })) return;
    setErrors([]);
    try {
      await create.mutateAsync(newLabel.trim());
      setNewLabel('');
      showFlash('Section added');
    } catch (err) {
      setErrors([`Section: ${messageFor(err)}`]);
    }
  };

  const save = async () => {
    if (!guard.check(labels)) return;
    setErrors([]);
    setSaving(true);
    const failures = [];
    for (const c of renamed) {
      try {
        await rename.mutateAsync({ id: c._id, label: labels[c._id].trim() });
      } catch (err) {
        failures.push(`"${labels[c._id].trim()}": ${messageFor(err)}`);
      }
    }
    if (reordered) {
      try {
        await reorder.mutateAsync(order);
      } catch (err) {
        failures.push(`Order: ${messageFor(err)}`);
      }
    }
    setSaving(false);
    if (failures.length) { setErrors(failures); return; }
    discard();
    showFlash('Sections saved');
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const target = byId[confirmId];
  const targetCount = target ? counts[target.key] ?? 0 : 0;
  const others = categories.filter((c) => c._id !== confirmId);

  const openDelete = (id) => {
    setConfirmId(id);
    // Default the destination to "Other" when it is a choice, else the first.
    const rest = categories.filter((c) => c._id !== id);
    setMoveTo((rest.find((c) => c.key === 'other') ?? rest[0])?._id ?? '');
  };

  const doDelete = async (choice) => {
    try {
      await remove.mutateAsync({ id: confirmId, choice });
      showFlash(choice.deleteSkills ? 'Section and its skills deleted'
        : choice.moveTo ? 'Skills moved, section deleted' : 'Section deleted');
    } catch (err) {
      setErrors([`Delete: ${messageFor(err)}`]);
    }
    setConfirmId(null);
  };

  const n = targetCount;
  const skillsWord = `${n} skill${n === 1 ? '' : 's'}`;

  return (
    <section className={a.panel} aria-labelledby="sections-title">
      <h2 className={styles.listTitle} id="sections-title">Sections ({categories.length})</h2>
      <p className={styles.cardNote}>
        The boxes on the home page&rsquo;s Skills section. A box appears there once it has a skill.
      </p>

      {guard.errors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>
            CHECK THE CHANGES AGAIN — {guard.errors.length}{' '}
            {guard.errors.length === 1 ? 'field needs' : 'fields need'} attention.
          </span>
        </div>
      )}
      {errors.length > 0 && (
        <div className={a.bannerError} role="alert">
          <span className={a.bannerDot} aria-hidden="true" />
          <span>{errors.join(' ')}</span>
        </div>
      )}

      <ol className={styles.sectionList}>
        {order.map((id, i) => {
          const c = byId[id];
          const count = counts[c.key] ?? 0;
          return (
            <li key={id} className={styles.sectionRow}>
              <span className={styles.sectionArrows}>
                <button type="button" className={a.btnRow} disabled={i === 0}
                  onClick={() => setOrderDraft(moveWithin(order, id, -1))}
                  aria-label={`Move ${c.label} up`}>▲</button>
                <button type="button" className={a.btnRow} disabled={i === order.length - 1}
                  onClick={() => setOrderDraft(moveWithin(order, id, 1))}
                  aria-label={`Move ${c.label} down`}>▼</button>
              </span>
              <span className={styles.sectionName}>
                <label className={styles.srOnly} htmlFor={`${FID}-labels-${id}`}>Name of section {i + 1}</label>
                <input
                  {...fieldProps(guard.errors, FID, `labels.${id}`)}
                  className={a.input}
                  value={labels[id]}
                  onChange={(e) => {
                    setLabelDraft({ ...labels, [id]: e.target.value });
                    guard.clearField(`labels.${id}`);
                  }}
                />
                <FieldError field={`labels.${id}`} guard={guard} />
              </span>
              <span className={styles.sectionCount}>
                {count === 0 ? 'EMPTY' : `${count} SKILL${count === 1 ? '' : 'S'}`}
              </span>
              <button
                type="button"
                className={`${a.btnIcon} ${styles.sectionDelete}`}
                onClick={() => openDelete(id)}
                disabled={categories.length <= 1}
                aria-label={`Delete section ${c.label}`}
                title={categories.length <= 1 ? 'Keep at least one section' : undefined}
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>

      {dirty && (
        <div className={styles.saveRow}>
          <button
            key={`sections-${guard.shakeKey}`}
            type="button"
            className={`${a.btnPrimary} ${guard.shaking ? a.shake : ''}`}
            onAnimationEnd={guard.onShakeEnd}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'SAVING…' : 'SAVE SECTIONS'}
          </button>
          {!saving && (
            <button type="button" className={a.btnGhost} onClick={discard}>REVERT CHANGES</button>
          )}
          {!saving && <span className={styles.unsaved}>UNSAVED CHANGES</span>}
        </div>
      )}

      <form className={styles.addSection} noValidate onSubmit={add}>
        <div className={styles.nameField}>
          <label className={a.label} htmlFor={`${FID}-newLabel`}>New section</label>
          <input
            {...fieldProps(addGuard.errors, FID, 'newLabel')}
            className={a.input}
            required
            maxLength={40}
            placeholder="e.g. Soft Skills"
            value={newLabel}
            onChange={(e) => { setNewLabel(e.target.value); addGuard.clearField('newLabel'); }}
          />
          <FieldError field="newLabel" guard={addGuard} />
        </div>
        <button
          key={`add-section-${addGuard.shakeKey}`}
          type="submit"
          className={`${a.btnOutline} ${styles.addButton} ${addGuard.shaking ? a.shake : ''}`}
          onAnimationEnd={addGuard.onShakeEnd}
          disabled={newLabel === '' || create.isPending}
        >
          {create.isPending ? 'ADDING…' : '+ ADD SECTION'}
        </button>
      </form>

      {target && (
        targetCount === 0 ? (
          <ConfirmDialog
            title="Delete section?"
            busy={remove.isPending}
            onCancel={() => setConfirmId(null)}
            onConfirm={() => doDelete({})}
          >
            &ldquo;{target.label}&rdquo; is empty. It will be removed and cannot be brought back.
          </ConfirmDialog>
        ) : (
          <ConfirmDialog
            title="Delete section?"
            busy={remove.isPending}
            onCancel={() => setConfirmId(null)}
            confirmLabel="MOVE & DELETE"
            busyLabel="WORKING…"
            confirmTone="neutral"
            confirmDisabled={!moveTo}
            onConfirm={() => doDelete({ moveTo })}
            secondary={{
              label: `DELETE SECTION + ${skillsWord.toUpperCase()}`,
              onClick: () => doDelete({ deleteSkills: true }),
            }}
            extra={(
              <>
                <label className={a.label} htmlFor="section-move-to">Move {skillsWord} to</label>
                <select
                  id="section-move-to"
                  className={a.select}
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                >
                  {others.map((c) => <option key={c._id} value={c._id}>{c.label}</option>)}
                </select>
              </>
            )}
          >
            &ldquo;{target.label}&rdquo; still has {skillsWord}. Move {n === 1 ? 'it' : 'them'} to
            another section first, or delete the section together with {n === 1 ? 'it' : 'them'} —
            that cannot be undone.
          </ConfirmDialog>
        )
      )}
    </section>
  );
}
