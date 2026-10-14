// backend/src/__tests__/setup/perWorkerDatabase.js
//
// Runs in EVERY Jest worker before its test files load (Jest `setupFiles`).
//
// Each worker gets its OWN database — portfolio_test_1, portfolio_test_2, … —
// so test files can run in PARALLEL without wiping each other's data: one
// file's clearDB() only empties its own worker's database.
//
// ⚠️ It rewrites MONGO_URI itself, not just a helper's variable, because three
// different things read MONGO_URI: the test helper, the app's connectDB(), and
// the child processes the migration tests spawn. One rewrite keeps all three
// pointed at the same database.
const worker = process.env.JEST_WORKER_ID || '1';
const base = process.env.MONGO_MEMORY_BASE_URI || process.env.TEST_MONGO_URI;

if (base) {
  const uri = new URL(base);
  uri.pathname = `/portfolio_test_${worker}`;
  process.env.MONGO_URI = uri.toString();
}
