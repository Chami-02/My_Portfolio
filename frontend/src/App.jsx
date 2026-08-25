import { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar }          from './components/layout/Navbar';
import { Footer }          from './components/layout/Footer';
import { ScrollToTop }     from './components/layout/ScrollToTop';
import { SkipLink }        from './components/layout/SkipLink';
import { ProtectedRoute }  from './components/common/ProtectedRoute';
import { HomePage }        from './pages/HomePage';
import { NotFoundPage }    from './pages/NotFoundPage';
import { AdminLoginPage }  from './pages/AdminLoginPage';
import { AdminPage }       from './pages/AdminPage';     // Created in PF-37
import { beginReplay } from './utils/replay';

function App() {
  /* ── REPLAY INTRO — PF-88 ──────────────────────────────────────────
   *
   * The footer's replay button re-runs the splash, and the splash lives
   * in HomePage. <Footer /> is a SIBLING of the routed page, not a
   * child, so the counter has to sit at their nearest common ancestor.
   * That is here — two consumers, one number, and no context module
   * needed for it: HomePage takes `replayCount`, Footer takes
   * `onReplay`.
   *
   * Prototype (line 1147):
   *
   *   replay: () => {
   *     window.scrollTo({ top: 0, behavior: 'smooth' });
   *     this.setState({ splash: true }, () => { this.hideReveals(); this.runSplash(); });
   *   }
   *
   * `hideReveals()` + `runSplash()` become HomePage's keyed remount;
   * `splash: true` becomes this counter going up.
   */
  const [replayCount, setReplayCount] = useState(0);

  const replay = useCallback(() => {
    // Scrolls to the top honouring prefers-reduced-motion — which a JS
    // scrollTo with an explicit `behavior` does NOT get for free — and
    // answers whether a splash should follow. See utils/replay.js.
    if (beginReplay()) setReplayCount((n) => n + 1);
  }, []);

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* PF-83. First child on purpose: a skip link is only a skip
            link if it is the document's first focusable element, which
            means it has to precede the route that renders <Navbar />.
            Rendered on every route, admin included — the navbar is
            hidden there but <main> is the same element, so the link
            still does something useful. */}
        <SkipLink />

        {/* Hide navbar on admin pages */}
        <Routes>
          <Route path="/admin/*" element={null} />
          <Route path="*" element={<Navbar />} />
        </Routes>

        {/* id is the skip link's target — see SkipLink.jsx. */}
        <main id="main-content" style={{ flexGrow: 1 }}>
          <Routes>
            {/* Public */}
            <Route path="/"            element={<HomePage replayCount={replayCount} />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Protected — requires JWT */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        {/* Hide footer on admin pages */}
        <Routes>
          <Route path="/admin/*" element={null} />
          <Route path="*" element={<Footer onReplay={replay} replayCount={replayCount} />} />
        </Routes>

        <ScrollToTop />
      </div>
    </BrowserRouter>
  );
}

export default App;