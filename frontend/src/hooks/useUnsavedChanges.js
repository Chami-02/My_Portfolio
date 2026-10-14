// frontend/src/hooks/useUnsavedChanges.js
import { useContext, useEffect } from 'react';
import { UnsavedChangesContext } from '../components/admin/UnsavedChangesContext';

/**
 * PF-118 batch 2 — a panel tells the guard what it would lose.
 *
 * Owner, 2026-10-12: "mistakenly i press another section… not saving the
 * existing work… mention as a alert… edit this or save as draft or complete
 * this before go anywhere."
 *
 * @param entry.dirty      the panel's own dirty flag — the same one that lights
 *                         SAVE and shows UNSAVED CHANGES; never re-derived here
 * @param entry.save       `() => Promise<boolean>` — the panel's REAL save,
 *                         validation guard included. `true` only when every
 *                         part landed. Omit it when there is no single save to
 *                         offer (the dialog then shows Keep / Discard only).
 * @param entry.saveLabel  e.g. 'SAVE AS DRAFT' for a new record
 * @param entry.what       the noun for the dialog: 'your new project'
 *
 * Returns `requestLeave(proceed)` for the panel's OWN transitions (editing a
 * different record, + NEW, back to the list) — the same question, asked before
 * the form is overwritten. Outside the admin it simply runs `proceed`.
 *
 * ⚠️ Registered in an effect with NO dependency list, on purpose: the entry
 * must be the latest render's (a stale `save` would submit an old form). The
 * provider keeps it in a ref, so registering causes no render of its own.
 */
export function useUnsavedChanges(entry) {
  const ctx = useContext(UnsavedChangesContext);

  useEffect(() => (ctx ? ctx.register(entry) : undefined));

  return ctx ? ctx.requestLeave : (proceed) => proceed();
}

/**
 * The shell's half: `requestLeave` for exits that are not a panel's own — the
 * sidebar and SIGN OUT. A pass-through outside the guard (AdminLayout's own
 * tests render it bare).
 */
export function useRequestLeave() {
  const ctx = useContext(UnsavedChangesContext);
  return ctx ? ctx.requestLeave : (proceed) => proceed();
}
