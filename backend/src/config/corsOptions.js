// The complete list of frontend URLs that are allowed to call this API.
// Add your production Vercel URL here before deploying (Sprint 8).
const ALLOWED_ORIGINS = [
  'http://localhost:5173',           // Vite dev server (Docker)
  'http://localhost:3000',           // Alternative dev port
  // 'https://your-name.vercel.app', // ← Add this in Sprint 8 (PF-50)
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