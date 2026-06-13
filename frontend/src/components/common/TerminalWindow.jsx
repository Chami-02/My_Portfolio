import { useState, useEffect } from 'react';

const TERMINAL_LINES = [
  { text: '$ docker compose up --build', delay: 200,  type: 'command' },
  { text: '[+] Building frontend...', delay: 900,  type: 'info' },
  { text: '[+] Building backend...',  delay: 1500, type: 'info' },
  { text: '✓  MongoDB connected',      delay: 2300, type: 'success' },
  { text: '✓  Express API on :5000',   delay: 2800, type: 'success' },
  { text: '✓  React app on :5173',     delay: 3300, type: 'success' },
  { text: '',                           delay: 3700, type: 'blank' },
  { text: '● VITE v8  ready in 420ms', delay: 4000, type: 'accent' },
  { text: '  ➜  http://localhost:5173', delay: 4300, type: 'muted' },
];

const TYPE_COLOR = {
  command: 'var(--text-primary)',
  info:    'var(--text-body)',
  success: '#34d399',
  accent:  'var(--accent)',
  muted:   'var(--text-muted)',
  blank:   'transparent',
};

export function TerminalWindow() {
  const [visible, setVisible] = useState(0);
  const [started, setStarted] = useState(false);

  // Start the typing sequence after a short delay (feels natural)
  useEffect(() => {
    const init = setTimeout(() => setStarted(true), 600);
    return () => clearTimeout(init);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (visible >= TERMINAL_LINES.length) return;

    const baseDelay = visible === 0 ? 0 : TERMINAL_LINES[visible].delay - TERMINAL_LINES[visible - 1].delay;
    const t = setTimeout(() => setVisible((v) => v + 1), Math.max(baseDelay, 300));
    return () => clearTimeout(t);
  }, [visible, started]);

  return (
    <div
      style={{
        background: '#0d1117',
        border: '1px solid var(--border-bright)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(129,140,248,0.05)',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1.25rem',
          background: '#161b22',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Traffic lights */}
        {['#ff5f57', '#febc2e', '#28c840'].map((color, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'block' }} />
        ))}
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}
        >
          terminal — portfolio
        </span>
      </div>

      {/* Terminal body */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          minHeight: '220px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          lineHeight: '1.8',
        }}
      >
        {TERMINAL_LINES.slice(0, visible).map((line, i) => (
          <div key={i} style={{ color: TYPE_COLOR[line.type] }}>
            {line.text || '\u00A0'}
          </div>
        ))}

        {/* Blinking cursor on the last visible line */}
        {visible < TERMINAL_LINES.length && (
          <span
            style={{ color: 'var(--accent)' }}
            className="animate-blink"
          >▌</span>
        )}
      </div>
    </div>
  );
}
