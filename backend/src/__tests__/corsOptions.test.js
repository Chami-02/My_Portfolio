// backend/src/__tests__/corsOptions.test.js
//
// PF-85 widened the allowlist to a localhost dev-port range, in
// NON-PRODUCTION ONLY (owner decision, 2026-08-19). The point of these
// tests is the "only" — production behaviour must be provably unchanged,
// so every case is asserted in both environments.
//
// corsOptions reads process.env.NODE_ENV at call time, inside the origin
// callback, so the module does not need re-requiring between cases.

const corsOptions = require('../config/corsOptions');

/** Run the origin callback and return either `true` or the Error. */
function check(origin, nodeEnv) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    let outcome;
    corsOptions.origin(origin, (err, allowed) => {
      outcome = err || allowed;
    });
    return outcome;
  } finally {
    process.env.NODE_ENV = previous;
  }
}

const allowed = (origin, env) => check(origin, env) === true;

describe('CORS origin policy (PF-85)', () => {

  describe('the exact-match allowlist — unchanged in both environments', () => {
    const ORIGINS = [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://my-portfoliofrontend-henna.vercel.app',
    ];

    it.each(ORIGINS)('allows %s in production', (o) => {
      expect(allowed(o, 'production')).toBe(true);
    });

    it.each(ORIGINS)('allows %s in development', (o) => {
      expect(allowed(o, 'development')).toBe(true);
    });
  });

  describe('the dev-port range', () => {
    // Vite increments past a taken port rather than failing — 5173 →
    // 5175 → 5176 — and prints the new one in a line that is easy to
    // skim past. The site still loads (assets come from Vite itself);
    // only the cross-origin API calls are rejected, as a bare network
    // error mentioning nothing about CORS.
    const DEV_PORTS = ['5170', '5175', '5176', '5180', '5199', '5200'];

    it.each(DEV_PORTS)('allows localhost:%s in development', (port) => {
      expect(allowed(`http://localhost:${port}`, 'development')).toBe(true);
    });

    it.each(DEV_PORTS)('REJECTS localhost:%s in production', (port) => {
      const result = check(`http://localhost:${port}`, 'production');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toMatch(/is not allowed/);
    });

    it('allows the range when NODE_ENV is unset', () => {
      // `!== 'production'` rather than `=== 'development'`, so a bare
      // `node server.js` with no NODE_ENV still gets the dev behaviour.
      expect(allowed('http://localhost:5176', undefined)).toBe(true);
    });
  });

  describe('what the range must NOT cover', () => {
    // The range is deliberately narrow. These would each be a real
    // widening of the security posture rather than a dev convenience.
    const REJECTED = [
      'http://localhost:3000',          // outside the range
      'http://localhost:5169',          // one below
      'http://localhost:5201',          // one above
      'http://localhost:52000',         // trailing digits past the range
      'https://localhost:5176',         // https, not http
      'http://127.0.0.1:5176',          // not the localhost hostname
      'http://evil.com:5176',           // arbitrary host on a dev port
      'http://localhost:5176.evil.com', // suffix attack
      'http://notlocalhost:5176',       // prefix attack
      'http://evil.com/http://localhost:5176',
    ];

    it.each(REJECTED)('rejects %s even in development', (origin) => {
      const result = check(origin, 'development');
      expect(result).toBeInstanceOf(Error);
    });
  });

  describe('requests with no origin', () => {
    it('is allowed in both environments (Postman, curl, mobile apps)', () => {
      expect(allowed(undefined, 'production')).toBe(true);
      expect(allowed(undefined, 'development')).toBe(true);
    });
  });

  describe('other options', () => {
    it('still sends credentials and the legacy success status', () => {
      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.optionsSuccessStatus).toBe(200);
    });
  });
});
