// frontend/src/hooks/usePageMeta.js
import { useEffect } from 'react';
import { applyPageMeta } from '../utils/pageMeta';

/**
 * PF-153 — this page's title, description and address for search engines. The
 * JSON key re-runs the effect only when the words really change, since `structured`
 * is a new object every render.
 */
export function usePageMeta(meta) {
  const key = JSON.stringify(meta);
  useEffect(() => applyPageMeta(JSON.parse(key)), [key]);
}
