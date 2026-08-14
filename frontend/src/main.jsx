import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools }               from '@tanstack/react-query-devtools';
import { Analytics }                        from '@vercel/analytics/react';
import { ThemeProvider } from './providers/ThemeProvider';
import { MotionProvider } from './providers/MotionProvider';
import App from './App.jsx';
import './styles/global.css';
import './styles/tokens.css';
import './styles/keyframes/index.css';
import './styles/motion.css';           // must be LAST

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          1000 * 60 * 5,  // Data stays "fresh" for 5 minutes before refetching
      retry:              1,               // Retry failed requests once before showing error
      refetchOnWindowFocus: false,         // Don't refetch every time the user switches tabs
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionProvider>
          <App />
          <Analytics />
          {/* DevTools panel — only visible in development, hidden in production build */}
          <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);