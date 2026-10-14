import { useState } from 'react';
import a from '../../styles/admin.module.css';

/**
 * PF-117 — what a panel shows when its data could not be loaded.
 *
 * Before this, every list panel fell through to its EMPTY state on a failed
 * fetch: TanStack's `data` defaults to `[]`, `isLoading` goes false, and the
 * panel announced "No projects yet. Add one above." with a count of 0 — the
 * admin telling the owner their content was gone. About was worse: it
 * derives its form from `about`, so a failed fetch rendered an EMPTY,
 * EDITABLE profile whose "saved" baseline was also empty. Measured with the
 * backend stopped (PF-117 report).
 *
 * Owner-approved wording, 2026-10-11: short by default, and a RETRY that
 * fails again must SAY so — pressing it and seeing the same sentence reads
 * as "the button does nothing".
 *
 * `retried` is set in the click handler, never derived from the query's
 * error count: that count survives a remount, so a panel re-opened after an
 * earlier failure would greet the owner with "still" before they had
 * retried anything.
 *
 * @param what   the thing that did not load, upper case ("YOUR PROJECTS")
 * @param query  { refetch, isFetching } — one query result, or a merged pair
 */
export function LoadError({ what, query }) {
  const [retried, setRetried] = useState(false);
  const { refetch, isFetching } = query;

  const message = retried && !isFetching
    ? 'STILL CAN’T REACH THE SERVER — TRY AGAIN IN A MINUTE.'
    : `COULDN’T LOAD ${what}`;

  return (
    /* role="alert": the panel's content is missing, which is worth
       interrupting for — unlike the save flash, which is role="status". */
    <div className={a.loadError} role="alert">
      <span aria-hidden="true" className={a.bannerDot} />
      <span className={a.loadErrorText}>{message}</span>
      <button
        type="button"
        className={a.loadErrorAction}
        disabled={isFetching}
        onClick={() => { setRetried(true); refetch(); }}
      >
        {isFetching ? 'RETRYING…' : 'RETRY'}
      </button>
    </div>
  );
}
