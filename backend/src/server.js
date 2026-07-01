// Entry point: connects to DB then starts listening.
// Kept deliberately small — all app logic is in app.js.

const app       = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start the server
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
  });

  // Graceful shutdown on Ctrl+C
  process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down gracefully');
    server.close(() => process.exit(0));
  });
});