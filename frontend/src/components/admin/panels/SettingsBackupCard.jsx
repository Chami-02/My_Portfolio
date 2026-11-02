// frontend/src/components/admin/panels/SettingsBackupCard.jsx
import { useRef, useState } from 'react';
import {
  useDownloadBackup, useCheckRestore, useRestoreBackup, useSafetyCopies, useDownloadSafetyCopy,
} from '../../../hooks/useBackup';
import { useAdminFlash }     from '../../../hooks/useAdminFlash';
import { useFormGuard }      from '../../../hooks/useFormGuard';
import { resetErrorMessage } from '../../../utils/resetError';
import { formatSent }        from '../../../utils/messageTime';
import { backupFileName, backupPickProblem, saveJson } from '../../../utils/backupFile';
import { ConfirmDialog }       from '../ConfirmDialog';
import { LoadError }           from '../LoadError';
import { PasswordConfirmForm } from '../PasswordConfirmForm';
import styles from './AdminSettingsPanel.module.css';
import a from '../../../styles/admin.module.css';

const FID = 'settings-backup';

// Module scope: useFormGuard's `check` is memoised on the validator.
const passwordErrors = ({ password }) =>
  (password ? [] : [{ field: 'password', message: 'Enter your password.' }]);

/** "4 projects · 26 skills · …" — the counts a file or safety copy holds. */
const countsText = (c = {}) => [
  `${c.projects ?? 0} projects`, `${c.skills ?? 0} skills`, `${c.skillCategories ?? 0} sections`,
  `${c.blog ?? 0} posts`, `${c.vocabulary ?? 0} tags & tech`, `${c.messages ?? 0} messages`,
  // PF-143 — last, so the six earlier counts read as they always have.
  `${c.education ?? 0} education`, `${c.certificates ?? 0} certificates`,
].join(' · ');

/** The reader's own clock, in the Messages panel's YYYY/MM/DD 12-hour form. */
const when = (iso) => { const t = formatSent(iso); return `${t.date} ${t.time}`; };

/** The server's list of reasons, when a 422 carried one. */
const problemsOf = (err) => (Array.isArray(err?.response?.data?.problems) ? err.response.data.problems : null);

/**
 * PF-135 — download everything the site says as one file, and restore such a
 * file (owner, 2026-10-30: "a download with no restore has no purpose").
 *
 * The restore follows the standard for restores (owner: "follow the standard
 * rules"): CHECK the file on the server and show what is in it → CONFIRM with
 * the password → the server replaces everything in one transaction, keeping
 * a safety copy first. A file that cannot be restored is refused whole, with
 * the reasons, and the site does not change. Messages are merged, never lost.
 *
 * Every action that hands out or replaces content asks for the password
 * (OWASP ASVS 5.0 V7.5), in the Sessions card's dialog. The buttons are
 * outlines; the red is in the restore dialog, where the decision is made.
 * No unsaved-changes guard: a typed password or a picked file is not work.
 */
