require('dotenv').config();

process.env.NODE_ENV = 'test';

// ── Where the tests' database is ─────────────────────────────────────────────
// DEFAULT (since the faster-tests change): an IN-MEMORY MongoDB that Jest's
// globalSetup starts on this machine — no network, nothing shared. Each worker
// then gets its own `portfolio_test_<n>` (src/__tests__/setup/).
//
// `--atlas` (npm run test:atlas), or an explicit TEST_MONGO_URI, runs against a
// REAL server instead. ⚠️ The database name is still forced to portfolio_test
// below, so even that path can never wipe dev or production data — this
// rewrite is the guard clearDB's wipe has always relied on, and it stays.
const atlas = process.argv.includes('--atlas');
const args = process.argv.slice(2).filter((a) => a !== '--atlas');

const currentMongoUri = process.env.MONGO_URI;
let testMongoUri;
if (currentMongoUri) {
  const uri = new URL(currentMongoUri);
  uri.pathname = '/portfolio_test';
  testMongoUri = uri.toString();
} else {
  testMongoUri = 'mongodb://localhost:27017/portfolio_test';
}

if (atlas && !process.env.TEST_MONGO_URI) process.env.TEST_MONGO_URI = testMongoUri;
process.env.MONGO_URI = process.env.TEST_MONGO_URI || testMongoUri;

const { spawnSync } = require('child_process');

const jestBin = require.resolve('jest/bin/jest');
const result = spawnSync(
  process.execPath,
  [jestBin, ...args],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
