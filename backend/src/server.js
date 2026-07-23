// backend/src/server.js
// LOCAL DEVELOPMENT ONLY

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});