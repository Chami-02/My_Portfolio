// frontend/src/hooks/useStagedFile.js
//
// One upload slot's STAGED state — owner rule 2026-09-25: nothing an admin
// panel does reaches the public site until SAVE. Holds `File | 'remove' | null`.
import { useState, useRef, useEffect } from 'react';

/**
 * Hold one picked file, with its object-URL preview.
 *
 * ⚠️ The URL is created in the EVENT HANDLER, not in an effect. An effect that
 * called `setState` with the new URL would trip
 * `react-hooks/set-state-in-effect` — the rule CI runs at --max-warnings=0 —
 * and would also paint one frame without the preview. The only effect here is
 * the unmount revoke, which reads a ref so it needs no dependencies and never
 * re-runs.
 *
 * Three consumers — About's portrait and résumé, and (PF-113) a project's card
 * background, which is why it moved here from AdminAboutPanel.jsx. It
 * deliberately does NOT know which route it belongs to, so there is no way for
 * one card's arguments to reach another's request.
 */
export function useStagedFile() {
  const [file, setFile] = useState(null);           // File | 'remove' | null
  const [previewUrl, setPreviewUrl] = useState(null);
  // PF-113 batch 2: the ORIGINAL size of a file the browser resized, so the
  // card can say "resized from 8.3 MB" — otherwise a 400 KB result for an
  // 8 MB photo looks like the wrong file was picked.
  const [resizedFrom, setResizedFrom] = useState(null);
  const urlRef = useRef(null);

  const stage = (next, { resizedFrom: from = null } = {}) => {
    setResizedFrom(next instanceof File ? from : null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next instanceof File ? URL.createObjectURL(next) : null;
    setPreviewUrl(urlRef.current);
    setFile(next);
  };

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  return { file, previewUrl, resizedFrom, stage, clear: () => stage(null) };
}
