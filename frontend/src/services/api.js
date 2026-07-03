import axios from 'axios';

// In development: Vite proxy forwards /api/* → backend:5000/api/*
// In production:  VITE_API_URL points directly to Railway backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 12000,   // 12 seconds before timing out
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Runs before EVERY request leaves the browser.
// Automatically attaches the JWT token if the user is logged in.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('portfolio_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────────────────────
// Runs after EVERY response arrives.
// Handles global error cases like expired tokens.
api.interceptors.response.use(
  (response) => response,  // Pass successful responses straight through
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — log out and redirect to login
      localStorage.removeItem('portfolio_token');
      // Only redirect if trying to reach admin pages
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }

    // Always reject — let the calling service handle the error
    return Promise.reject(error);
  }
);

export default api;