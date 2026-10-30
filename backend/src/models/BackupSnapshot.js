const mongoose = require('mongoose');

/**
 * PF-135 — a safety copy of the site's content, taken INSIDE the restore's
 * transaction just before the content is replaced (owner, 2026-10-30: on the
 * server, the newest 3). If the restore fails, the copy is rolled back with
 * it; if it succeeds, the copy is the undo: the Backup card downloads it and
 * the owner restores that file.
 *
 * `data` is the backup file itself as a JSON STRING, not an embedded object:
 * the content is stored exactly as the file would hold it, and no key in it
 * can be read as a MongoDB operator. Never in a backup itself
 * (NEVER_BACKED_UP) — it holds visitors' messages and is the owner's only.
 */
const COUNT_KEYS = ['projects', 'skills', 'skillCategories', 'blog', 'vocabulary', 'messages'];

const backupSnapshotSchema = new mongoose.Schema(
  {
    data:   { type: String, required: true },
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, { type: Number, default: 0 }])),
    reason: { type: String, required: true, enum: ['before-restore'] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

backupSnapshotSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BackupSnapshot', backupSnapshotSchema);