export function SettingsBackupCard() {
  const download     = useDownloadBackup();
  const checkRestore = useCheckRestore();
  const restore      = useRestoreBackup();
  const safety       = useSafetyCopies();
  const downloadCopy = useDownloadSafetyCopy();
  const { showFlash } = useAdminFlash();

  // null | { kind: 'download' } | { kind: 'restore', file, summary } | { kind: 'safety', id }
  const [folded,   setFolded]   = useState(true);
  const [target,   setTarget]   = useState(null);
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  // Shown in the card: why a file cannot be restored, or why a download would not restore.
  const [notice,   setNotice]   = useState(null);
  const guard       = useFormGuard(passwordErrors, FID);
  const passwordRef = useRef(null);
  const fileRef     = useRef(null);

  const busy = download.isPending || restore.isPending || downloadCopy.isPending;

  const open = (next) => {
    setTarget(next);
    setPassword('');
    setError('');
    guard.reset();
  };
  const close = () => { if (!busy) setTarget(null); };

  const pick = async (file) => {
    setNotice(null);
    const problem = backupPickProblem(file);
    if (problem) {
      setNotice({ title: 'That file cannot be restored. Nothing was changed.', problems: [problem] });
      return;
    }
    try {
      const summary = await checkRestore.mutateAsync(file);
      open({ kind: 'restore', file, summary });
    } catch (err) {
      setNotice({
        title:    'This backup cannot be restored. Nothing was changed.',
        problems: problemsOf(err) ?? [resetErrorMessage(err)],
      });
    }
  };

  const confirm = async (e) => {
    e?.preventDefault();
    if (!guard.check({ password })) return;
    setError('');
    try {
      if (target.kind === 'download') {
        const { backup, problems } = await download.mutateAsync({ password });
        saveJson(backup, backupFileName(backup.createdAt));
        setTarget(null);
        setNotice(problems.length
          ? { title: 'Saved — but this backup cannot be restored until these are fixed in their panels. Then download again.', problems }
          : null);
        showFlash('Backup downloaded');
      } else if (target.kind === 'safety') {
        const copy = await downloadCopy.mutateAsync({ id: target.id, password });
        saveJson(copy, backupFileName(copy.createdAt, 'safety-copy'));
        setTarget(null);
        showFlash('Safety copy downloaded');
      } else {
        const result = await restore.mutateAsync({ file: target.file, password });
        setTarget(null);
        setNotice(null);
        showFlash(result.backupCreatedAt
          ? `Site restored from the backup of ${when(result.backupCreatedAt)}`
          : 'Site restored from the backup');
      }
    } catch (err) {
      const problems = problemsOf(err);
      if (problems) {
        // The file was refused on the second check — say why, in the card.
        setTarget(null);
        setNotice({ title: 'This backup cannot be restored. Nothing was changed.', problems });
        return;
      }
      setError(resetErrorMessage(err));
    }
  };

  const dialog = {
    download: {
      title: 'Download a backup?', tone: 'primary', confirm: 'DOWNLOAD', busy: 'PREPARING…',
      text: 'The file holds your visitors’ messages, names and emails. Keep it somewhere private. Confirm with your password.',
    },
    safety: {
      title: 'Download this safety copy?', tone: 'primary', confirm: 'DOWNLOAD', busy: 'PREPARING…',
      text: 'It holds the site as it was before a restore, messages included. To undo that restore, restore this file. Confirm with your password.',
    },
    restore: {
      title: 'Replace the site’s content with this backup?', tone: 'danger', confirm: 'RESTORE', busy: 'RESTORING…',
    },
  }[target?.kind];

  return (
    <section className={a.panel} aria-labelledby={`${FID}-title`}>
      {/* FOLDS like Password and Sessions (owner, 2026-10-30): one line,
          BACKUP & RESTORE ▾, sliding open with the same classes so the cards
          cannot drift. Focus stays on the toggle, as in Sessions. */}
      <div className={styles.disclosureHead}>
        <h2 className={a.panelTitle} id={`${FID}-title`}>Backup</h2>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={!folded}
          aria-controls={`${FID}-body`}
          onClick={() => setFolded((f) => !f)}
        >
          BACKUP &amp; RESTORE
          <span className={styles.chevron} aria-hidden="true">▾</span>
        </button>
      </div>

      <div
        id={`${FID}-body`}
        className={`${styles.collapse} ${folded ? '' : styles.collapseOpen}`}
        inert={folded}
      >
      <div className={styles.collapseInner}>
      <p className={styles.lede}>
        Everything the site says, as one file: About, projects, skills and their sections, blog
        posts (drafts too), tags and tech, and messages. Restore puts a file back if something goes
        wrong. Images and the résumé are saved as links. Your account, password and sessions are
        never in a backup and never changed by a restore.
      </p>

      {notice && (
        <div className={styles.problemBox} role="alert">
          <span>{notice.title}</span>
          <ul className={styles.problemList}>
            {notice.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={a.btnOutline} onClick={() => open({ kind: 'download' })}>
          DOWNLOAD BACKUP
        </button>
        <button
          type="button"
          className={a.btnOutline}
          onClick={() => fileRef.current?.click()}
          disabled={checkRestore.isPending}
        >
          {checkRestore.isPending ? 'CHECKING…' : 'RESTORE FROM FILE'}
        </button>
        {/* Clipped, not display:none (locked, PF-113). The button above is the
            control a keyboard meets, so the input leaves the tab order. */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className={a.fileInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so picking the SAME file again fires change again.
            e.target.value = '';
            if (file) pick(file);
          }}
        />
      </div>
      <p className={styles.note}>
        Keep copies in more than one place — say one on this computer and one in Google Drive.
      </p>

      <div className={styles.activity}>
        <h3 className={`${a.labelLead} ${styles.subhead}`} id={`${FID}-safety`}>Safety copies</h3>
        {safety.isError && <LoadError what="SAFETY COPIES" query={safety} />}
        {safety.isSuccess && safety.data.length === 0 && (
          <p className={styles.note}>
            None yet. Each restore first keeps a copy of what it replaces — the newest 3 are kept here.
          </p>
        )}
        {safety.isSuccess && safety.data.length > 0 && (
          <ul className={styles.sessions} aria-labelledby={`${FID}-safety`}>
            {safety.data.map((copy) => (
              <li key={copy.id} className={styles.session}>
                <div className={styles.sessionText}>
                  <p className={styles.sessionDevice}>
                    <span className={styles.value}>Before a restore · {when(copy.createdAt)}</span>
                  </p>
                  <p className={styles.sessionMeta}>{countsText(copy.counts)}</p>
                </div>
                <button type="button" className={a.btnRow} onClick={() => open({ kind: 'safety', id: copy.id })}>
                  DOWNLOAD
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
      </div>

      {/* Outside the fold: an `inert` ancestor would make the dialog unusable. */}
      {target && (
        <ConfirmDialog
          title={dialog.title}
          onConfirm={confirm}
          onCancel={close}
          confirmTone={dialog.tone}
          confirmLabel={dialog.confirm}
          busyLabel={dialog.busy}
          busy={busy}
          initialFocusRef={passwordRef}
          extra={(
            <>
              {/* In `extra`, not the text: ConfirmDialog's text is a <p>, and a
                  list inside a <p> is invalid HTML. */}
              {target.kind === 'restore' && (
                <ul className={styles.summary}>
                  <li>{countsText(target.summary.counts)}</li>
                  <li>About, projects, skills, sections, blog posts and tags &amp; tech are replaced by the backup.</li>
                  <li>Every message you have now is kept; messages missing since come back.</li>
                  <li>A safety copy of the site as it is now is kept first.</li>
                </ul>
              )}
              <PasswordConfirmForm
                fid={FID}
                guard={guard}
                inputRef={passwordRef}
                password={password}
                onPasswordChange={setPassword}
                error={error}
                onSubmit={confirm}
              />
            </>
          )}
        >
          {target.kind === 'restore'
            ? `${target.summary.createdAt ? `Backup from ${when(target.summary.createdAt)}` : 'This backup'}. Confirm with your password.`
            : dialog.text}
        </ConfirmDialog>
      )}
    </section>
  );
}
