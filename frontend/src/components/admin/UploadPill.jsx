// Moved out of AdminAboutPanel.jsx in PF-113 — the project background is the
// third upload slot. Its two classes moved to admin.module.css with it.
import a from '../../styles/admin.module.css';

/** The accent upload pill. A real focusable input, visually hidden by CSS. */
export function UploadPill({ label, accept, onPick, id, className = '' }) {
  return (
    <label className={`${a.uploadPill} ${className}`.trim()} htmlFor={id}>
      {label}
      {/*
        ⚠️ Visually hidden by CSS, NOT by `hidden` or `display: none`. Both of
        those remove the input from the focus order, and the prototype's
        label-wrapping-a-display-none-input pill cannot be reached or operated
        by a keyboard at all. Clipped-but-focusable keeps the pill's look, keeps
        Tab and Enter working, and keeps the control in the accessibility tree.
      */}
      <input
        id={id}
        type="file"
        accept={accept}
        className={a.fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so re-picking the SAME file fires change again — otherwise a
          // rejected pick cannot be retried without choosing something else
          // first. The prototype does this too (Admin.dc.html:1181).
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
    </label>
  );
}
