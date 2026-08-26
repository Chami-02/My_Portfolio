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

function App() {
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
            <Route path="/"            element={<HomePage />} />
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
    </BrowserRouter>
  );
}

export default App;