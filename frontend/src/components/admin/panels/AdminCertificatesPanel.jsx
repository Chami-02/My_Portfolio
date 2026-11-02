import { certificateHooks } from '../../../hooks/useEntries';
import { certificateToForm, certificatePayload, certificateFormErrors } from '../../../utils/entryForm';
import { formatMonthYear } from '../../../utils/monthYear';
import { HOME_CERTIFICATES } from '../../sections/EducationCertificates';
import a from '../../../styles/admin.module.css';
import { EntryListPanel } from './EntryListPanel';

/** PF-143 — the Certificates panel: EntryListPanel with a certificate's fields. */
const CONFIG = {
  FID:        'certificate',
  noun:       'certificate',
  listTitle:  'All certificates',
  hooks:      certificateHooks,
  toForm:     certificateToForm,
  toPayload:  certificatePayload,
  formErrors: certificateFormErrors,
  titleField: 'title',
  media: {
    field: 'image', label: 'Certificate picture',
    help: 'a picture of the certificate (PNG, JPG/JPEG or WebP), or the PDF itself.',
  },
  // Owner, 2026-11-02: pinned ones always lead; the order within the pinned
  // ones, and within the rest, is the owner's to drag.
  group:      (c) => c.pinned === true,
  orderHint:  `Pinned certificates stay on top. Drag a row, or use ↑ ↓, to change the order within the pinned ones or within the rest, then SAVE ORDER. A new certificate goes in by its issue date. The first ${HOME_CERTIFICATES} published ones show on the home page.`,
  // The rows the home page lists — the first N PUBLISHED in this order.
  rowBadge: (c, _i, list) => (
    <>
      {c.pinned === true && <span className={a.badge}>📌 PINNED</span>}
      {c.published === true &&
        list.filter((x) => x.published === true).slice(0, HOME_CERTIFICATES).includes(c) &&
        <span className={a.badge}>HOME</span>}
    </>
  ),
  rowMeta: (c) => [c.issuer, formatMonthYear(c.issued)].filter(Boolean).join(' · ') || 'No issuer yet',
  renderFields: ({ textField, monthYearField, tagField, toggleField }) => (
    <>
      {toggleField('pinned', 'Pin to the top', {
        icon: '📌', hint: 'Pinned ones show first, with a small pin on their card.',
      })}
      <div className={a.fieldGrid}>
        {textField('title', 'Title', { placeholder: 'GitHub Foundations', required: true })}
        {textField('issuer', 'Issuer', { placeholder: 'GitHub', required: true })}
        {monthYearField('issued', 'Issue date', { required: true, withDay: true })}
        {monthYearField('expires', 'Expiry date (optional)', { withDay: true })}
        {textField('credentialId', 'Credential ID (optional)', { mono: true })}
        {textField('verifyUrl', 'Verify link (optional)', { placeholder: 'https://…', mono: true })}
      </div>
      {/* Owner, 2026-11-02 — exactly ONE ("one certificate can't have two
          pills"); it is the certificates page's filter pill. Pick from the
          list, or add a new one. */}
      {tagField('tags', 'Tag', { type: 'cert', required: true, single: true })}
      {/* Owner, 2026-11-02 — shown under the details in the big view. */}
      {textField('description', 'Description (optional)', {
        multiline: true, rows: 4, max: 1000,
        placeholder: 'What the course covered, what you built or learned.',
      })}
    </>
  ),
};

export function AdminCertificatesPanel() {
  return <EntryListPanel config={CONFIG} />;
}
