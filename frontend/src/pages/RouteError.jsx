/* frontend/src/pages/RouteError.jsx */
import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { ErrorPage } from '../components/common/ErrorPage';
import { MESSAGES } from '../utils/friendlyError';

// The wording each browser uses when a page's code file does not arrive.
const FILE_DID_NOT_LOAD = /dynamically imported module|importing a module|error loading dynamically|loading chunk|loading css chunk/i;

const reload = () => window.location.reload();

/**
 * PF-149 — the router's own error screen. Without one, React Router shows its
 * developer page ("Unexpected Application Error! Hey developer"), which is what
 * a visitor saw when a page's file failed: a dropped connection, a new release
 * replacing the old files, or an ad blocker. Measured in the owner's Chrome.
 *
 * Statically imported in App.jsx, unlike the pages: it has to work when a lazy
 * file is exactly what failed. The raw error goes to the console, never the page.
 */
export function RouteError() {
  const error = useRouteError();

  useEffect(() => { console.error('Route error:', error); }, [error]);

  const fileFailed = FILE_DID_NOT_LOAD.test(String(error?.message ?? ''));

  return (
    <ErrorPage
      label="PAGE ERROR"
      title={fileFailed ? 'This page didn’t load' : 'Something went wrong'}
      actions={[
        { label: 'RELOAD', onClick: reload },
        { label: 'GO HOME', href: '/' },
      ]}
    >
      {fileFailed
        ? 'Please check your internet connection and reload. If it keeps happening, an ad blocker may be stopping it, so try turning it off for this site.'
        : MESSAGES.ourSide}
    </ErrorPage>
  );
}

export default RouteError;
