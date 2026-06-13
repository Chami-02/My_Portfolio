import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar }       from './components/layout/Navbar';
import { Footer }       from './components/layout/Footer';
import { HomePage }     from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      {/* Full-height flex column so footer sticks to bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <main style={{ flexGrow: 1 }}>
          <Routes>
            <Route path="/"  element={<HomePage />} />
            <Route path="*"  element={<NotFoundPage />} />
            {/* Admin routes added in Sprint 6 (PF-36) */}
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;