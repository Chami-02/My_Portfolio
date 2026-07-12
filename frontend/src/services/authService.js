import api from './api';

const TOKEN_KEY = 'portfolio_token';

export const authService = {
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    // Store the JWT token in localStorage
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  getToken:   () => localStorage.getItem(TOKEN_KEY),
  isLoggedIn: () => !!localStorage.getItem(TOKEN_KEY),

  getMe: () => api.get('/auth/me').then((r) => r.data.data),
};