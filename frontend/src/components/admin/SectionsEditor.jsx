import { fieldProps, errorId, fieldId } from '../../utils/formErrors';
import a      from '../../styles/admin.module.css';
import styles from './SectionsEditor.module.css';

/*
 * ── The sections editor — Blog's (PF-59/97/115), shared with Projects in PF-144
 *
 * A record's page as an ordered list of sections, each a heading, paragraphs
 * and bullets — the shape `models/sectionSchema.js` stores and the reading
 * views render 01·02·03. Moved out of AdminBlogPanel.jsx unchanged so a
 * project page and a blog post are written in ONE editor: compose, never copy.
 *
 * The panel owns the form; this owns only how `sections` changes.
 *   onChange(update)  `update` is (sections) => next sections — FUNCTIONAL, so
 *                     a late callback edits the form as it is then.
 *   guard             the panel's useFormGuard; errors key on
 *                     `sections.N.heading` and ids derive from `fid` + path.
 *   emptySection      the factory for "+ ADD SECTION".
 *   aboveBody         optional (section, index) => node, rendered between the
 *                     heading and the paragraphs — Projects' pictures (PF-144).
 *                     Blog passes nothing.
 */

/** The inline message under a field. */
function FieldError({ fid, field, guard }) {
  const message = guard.errorFor(field);
  if (!message) return null;
  return (
    <p className={a.fieldError} id={errorId(fid, field)} role="alert">
      {message}
    </p>
  );
}

/**
 * One editable line inside a section — a paragraph or a bullet.
 *
 * Paragraphs get a textarea and bullets get an input, because a bullet that
 * grows to three lines is a paragraph wearing the wrong marker.
 *
 * ⚠️ PF-115 gives each its OWN accessible name. Until then they had only a
 * placeholder, so `getAllByLabelText(/paragraph 1/)` matched the REMOVE
 * buttons — a screen reader announced an unnamed text box.
 */
function LineRow({ kind, index, sectionNumber, value, onChange, onRemove }) {
  const isParagraph = kind === 'body';
  const noun = isParagraph ? 'paragraph' : 'bullet';
  const name = `Section ${sectionNumber}, ${noun} ${index + 1}`;

  return (
    <div className={styles.line}>
      <span className={styles.lineMark} aria-hidden="true">
        {isParagraph ? `${index + 1}.` : '•'}
      </span>
      {isParagraph ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`Paragraph ${index + 1}…`} aria-label={name}
          className={`${a.textarea} ${styles.lineInput}`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Bullet point…" aria-label={name}
          className={`${a.input} ${styles.lineInput}`} />
      )}
      <button type="button" onClick={onRemove} aria-label={`Remove ${noun} ${index + 1}`}
        className={styles.remove}>
        ×
      </button>
    </div>
  );
}

/*
 * One section: a heading, its paragraphs and its bullets.
 *
 * The numbering is the same 01·02·03 the reading view renders, so the order of
 * these blocks is the order a visitor reads — which is why they can be moved.
 */
function SectionEditor({ fid, section, index, total, guard, onField, onLine, onAddLine, onRemoveLine, onMove, onRemove, aboveBody }) {
  const number = String(index + 1).padStart(2, '0');
  const path = `sections.${index}.heading`;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTop}>
        <span className={styles.sectionNumber}>SECTION {number}</span>
        <div className={styles.sectionTools}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
            aria-label={`Move section ${number} up`} className={styles.move}>↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
            aria-label={`Move section ${number} down`} className={styles.move}>↓</button>
          <button type="button" onClick={onRemove} aria-label={`Remove section ${number}`}
            className={styles.remove}>×</button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={a.label} htmlFor={fieldId(fid, path)}>Heading *</label>
        <input {...fieldProps(guard.errors, fid, path)}
          value={section.heading}
          onChange={(e) => onField('heading', e.target.value)}
          placeholder="Introduction" className={a.input} />
        <FieldError fid={fid} field={path} guard={guard} />
      </div>

      {aboveBody?.(section, index)}

      {['body', 'bullets'].map((kind) => (
        <div key={kind} className={styles.linesBlock}>
          <div className={styles.linesHead}>
            <span className={a.labelLead}>{kind === 'body' ? 'Paragraphs' : 'Bullets'}</span>
            <button type="button" onClick={() => onAddLine(kind)} className={a.btnRow}>
              + ADD {kind === 'body' ? 'PARAGRAPH' : 'BULLET'}
            </button>
          </div>
          {section[kind].length === 0 ? (
            <p className={styles.none}>None yet.</p>
          ) : (
            <div className={styles.lines}>
              {section[kind].map((value, j) => (
                <LineRow key={j} kind={kind} index={j} sectionNumber={number} value={value}
                  onChange={(next) => onLine(kind, j, next)}
                  onRemove={() => onRemoveLine(kind, j)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SectionsEditor({ fid, sections, guard, onChange, emptySection, aboveBody }) {
  // Every one of these rebuilds the arrays it touches rather than mutating
  // them in place. React compares by reference, so `sections[i].body[j] = v`
  // would change the data and render nothing.
  const updateSection = (index, mutate) =>
    onChange((list) => list.map((section, i) => (i === index ? mutate(section) : section)));

  const setSectionField = (index, field, value) => {
    updateSection(index, (section) => ({ ...section, [field]: value }));
    guard.clearField(`sections.${index}.${field}`);
  };

  const setLine = (index, kind, lineIndex, value) => {
    updateSection(index, (section) => ({
      ...section,
      [kind]: section[kind].map((line, j) => (j === lineIndex ? value : line)),
    }));
    // ⚠️ "Section NN needs at least one paragraph or bullet" is reported
    // against the HEADING — a variable-length list has no single input to
    // mark — so typing a paragraph clears the heading's mark.
    guard.clearField(`sections.${index}.heading`);
  };

  const addLine = (index, kind) =>
    updateSection(index, (section) => ({ ...section, [kind]: [...section[kind], ''] }));

  const removeLine = (index, kind, lineIndex) =>
    updateSection(index, (section) => ({
      ...section,
      [kind]: section[kind].filter((_, j) => j !== lineIndex),
    }));

  const moveSection = (index, direction) =>
    onChange((list) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // "Nothing to send at all" is reported against `sections` (Projects): the
  // block itself takes the field's id so a refused save can focus it.
  const block = fieldProps(guard.errors, fid, 'sections');

  return (
    <div {...block} role="group" aria-labelledby={`${block.id}-label`} tabIndex={-1}>
      <div className={styles.sectionsHead}>
        <span className={a.labelLead} id={`${block.id}-label`}>Sections *</span>
        <button type="button" onClick={() => onChange((list) => [...list, emptySection()])}
          className={a.btnRow}>
          + ADD SECTION
        </button>
      </div>
      <FieldError fid={fid} field="sections" guard={guard} />
      <div className={styles.sections}>
        {sections.map((section, i) => (
          <SectionEditor
            key={i}
            fid={fid}
            section={section}
            index={i}
            total={sections.length}
            guard={guard}
            onField={(field, value) => setSectionField(i, field, value)}
            onLine={(kind, j, value) => setLine(i, kind, j, value)}
            onAddLine={(kind) => addLine(i, kind)}
            onRemoveLine={(kind, j) => removeLine(i, kind, j)}
            onMove={(direction) => moveSection(i, direction)}
            onRemove={() => onChange((list) => list.filter((_, j) => j !== i))}
            aboveBody={aboveBody}
          />
        ))}
      </div>
    </div>
  );
}
