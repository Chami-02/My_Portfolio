import { useSearchParams } from 'react-router-dom';
import { ErrorPage } from '../components/common/ErrorPage';
import { CV_HREF } from '../utils/resume';

/**
 * PF-144 — where DOWNLOAD CV lands when the CV cannot be served. The button
 * is a plain link, so the failure is a page the BROWSER opens; the API sends
 * a browser here (GET /api/resume, `resumeProblem`). The shared `ErrorPage`
 * layout, like the 404 (owner, 2026-11-03: all full-page errors alike).
 *
 * `?reason=`:
 *   missing → no CV has been uploaded: offer the contact form, no retry
 *   (else)  → it could not be fetched this time: offer TRY AGAIN as well
 */
export function CvUnavailablePage() {
  const [params] = useSearchParams();
  const missing = params.get('reason') === 'missing';

  return missing ? (
    <ErrorPage
      label="DOWNLOAD CV"
      title="CV not available yet"
      actions={[
        { label: 'GET IN TOUCH →', to: '/?nosplash=1#contact' },
        { label: '← BACK TO HOME', to: '/' },
      ]}
    >
      There’s no CV to download just yet. Send me a message and I’ll share it with you.
    </ErrorPage>
  ) : (
    <ErrorPage
      label="DOWNLOAD CV"
      title="The CV couldn’t be downloaded"
      actions={[
        { label: 'TRY AGAIN ↓', href: CV_HREF, download: true },
        { label: 'GET IN TOUCH →', to: '/?nosplash=1#contact' },
      ]}
    >
      This is usually temporary. Please try again in a moment, or send me a message.
    </ErrorPage>
  );
}

export default CvUnavailablePage;
