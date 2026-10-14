// frontend/src/components/admin/UnsavedChangesProvider.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from './ConfirmDialog';
import { UnsavedChangesContext } from './UnsavedChangesContext';

/**
 * PF-118 batch 2 — nothing the owner has typed in an admin panel is lost by
 * leaving it.
 *
 * Before this, switching panels UNMOUNTED the open one, and every staged edit
 * or half-made record in it was silently thrown away; so was editing a
 * different record inside a panel. Every exit now asks first:
 *
 *   in-app   sidebar / phone strip, SIGN OUT, a panel's own record switches
 *            → `requestLeave(proceed)`
 *   router   ↗ HOME, ← BACK TO HOME PAGE, browser Back/Forward
 *            → `useBlocker` (needs the data router — see App.jsx)
 *   browser  reload, close tab, a typed URL
 *            → `beforeunload`; the browser draws its own prompt and its wording
 *              cannot be changed
 *
 * ⚠️ REVERSES a standing requirement on purpose. Since 2026-09-25 the
 * UNSAVED CHANGES marker was "deliberately a marker, not a navigation blocker
 * or a beforeunload dialog". Owner, 2026-10-12, asked for exactly this guard.
 *
 * The panel's state lives in a REF (`entryRef`, written through `register` by
 * `useUnsavedChanges`) and is read at the moment of leaving, so typing never
 * re-renders the shell and no effect sets state. The dialog's WORDS are
 * snapshotted into state at that same moment — an event (a click, or the router
 * asking the blocker) — because render may not read a ref.
 */
export function UnsavedChangesProvider({ children }) {
  const entryRef = useRef(null);
  // Set while an approved exit that LEAVES /admin is under way (sign out, a
  // blocked link the owner chose to follow), so the navigation it triggers is
  // not stopped a second time by the blocker or by beforeunload. It never needs
  // resetting: leaving /admin unmounts this provider.
  const leavingRef = useRef(false);
  const [pending, setPending] = useState(null);
  // The words for a router-blocked navigation, captured when the router asks.
  const [blockedWords, setBlockedWords] = useState(null);

  /** What the dialog says — never the `save` function, which stays in the ref. */
  const words = () => ({
    what:      entryRef.current?.what,
    saveLabel: entryRef.current?.saveLabel,
    canSave:   typeof entryRef.current?.save === 'function',
  });

  const register = useCallback((entry) => {
    entryRef.current = entry;
    return () => { if (entryRef.current === entry) entryRef.current = null; };
  }, []);

  const isDirty = useCallback(
    () => Boolean(entryRef.current?.dirty) && !leavingRef.current, []);

  const requestLeave = useCallback((proceed, { leavingAdmin = false } = {}) => {
    const go = () => {
      if (leavingAdmin) leavingRef.current = true;
      proceed();
    };
    if (!(entryRef.current?.dirty)) { go(); return; }
    setPending({ proceed: go, cancel: () => {}, words: words() });
  }, []);

  // ⚠️ A FUNCTION, evaluated at navigation time — it reads the ref, so the
  // blocker always sees the panel's latest dirty flag without re-rendering.
  // Only a change of page counts: a hash-only change is not leaving.
  //
  // The router calls this during NAVIGATION, never during render, which is why
  // it may snapshot the dialog's words into state.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const block = isDirty() &&
      (currentLocation.pathname !== nextLocation.pathname ||
       currentLocation.search !== nextLocation.search);
    if (block) setBlockedWords(words());
    return block;
  });

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty()) return;
      e.preventDefault();
      // Legacy browsers only show the prompt when returnValue is set.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Derived during render, not mirrored into state: a blocked router
  // navigation IS an open question. Plain values only — the handlers below
  // touch refs, so they run in events, never here.
  const blocked = blocker.state === 'blocked';
  const isOpen  = blocked || pending !== null;
  const dialogWords = blocked ? blockedWords : pending?.words;

  const proceedLeave = () => {
    if (blocked) { leavingRef.current = true; blocker.proceed(); } else pending?.proceed();
  };
  const cancelLeave = () => {
    if (blocked) blocker.reset(); else pending?.cancel();
  };

  const close = () => setPending(null);
  const value = useMemo(() => ({ register, requestLeave }), [register, requestLeave]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {isOpen && (
        <LeaveDialog
          words={dialogWords}
          onKeep={() => { cancelLeave(); close(); }}
          onDiscard={() => { close(); proceedLeave(); }}
          onSave={async () => {
            // The panel's REAL save: an invalid form is refused there, marked
            // and focused, and we stay. Only a save that fully landed leaves.
            const ok = await Promise.resolve(entryRef.current?.save?.()).catch(() => false);
            close();
            if (ok) proceedLeave(); else cancelLeave();
          }}
        />
      )}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * The question itself — the admin's one ConfirmDialog, so it shares the
 * delete confirm's focus trap, Escape and backdrop behaviour.
 *
 * KEEP EDITING is the focused, Escape and backdrop answer: the only choice that
 * can never lose anything. SAVE is offered only when the panel has one save to
 * run (Skills with BOTH fields and order pending has two, so it is Keep /
 * Discard there).
 */
function LeaveDialog({ words, onKeep, onDiscard, onSave }) {
  const [saving, setSaving] = useState(false);
  const what = words?.what || 'this panel';
  const canSave = Boolean(words?.canSave);

  return (
    <ConfirmDialog
      title="Unsaved changes"
      onCancel={onKeep}
      cancelLabel="KEEP EDITING"
      onConfirm={canSave ? async () => { setSaving(true); await onSave(); } : null}
      confirmLabel={words?.saveLabel || 'SAVE'}
      confirmTone="primary"
      busy={saving}
      busyLabel="SAVING…"
      secondary={{ label: 'DISCARD & LEAVE', onClick: onDiscard }}
    >
      {`${what.charAt(0).toUpperCase()}${what.slice(1)} has changes that are not saved yet. `}
      {canSave ? 'Save before you go, or they will be lost.' : 'Go back and save, or they will be lost.'}
    </ConfirmDialog>
  );
}
