import { useState } from 'react';
import {
  MONTHS, splitMonthYear, parseMonth, typedMonthYear, monthYearProblem, yearChoices, daysIn,
} from '../../utils/monthYear';
import a from '../../styles/admin.module.css';
import styles from './MonthYearField.module.css';

/** A stored value → what the boxes show ("2008-05-04" → 04 / MAY / 2008). */
const toTyped = (value) => {
  const { year, month, day } = splitMonthYear(value);
  const known = parseMonth(month);
  return { year, month: known ? MONTHS[Number(known) - 1] : month, day };
};

/**
 * PF-143 — a date the owner TYPES, with suggestions (owner, 2026-10-31:
 * "enable type facility too" — this replaced two selects): a year, an optional
 * month and, with `withDay` (Education's start and end — owner, 2026-10-31,
 * "04/5/2008"), an optional day. Day, month, year — the order the owner
 * writes a date in. Stored as "2025", "2025-06" or "2025-06-04"; a typo is
 * passed up as typed so the form's check refuses the save (`typedMonthYear`).
 *
 * A wrong value shows its problem in red under the boxes when the owner
 * LEAVES a box — never mid-typing ("20" is on its way to "2025"). Once the
 * panel's refused save has marked the field (`aria-invalid` on `field`), its
 * own FieldError says it instead, so the message never shows twice.
 *
 * The YEAR box carries the field's id (`field`), because a refused save
 * focuses the field by that id and the year is what a rule asks for.
 */
export function MonthYearField({ label, value, onChange, field, required = false, withDay = false }) {
  const [typed, setTyped] = useState(() => toTyped(value));
  // The value the boxes were last in step with. When the form's value moves
  // without us (REVERT, another entry opened), the boxes follow — adjusted
  // during render, React's pattern for state that tracks a prop.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setTyped(toTyped(value));
  }
  const [left, setLeft] = useState(false);

  const dayId = `${field.id}-day`;
  const monthId = `${field.id}-month`;
  const hintId = `${field.id}-hint`;
  const problemId = `${field.id}-typed-problem`;
  const problem = left && !field['aria-invalid'] ? monthYearProblem(value) : null;

  const type = (next) => {
    const out = typedMonthYear(next.year, next.month, withDay ? next.day : '');
    setTyped(next);
    setSynced(out);
    onChange(out);
    setLeft(false);   // typing again hides the message until a box is left
  };

  // Leaving a box tidies a good value into the site's form (6 → JUN, 4 → 04).
  const leave = () => {
    const month = parseMonth(typed.month);
    const day = /^\d$/.test(typed.day.trim()) ? `0${typed.day.trim()}` : typed.day;
    setTyped({ ...typed, month: month ? MONTHS[Number(month) - 1] : typed.month, day });
    setLeft(true);
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={`${a.label} ${required ? styles.required : ''}`}>{label}</legend>
      <div className={withDay ? styles.triple : styles.pair}>
        {withDay && (
          <div>
            <label className={styles.visuallyHidden} htmlFor={dayId}>{label} — day</label>
            <input
              id={dayId}
              className={a.input}
              placeholder="Day"
              list={`${dayId}-list`}
              autoComplete="off"
              inputMode="numeric"
              maxLength={2}
              aria-describedby={hintId}
              value={typed.day}
              onChange={(e) => type({ ...typed, day: e.target.value })}
              onBlur={leave}
            />
            {/* Only the days the typed month has (leap years included). */}
            <datalist id={`${dayId}-list`}>
              {Array.from({ length: daysIn(typed.year, typed.month) }, (_, i) => String(i + 1).padStart(2, '0'))
                .map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
        )}

        <div>
          <label className={styles.visuallyHidden} htmlFor={monthId}>{label} — month</label>
          <input
            id={monthId}
            className={a.input}
            list={`${monthId}-list`}
            placeholder="Month"
            autoComplete="off"
            maxLength={9}
            aria-describedby={hintId}
            value={typed.month}
            onChange={(e) => type({ ...typed, month: e.target.value })}
            onBlur={leave}
          />
          <datalist id={`${monthId}-list`}>
            {MONTHS.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>

        <div>
          <label className={styles.visuallyHidden} htmlFor={field.id}>{label} — year</label>
          <input
            {...field}
            className={a.input}
            list={`${field.id}-list`}
            placeholder="Year"
            autoComplete="off"
            inputMode="numeric"
            maxLength={4}
            aria-required={required || undefined}
            aria-describedby={[field['aria-describedby'], problem && problemId].filter(Boolean).join(' ') || undefined}
            value={typed.year}
            onChange={(e) => type({ ...typed, year: e.target.value })}
            onBlur={leave}
          />
          <datalist id={`${field.id}-list`}>
            {yearChoices().map((y) => <option key={y} value={y} />)}
          </datalist>
        </div>
      </div>
      <p className={styles.hint} id={hintId}>{withDay ? 'Day and month are optional' : 'Month is optional'}</p>
      {problem && <p className={a.fieldError} id={problemId} role="alert">{problem}</p>}
    </fieldset>
  );
}
