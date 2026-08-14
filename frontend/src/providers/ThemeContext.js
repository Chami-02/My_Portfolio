// frontend/src/providers/ThemeContext.js
//
// The context lives apart from ThemeProvider.jsx deliberately. React
// Fast Refresh can only hot-swap a module that exports components and
// nothing else; a context exported alongside the provider forces a full
// reload on every edit, and eslint-plugin-react-refresh flags it.
import { createContext } from 'react';

export const ThemeContext = createContext(null);
