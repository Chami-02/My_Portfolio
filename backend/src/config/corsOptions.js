// The complete list of frontend URLs that are allowed to call this API.
// Add your production Vercel URL here before deploying (Sprint 8).
const ALLOWED_ORIGINS = [
  'http://localhost:5173',                    // Local dev (Docker)
  'http://localhost:5174',                    // E2E frontend (PF-66) — Playwright only
  'https://my-portfoliofrontend-henna.vercel.app',
  // 'https://your-custom-domain.me',          // ← Add once you set up PF-51 (custom domain)
];

const corsOptions = {
  origin: (incomingOrigin, callback) => {
    // Allow requests with no origin (e.g. Postman, curl, mobile apps)
    if (!incomingOrigin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(incomingOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin "${incomingOrigin}" is not allowed`));
    }
  },
  credentials: true,          // Allow cookies/auth headers to be sent
  optionsSuccessStatus: 200,  // Some legacy browsers choke on 204
};

module.exports = corsOptions;