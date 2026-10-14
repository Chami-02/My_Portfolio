import { createBrowserRouter, RouterProvider, Routes, Route } from 'react-router-dom';
import { Navbar }          from './components/layout/Navbar';
import { Footer }          from './components/layout/Footer';
import { ScrollToTop }     from './components/layout/ScrollToTop';
import { SkipLink }        from './components/layout/SkipLink';
import { ProtectedRoute }  from './components/common/ProtectedRoute';
import { HomePage }        from './pages/HomePage';
import { BlogPage }        from './pages/BlogPage';
import { BlogPostPage }    from './pages/BlogPostPage';
import { NotFoundPage }    from './pages/NotFoundPage';
import { AdminLoginPage }  from './pages/AdminLoginPage';
import { AdminPage }       from './pages/AdminPage';     // Created in PF-37

function AppLayout() {
  return (
    <>
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

        {/* id is the skip link's target — see SkipLink.jsx.

            ⚠️ tabIndex={-1} is load-bearing, not decoration. Without it the
            skip link SCROLLS to <main> without moving focus: document
            .activeElement stays on <body>, so the next Tab restarts from the
            top of the document and walks the whole header again — the exact
            failure a skip link exists to prevent. A negative tabindex makes
            the element programmatically focusable without adding a tab stop,
            so the keyboard order PF-83 specified is unchanged. It takes no
            focus ring: :focus-visible does not match a programmatic focus. */}
        <main id="main-content" tabIndex={-1} style={{ flexGrow: 1 }}>
          <Routes>
            {/* Public */}
            <Route path="/"            element={<HomePage />} />
            {/* PF-98. Ahead of the `*` catch-all, which swallowed /blog until
                now — PF-86 pointed five Blog-teaser links here and every one
                of them rendered NotFoundPage. */}
            <Route path="/blog"        element={<BlogPage />} />
            {/* PF-99. Every card PF-98 rendered pointed here and landed
                on NotFoundPage; so did the four post links in the home
                page's teaser. Order does not matter against `/blog`
                (React Router v7 ranks by specificity, not declaration),
                but it must precede nothing in particular — the `*`
                catch-all below is what it is escaping. */}
            <Route path="/blog/:slug"  element={<BlogPostPage />} />
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
          <Route path="*" element={<Footer />} />
        </Routes>

        <ScrollToTop />
      </div>
    </>
  );
}

/*
 * ⚠️ PF-118 batch 2 — a DATA router, because `useBlocker` needs one.
 *
 * The admin's unsaved-changes guard has to stop the browser's Back/Forward
 * button, and React Router only exposes that through `useBlocker`, which throws
 * under the classic <BrowserRouter>. So the router changed — and NOTHING ELSE
 * did: ONE catch-all route renders the exact layout above, and its three
 * <Routes> blocks (navbar / main / footer) keep matching as descendant routes,
 * the same way they did inside <BrowserRouter>. Same history API, same URLs.
 *
 * ⚠️ Do not "modernise" those blocks into route objects as a side quest: the
 * navbar and footer are separate <Routes> on purpose (chrome excluded on
 * /admin/*), and the full E2E suite is what proved this swap changed nothing.
 *
 * Created at module scope: a router built inside a component would be rebuilt
 * on every render and reset navigation state.
 */
const router = createBrowserRouter([{ path: '*', element: <AppLayout /> }]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;