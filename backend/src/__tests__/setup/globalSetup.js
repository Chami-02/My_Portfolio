// backend/src/__tests__/setup/globalSetup.js
//
// Starts ONE in-memory MongoDB for the whole Jest run, before any test file
// loads. Every test then talks to a database on this machine instead of to
// MongoDB Atlas over the internet: ~1–2 s per test became milliseconds.
//
// ⚠️ OPT-OUT, deliberately explicit: set TEST_MONGO_URI to run the suite
// against a real server instead (`npm run test:atlas`). Nothing else turns the
// in-memory server off, so a stray MONGO_URI in .env can never send the suite
// to a shared database.
//
// Jest runs this ONCE in the parent process. Workers are spawned AFTER it, so
// the env var set here is inherited by every worker — that is how they find it.
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  if (process.env.TEST_MONGO_URI) return;

  const server = await MongoMemoryServer.create();
  // Base URI with no database path; perWorkerDatabase.js adds one per worker.
  process.env.MONGO_MEMORY_BASE_URI = server.getUri();
  // globalTeardown runs in this same parent process and stops it.
  globalThis.__MONGO_MEMORY_SERVER__ = server;
};
