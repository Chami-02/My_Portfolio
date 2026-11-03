import { useState } from 'react';
import { fieldProps, errorId } from '../../utils/formErrors';
import { imageSpec, prepareFile, MAX_UPLOAD_MB } from '../../utils/mediaFile';
import { MAX_SECTION_IMAGES, isStagedPicture } from '../../utils/projectForm';
import { pictureAt } from '../../utils/projectMeta';
import { moveId, dropId } from '../../utils/entryForm';
import { DropZone } from './DropZone';
import { UploadPill } from './UploadPill';
import a from '../../styles/admin.module.css';
import styles from './SectionPictures.module.css';

const SPEC = imageSpec('Picture');

/** A picture's identity in the list: its file once saved, its preview before. */
const keyOf = (img) => (isStagedPicture(img) ? img.previewUrl : img.publicId);

/** `list` put in the order of `keys` (PF-138 — reuses Certificates' order helpers). */
const inOrder = (list, keys) => keys.map((k) => list.find((img) => keyOf(img) === k));

/**
 * PF-144 part 2 — the pictures of ONE project section, under its heading
 * (owner, 2026-11-03: screenshots, up to 4, optional captions).
 *
 * STAGED like every admin field (owner rule): a pick is checked and resized
 * here (the cover picture's `prepareFile` path), previewed from its own blob
 * URL and marked PENDING SAVE; nothing leaves the browser until SAVE, when the
 * panel uploads it into the project's ledger. × on a saved picture only
 * removes it from the FORM — the file is destroyed by the server after the
 * save that no longer uses it, so REVERT can still bring it back.
 *
 * PF-138 (owner leftover from PF-144): the ORDER is staged the same way —
 * drag a picture onto another's place, or ← → (keyboard and phones; a drag
 * is a mouse convenience, like DropZone). The form's order IS the payload's,
 * so a move makes the form dirty and REVERT puts it back. A drag carries no
 * file, so the DropZone around the list ignores it.
 *
 * @param images    the section's form pictures (saved or staged)
 * @param onChange  (update) => void, update = (images) => next images
 */
export function SectionPictures({ fid, index, images, guard, onChange }) {
  const [pickError, setPickError] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const endDrag = () => { setDragKey(null); setDropAt(null); };
  const number = String(index + 1).padStart(2, '0');
  const field = `sections.${index}.images`;
  const message = guard.errorFor(field);
  const full = images.length >= MAX_SECTION_IMAGES;

  const pick = async (file) => {
    if (full) { setPickError(`A section can show at most ${MAX_SECTION_IMAGES} pictures.`); return; }
    setPreparing(true);
    try {
      const result = await prepareFile(file, SPEC);
      if (result.error) { setPickError(result.error); return; }
      setPickError(null);
      const staged = {
        file: result.file, resizedFrom: result.resizedFrom,
        previewUrl: URL.createObjectURL(result.file), caption: '',
      };
      onChange((list) => [...list, staged]);
      guard.clearField(field);
    } catch {
      setPickError('This file could not be prepared for upload — try another file.');
    } finally {
      setPreparing(false);
    }
  };

  const remove = (j) => {
    const image = images[j];
    if (isStagedPicture(image)) URL.revokeObjectURL(image.previewUrl);
    onChange((list) => list.filter((_, k) => k !== j));
    guard.clearField(field);
  };

  const move = (key, delta) => {
    onChange((list) => inOrder(list, moveId(list.map(keyOf), key, delta)));
    guard.clearField(field);
  };

  const drop = () => {
    if (dragKey !== null && dropAt !== null) {
      onChange((list) => inOrder(list, dropId(list.map(keyOf), dragKey, dropAt)));
      guard.clearField(field);
    }
    endDrag();
  };

  const setCaption = (j, caption) => {
    onChange((list) => list.map((img, k) => (k === j ? { ...img, caption } : img)));
    guard.clearField(field);
  };

  const box = fieldProps(guard.errors, fid, field);

  return (
    <div {...box} role="group" aria-labelledby={`${box.id}-label`} tabIndex={-1} className={styles.block}>
      <div className={styles.head}>
        <span className={a.labelLead} id={`${box.id}-label`}>Pictures (up to {MAX_SECTION_IMAGES})</span>
        {!full && (
          <UploadPill
            id={`${fid}-section-${index}-picture`}
            className={styles.add}
            accept={SPEC.accept}
            label={preparing ? 'PREPARING…' : '↑ ADD PICTURE'}
            onPick={pick}
          />
        )}
      </div>

      <DropZone onFile={pick} onReject={setPickError}>
        {images.length === 0 ? (
          <p className={styles.none}>None yet — they show under this heading on the project page.</p>
        ) : (
          <ul
            className={styles.grid}
            role="list"
            onDragOver={(e) => { if (dragKey !== null) e.preventDefault(); }}
            onDrop={(e) => { if (dragKey === null) return; e.preventDefault(); drop(); }}
          >
            {images.map((img, j) => {
              const staged = isStagedPicture(img);
              const key = keyOf(img);
              const classes = [styles.item];
              if (key === dragKey) classes.push(styles.dragging);
              if (dropAt === j) classes.push(styles.dropBefore);
              if (dropAt === images.length && j === images.length - 1) classes.push(styles.dropAfter);
              return (
                <li
                  key={key}
                  className={classes.join(' ')}
                  draggable={images.length > 1}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', key);   // Firefox will not drag without data
                    setDragKey(key);
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    if (dragKey === null) return;
                    e.preventDefault();
                    const box = e.currentTarget.getBoundingClientRect();
                    const at = e.clientX > box.left + box.width / 2 ? j + 1 : j;
                    if (dropAt !== at) setDropAt(at);
                  }}
                >
                  <span className={styles.thumbWrap}>
                    {/* draggable={false}: Chrome drags an <img> as a FILE, which
                        the DropZone would then try to stage as a new picture. */}
                    <img className={styles.thumb} src={staged ? img.previewUrl : pictureAt(img.url, 400)} alt="" draggable={false} />
                    {staged && <span className={`${a.badge} ${styles.badge}`}>PENDING SAVE</span>}
                  </span>
                  <input
                    className={a.input}
                    value={img.caption ?? ''}
                    onChange={(e) => setCaption(j, e.target.value)}
                    placeholder="Caption (optional)"
                    aria-label={`Section ${number}, picture ${j + 1} caption`}
                  />
                  <button type="button" className={styles.remove} onClick={() => remove(j)}
                    aria-label={`Remove picture ${j + 1} from section ${number}`}>
                    ×
                  </button>
                  {images.length > 1 && (
                    <span className={styles.moves}>
                      <button type="button" className={styles.move} disabled={j === 0}
                        onClick={() => move(key, -1)}
                        aria-label={`Move picture ${j + 1} of section ${number} earlier`}>←</button>
                      <button type="button" className={styles.move} disabled={j === images.length - 1}
                        onClick={() => move(key, 1)}
                        aria-label={`Move picture ${j + 1} of section ${number} later`}>→</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropZone>

      {pickError && <p className={a.fieldError} role="alert">{pickError}</p>}
      {message && <p className={a.fieldError} id={errorId(fid, field)} role="alert">{message}</p>}
      <p className={styles.caption}>
        PNG, JPEG OR WEBP · MAX {MAX_UPLOAD_MB} MB · BEST 1920 × 1080 · SHOWN UNCROPPED
      </p>
    </div>
  );
}
