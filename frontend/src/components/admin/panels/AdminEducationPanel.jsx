import { educationHooks } from '../../../hooks/useEntries';
import { educationToForm, educationPayload, educationFormErrors } from '../../../utils/entryForm';
import { imageSpec } from '../../../utils/mediaFile';
import { dateRange } from '../../../utils/monthYear';
import a from '../../../styles/admin.module.css';
import { EntryListPanel } from './EntryListPanel';

/**
 * PF-143 — the Education panel: EntryListPanel with LinkedIn's education form
 * (owner, 2026-10-30): School, Degree, Field of study, Start, End (or
 * expected), Grade, Activities and societies, Description, and the school's
 * logo. No skills, no proof, no Section text card (owner, 2026-10-31).
 */
const CONFIG = {
  FID:        'education',
  noun:       'education entry',
  listTitle:  'All education',
  hooks:      educationHooks,
  toForm:     educationToForm,
  toPayload:  educationPayload,
  formErrors: educationFormErrors,
  titleField: 'school',
  media: {
    field: 'logo', label: 'Logo', spec: imageSpec('Logo'),
    help: 'optional — the school\'s logo, PNG, JPEG or WebP. It shows in a small circle beside the school name.',
  },
  orderHint:  'A new entry takes its place by date, newest on top. To change the order, drag a row or use ↑ ↓, then SAVE ORDER.',
  rowMeta: (e) => [e.degree, dateRange(e.start, e.end)].filter(Boolean).join(' · ') || 'No dates yet',
  renderFields: ({ textField, monthYearField }) => (
    <>
      <div className={a.fieldGrid}>
        {textField('school', 'School', { placeholder: 'Ex: University of Westminster', required: true })}
        {textField('degree', 'Degree', { placeholder: 'Ex: BSc (Hons)' })}
        {textField('fieldOfStudy', 'Field of study', { placeholder: 'Ex: Computer Science' })}
        {textField('grade', 'Grade', { placeholder: 'First Class' })}
        {monthYearField('start', 'Start date', { required: true, withDay: true })}
        {monthYearField('end', 'End date (or expected)', { required: true, withDay: true })}
      </div>
      {textField('activities', 'Activities and societies', { multiline: true, rows: 2, placeholder: 'Ex: Computing Society, Cricket' })}
      {textField('description', 'Description', { multiline: true, rows: 3 })}
      {textField('website', 'School website (optional)', { placeholder: 'Ex: https://www.westminster.ac.uk', mono: true })}
    </>
  ),
};

export function AdminEducationPanel() {
  return <EntryListPanel config={CONFIG} />;
}
