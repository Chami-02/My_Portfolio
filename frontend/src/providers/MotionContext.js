// frontend/src/providers/MotionContext.js
//
// Split out from MotionProvider.jsx for the same reason as
// ThemeContext.js — Fast Refresh only handles component-only modules.
import { createContext } from 'react';

export const MotionContext = createContext(null);
