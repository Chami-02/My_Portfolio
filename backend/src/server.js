// backend/src/server.js
// LOCAL DEVELOPMENT ONLY

const app = require('./app');            // also loads .env
const { assertExplicitDatabase } = require('./config/db');

// PF-66 — fail at boot, not on the first request. connectDB() is called from
// middleware, so without this a pathless MONGO_URI would only surface as a 500
// once someone hit an endpoint. A long-running process should refuse to start.
assertExplicitDatabase(process.env.MONGO_URI);

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});