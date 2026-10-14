// frontend/src/test/renderWithGuard.jsx
//
// PF-118 batch 2 — render admin UI inside the unsaved-changes guard, under a
// DATA router (the guard's `useBlocker` throws under a plain MemoryRouter).
// `/elsewhere` exists so a test can follow a <Link> and see whether it left;
// `history` lets one start with a page BEHIND /admin, so Back can be pressed.
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { UnsavedChangesProvider } from '../components/admin/UnsavedChangesProvider';

export function renderWithGuard(ui, { history = ['/admin'] } = {}) {
  const router = createMemoryRouter([
    { path: '/admin', element: <UnsavedChangesProvider>{ui}</UnsavedChangesProvider> },
    { path: '/elsewhere', element: <p>ELSEWHERE PAGE</p> },
  ], { initialEntries: history, initialIndex: history.length - 1 });
  return { router, ...render(<RouterProvider router={router} />) };
}
