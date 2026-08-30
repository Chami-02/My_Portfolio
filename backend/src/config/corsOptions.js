// The complete list of frontend URLs that are allowed to call this API.
// Add your production Vercel URL here before deploying (Sprint 8).
const ALLOWED_ORIGINS = [
  'http://localhost:5173',                    // Local dev (Docker)
  'http://localhost:5174',                    // E2E frontend (PF-66) — Playwright only
  'https://my-portfoliofrontend-henna.vercel.app',
  // 'https://your-custom-domain.me',          // ← Add once you set up PF-51 (custom domain)
];

// Dev-only escape hatch for Vite's port hopping (owner decision,
// 2026-08-19). Vite does NOT fail when 5173 is taken — it increments to
// 5175, 5176, … and prints the new port in a line that is easy to skim
// past. The site then loads perfectly, because the static assets come
// from Vite itself; only the cross-origin API calls are rejected, and the
// rejection surfaces as a bare network error mentioning nothing about
// CORS. Combined with the login form's old catch-all message, that
// produced a session on 2026-08-18 where a dead backend was blamed on a
// wrong password. See CLAUDE.md's Silent failures.
//
// Scoped to non-production, so the deployed allowlist stays exact-match:
// this widens what a DEVELOPER's browser may call, never what the live
// API accepts. Covers localhost:5170-5199 plus 5200.
const DEV_ORIGIN = /^http:\/\/localhost:(51[7-9][0-9]|5200)$/;

const corsOptions = {
  origin: (incomingOrigin, callback) => {
    // Allow requests with no origin (e.g. Postman, curl, mobile apps)
    if (!incomingOrigin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(incomingOrigin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production' && DEV_ORIGIN.test(incomingOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS: Origin "${incomingOrigin}" is not allowed`));
  },
  credentials: true,          // Allow cookies/auth headers to be sent
  optionsSuccessStatus: 200,  // Some legacy browsers choke on 204
};

module.exports = corsOptions;