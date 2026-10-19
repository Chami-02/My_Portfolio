// frontend/src/utils/chunkReload.js
//
// Recover from a lazy chunk that no longer exists — PF-127.
//
// React-free so it can be unit-tested directly, same convention as
// utils/theme.js and utils/motion.js.
//
// WHY. Since PF-127 the blog and admin pages are separate files named by
// their content hash. A deploy replaces them, and the old ones are gone. A tab
// opened BEFORE the deploy still runs the old index.html, so its next click to
// /blog asks for a chunk that now 404s — and the page would crash into the
// router's error page. Vite reports every such failure as a `vite:preloadError`
// event on window; reloading fetches the new index.html, which names the new
// chunks. This is the fix Vite's own docs give.
//
// ⚠️ ONCE, not always. If the server is really down, a reload fails the same
// way, and an unconditional reload would loop forever. A timestamp in
// sessionStorage lets one reload through per RELOAD_WINDOW_MS; a second
// failure inside the window is left to throw. No ErrorBoundary wraps the
// routes, so it lands on React Router's default "Unexpected Application
// Error!" page (measured, PF-127 recheck) — reachable only when a fresh reload
// STILL cannot fetch the chunk. Deliberately not fixed here: wrapping the
// routes in <ErrorBoundary> would not work, because React.lazy caches the
// rejected import and its TRY AGAIN would throw forever. Logged as
// outstanding work.

export const RELOAD_KEY = 'pf.chunkReloadAt';
export const RELOAD_WINDOW_MS = 10_000;

function readLast(storage) {
  try {
    return Number(storage.getItem(RELOAD_KEY)) || 0;
  } catch {
    return 0;   // storage blocked (private mode) — allow the one reload
  }
}

/**
 * Handle one `vite:preloadError`. Returns true when it reloaded.
 * `now` is injectable for tests.
 */
export function handleChunkError(event, { storage, reload, now = Date.now() }) {
  if (now - readLast(storage) < RELOAD_WINDOW_MS) return false;
  try {
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Without storage the guard cannot hold, so do not risk a loop.
    return false;
  }
  event.preventDefault();   // stops Vite re-throwing the import error
  reload();
  return true;
}

export function installChunkReload(win = window) {
  win.addEventListener('vite:preloadError', (event) => {
    handleChunkError(event, {
      storage: win.sessionStorage,
      reload: () => win.location.reload(),
    });
  });
}
