import { certificateHooks } from '../../../hooks/useEntries';
import { certificateToForm, certificatePayload, certificateFormErrors } from '../../../utils/entryForm';
import { CERTIFICATE_TEXT_FIELDS } from '../../../utils/sectionText';
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
  textFields: CERTIFICATE_TEXT_FIELDS,
  media: { field: 'image', label: 'Certificate picture', help: 'a picture, or the PDF itself' },
  orderHint:  `Drag a row, or use ↑ ↓, then SAVE ORDER. The first ${HOME_CERTIFICATES} published ones show on the home page; every published one is on the certificates page.`,
  // The rows the home page lists — the first N PUBLISHED in this order.
  rowBadge: (c, _i, list) => c.published === true &&
    list.filter((x) => x.published === true).slice(0, HOME_CERTIFICATES).includes(c)
    && <span className={a.badge}>HOME</span>,
  rowMeta: (c) => [c.issuer, formatMonthYear(c.issued)].filter(Boolean).join(' · ') || 'No issuer yet',
  renderFields: ({ textField, monthYearField }) => (
    <>
      <div className={a.fieldGrid}>
        {textField('title', 'Title', { placeholder: 'GitHub Foundations', required: true })}
        {textField('issuer', 'Issuer', { placeholder: 'GitHub' })}
        {monthYearField('issued', 'Issued')}
        {monthYearField('expires', 'Expires (optional)')}
        {textField('credentialId', 'Credential ID (optional)', { mono: true })}
        {textField('verifyUrl', 'Verify link (optional)', { placeholder: 'https://…', mono: true })}
      </div>
    </>
  ),
};

export function AdminCertificatesPanel() {
  return <EntryListPanel config={CONFIG} />;
}
