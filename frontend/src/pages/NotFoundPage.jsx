/* frontend/src/pages/NotFoundPage.jsx */
import { ErrorPage } from '../components/common/ErrorPage';

/**
 * The 404 page. Since PF-144 (owner, 2026-11-03: "make full size error pages
 * all the same look and feel … smaller, like an error message") it renders
 * through the shared `ErrorPage`, as "CV not available" does — the old 64px
 * uppercase display heading and its own stylesheet are gone.
 */
export function NotFoundPage() {
  return (
    <ErrorPage
      label="ERROR 404"
      title="Page not found"
      actions={[
        { label: '← BACK TO HOME', to: '/' },
        { label: 'FIELD NOTES →', to: '/blog' },
      ]}
    >
      This page doesn’t exist. It may have moved, or the link may be mistyped.
    </ErrorPage>
  );
}

export default NotFoundPage;
