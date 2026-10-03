import { useState } from 'react';
import { useVocabulary, useCreateVocabulary, useDeleteVocabulary,
         useVocabularyImpact } from '../../hooks/useVocabulary';
import { hasTag } from '../../utils/blogForm';
import { ConfirmDialog } from './ConfirmDialog';
import a      from '../../styles/admin.module.css';
import styles from './VocabularyPicker.module.css';

// What each vocabulary is called in the words a person reads. The impact
// count's own noun ("projects", "blog posts") comes from the SERVER.
const NOUNS = {
  tag:  { one: 'tag',  list: 'tag list',  usedBy: 'posts' },
  tech: { one: 'tech', list: 'tech list', usedBy: 'projects' },
};

/**
 * Confirm deleting a value from the shared vocabulary.
 *
 * ⚠️ This is not "remove from this record". `DELETE /api/vocabulary/:type/:id`
 * deletes the row AND `$pull`s the value out of every document carrying it.
 * So the dialog states the real blast radius, using the count the server
 * itself reports — locked decision: "Vocabulary deletion is hard-delete with
 * cascade, behind an impact-count confirm." A generic "are you sure?" would be
 * worse than none, because it implies the consequence has been checked.
 *
 * ⚠️ The confirm stays DISABLED until the count arrives: "removes it from 0"
 * while the request is in flight is indistinguishable from a genuine zero.
 */
function ChipDeleteConfirm({ type, chip, onCancel, onConfirm, isDeleting }) {
  const { data: impact, isLoading, isError } = useVocabularyImpact(type, chip._id);
  const noun = NOUNS[type];

  const affected = impact?.affected;
  const label    = impact?.label || noun.usedBy;
  const known    = typeof affected === 'number';

  return (
    <ConfirmDialog
      title={`Remove “${chip.value}” from the ${noun.list}?`}
      confirmLabel="YES, REMOVE"
      busyLabel="REMOVING…"
      busy={isDeleting}
      confirmDisabled={!known}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {isLoading && `Checking how many ${noun.usedBy} use it…`}
      {isError   && `Could not check how many ${noun.usedBy} use this ${noun.one}. It is safer to cancel.`}
      {known && (
        affected === 0
          ? `This deletes the ${noun.one} permanently. No ${label} currently use it.`
          : `This deletes the ${noun.one} permanently and removes it from ${affected} ` +
            `${affected === 1 ? label.replace(/s$/, '') : label}. This cannot be undone.`
      )}
    </ConfirmDialog>
  );
}

/**
 * A shared vocabulary, as a chip picker — `type` is 'tag' (blog posts, PF-97)
 * or 'tech' (projects, PF-113).
 *
 * Extracted from AdminBlogPanel in PF-113 when Projects became the second
 * consumer. The API behind it was built in Sprint 9 (PF-61 / PF-62).
 *
 * Three distinct actions, and the design is explicit that they differ
 * (Admin.dc.html:237): "CLICK TO PICK · ✓ = SELECTED · × REMOVES IT FROM THIS
 * LIST".
 *
 *   click the label → toggles the value on THIS record      (local, staged)
 *   + ADD           → adds a chip to the pool               (POST)
 *   ×               → DELETES the value from the pool AND strips it from every
 *                     document that carries it              (DELETE, cascading)
 *
 * @param selected   the record's comma-separated value string
 * @param onToggle   (value) => void — pick / unpick on this record
 * @param onRemoved  (value, result) => void — strip a deleted value from the
 *                   form in hand, which a refetch cannot do while it is edited
 * @param onError    (message) => void
 */
export function VocabularyPicker({ type, selected, onToggle, onRemoved, onError }) {
  const { data: chips = [], isLoading } = useVocabulary(type);
  const createValue = useCreateVocabulary(type);
  const deleteValue = useDeleteVocabulary(type);
  const noun = NOUNS[type];
  const addLabel = `+ ADD ${noun.one.toUpperCase()}`;

  const [draft,   setDraft]   = useState('');
  const [pending, setPending] = useState(null); // the chip awaiting confirmation

  const add = async () => {
    const value = draft.trim();
    if (!value) return;

    // Already in the pool: pick it rather than sending a POST that would 409.
    // The design does the same — addChip() falls through to toggleChip().
    const existing = chips.find((c) => c.value.toLowerCase() === value.toLowerCase());
    if (existing) {
      if (!hasTag(selected, existing.value)) onToggle(existing.value);
      setDraft('');
      return;
    }

    try {
      const created = await createValue.mutateAsync(value);
      onToggle(created.value);   // a value you just added is one you want
      setDraft('');
    } catch (err) {
      onError(err.response?.data?.message || `Could not add "${value}".`);
    }
  };

  const confirmRemove = async () => {
    const chip = pending;
    setPending(null);
    try {
      const result = await deleteValue.mutateAsync(chip._id);
      onRemoved(chip.value, result);
    } catch (err) {
      onError(err.response?.data?.message || `Could not remove "${chip.value}".`);
    }
  };

  return (
    <div className={styles.box}>
      <p className={styles.hint}>Click to pick · ✓ = selected · × removes it from this list</p>

      {isLoading ? (
        <div className={styles.skel} aria-busy="true">
          {[1, 2, 3, 4].map((n) => <span key={n} className={a.skelPill} />)}
        </div>
      ) : chips.length === 0 ? (
        <p className={styles.empty}>No {noun.one}s in the list yet — add one below.</p>
      ) : (
        <div className={styles.chips}>
          {chips.map((chip) => {
            const on = hasTag(selected, chip.value);
            return (
              <span key={chip._id} className={on ? styles.chipOn : styles.chip}>
                <button type="button" className={styles.pick} onClick={() => onToggle(chip.value)}
                  title={on ? 'Click to unpick' : 'Click to add'} aria-pressed={on}>
                  {on ? '✓ ' : '+ '}{chip.value}
                </button>
                <button type="button" className={styles.remove} onClick={() => setPending(chip)}
                  title="Remove from the list"
                  aria-label={`Remove ${chip.value} from the ${noun.list}`}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className={styles.addRow}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter must not submit the record — this input lives inside its
            // <form>, where Enter is a submit by default.
            if (e.key === 'Enter') { e.preventDefault(); add(); }
          }}
          placeholder={`New ${noun.one} name…`}
          aria-label={`New ${noun.one} name`}
          className={`${a.inputPill} ${styles.addInput}`}
        />
        <button type="button" className={styles.addBtn} onClick={add}
          disabled={createValue.isPending || !draft.trim()}>
          {createValue.isPending ? 'ADDING…' : addLabel}
        </button>
      </div>

      {pending && (
        <ChipDeleteConfirm
          type={type}
          chip={pending}
          onCancel={() => setPending(null)}
          onConfirm={confirmRemove}
          isDeleting={deleteValue.isPending}
        />
      )}
    </div>
  );
}
