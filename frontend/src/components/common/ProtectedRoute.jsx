import { Navigate, useLocation } from 'react-router-dom';
import { authService }           from '../../services/authService';

/**
 * Wraps any component that requires authentication.
 * If the user is not logged in, redirects to /admin/login
 * and remembers the page they were trying to reach (via `state`).
 *
 * Usage in App.jsx:
 *   <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
 */
export function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!authService.isLoggedIn()) {
    // Redirect to login, but save the page they were trying to reach
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}