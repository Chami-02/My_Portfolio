import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar }          from './components/layout/Navbar';
import { Footer }          from './components/layout/Footer';
import { ScrollToTop }     from './components/layout/ScrollToTop';
import { ProtectedRoute }  from './components/common/ProtectedRoute';
import { HomePage }        from './pages/HomePage';
import { NotFoundPage }    from './pages/NotFoundPage';
import { AdminLoginPage }  from './pages/AdminLoginPage';
import { AdminPage }       from './pages/AdminPage';     // Created in PF-37

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Hide navbar on admin pages */}
        <Routes>
          <Route path="/admin/*" element={null} />
          <Route path="*" element={<Navbar />} />
        </Routes>

        <main style={{ flexGrow: 1 }}>
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