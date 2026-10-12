// frontend/src/components/admin/UnsavedChangesContext.js
//
// PF-118 batch 2 — the admin's unsaved-changes guard. The context lives in its
// own module because a provider file exports components only (React
// conventions, CLAUDE.md).
//
// Value: `{ register, requestLeave }`, or `null` outside the admin (panel tests
// render panels bare; `useUnsavedChanges` then does nothing).
//
//   register      — `(entry) => unregister`. The open panel registers
//                   `{ dirty, save, saveLabel, what }` after every render; the
//                   provider keeps it in a REF and reads it at the moment
//                   someone tries to leave, so typing never re-renders the shell.
//   requestLeave  — `(proceed, { leavingAdmin }?) => void`. Runs `proceed` at
//                   once when nothing is unsaved; otherwise asks first.
import { createContext } from 'react';

export const UnsavedChangesContext = createContext(null);
