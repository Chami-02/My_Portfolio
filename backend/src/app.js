require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const helmet     = require('helmet');
const path       = require('path');

const corsOptions        = require('./config/corsOptions');
const { globalLimiter }  = require('./middleware/rateLimiter');
const notFound           = require('./middleware/notFound');
const errorHandler       = require('./middleware/errorHandler');

const app = express();

// ── Security middleware ── ORDER MATTERS ──────────────────────────────────────
app.use(helmet());                               // Set secure HTTP headers first
app.use(cors(corsOptions));                      // CORS — before any routes
app.use(globalLimiter);                          // Rate limiting — before routes
app.use(
  morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined')
);                                               // Request logging
app.use(express.json({ limit: '10kb' }));        // Parse JSON bodies (limit size)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Serve uploaded files (images) ─────────────────────────────────────────────
// /uploads/filename.jpg → backend/src/uploads/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ─────────────────────────────────────────────────────────────
// This endpoint is used by Docker, Railway, and our CI pipeline
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    env:       process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
// Uncommented one by one as you build each sprint:
   app.use('/api/projects', require('./routes/projectRoutes'));   
   app.use('/api/skills',   require('./routes/skillRoutes'));     
   app.use('/api/contact',  require('./routes/contactRoutes'));   
   app.use('/api/blog',     require('./routes/blogRoutes'));      
   app.use('/api/about',    require('./routes/aboutRoutes'));     
   app.use('/api/auth',     require('./routes/authRoutes'));     

// ── Error handling ── MUST BE LAST ───────────────────────────────────────────
app.use(notFound);      // Catch any unmatched routes and create a 404 AppError
app.use(errorHandler);  // Handle ALL errors passed via next(err)

module.exports = app;