import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar }       from './components/layout/Navbar';
import { Footer }       from './components/layout/Footer';
import { HomePage }     from './pages/HomePage';
import { AdminPage }    from './pages/AdminPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { ProtectedRoute } from './components/common/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      {/* Full-height flex column so footer sticks to bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flexGrow: 1 }}>
          <Routes>
            <Route path="/"  element={<HomePage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={(
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              )}
            />
            <Route path="*"  element={<NotFoundPage />} />
          </Routes>
        </main>
        <ScrollToTop />
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
