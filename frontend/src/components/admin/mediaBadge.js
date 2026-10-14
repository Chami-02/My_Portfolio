// frontend/src/components/admin/mediaBadge.js
//
// The status badge on an upload card. Moved out of AdminAboutPanel.jsx in
// PF-113 (second consumer: the project background). A plain module, not a
// .jsx, because it returns data — a component file exporting it would trip
// react-refresh/only-export-components.
//
// PENDING SAVE and REMOVE ON SAVE are PF-112's two states the prototype's
// LIVE / MISSING cannot express. `emptyText` lets a slot that is OPTIONAL say
// so: a project with no background is not "missing" anything.
import a from '../../styles/admin.module.css';

export const badgeFor = (pending, stored, emptyText = 'MISSING') => {
  if (pending instanceof File)  return { text: 'PENDING SAVE',   cls: a.badge };
  if (pending === 'remove')     return { text: 'REMOVE ON SAVE', cls: a.badge };
  if (stored)                   return { text: 'LIVE',           cls: a.badgeOk };
  return { text: emptyText, cls: a.badgeMuted };
};
