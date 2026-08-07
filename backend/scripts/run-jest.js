require('dotenv').config();

process.env.NODE_ENV = 'test';

const currentMongoUri = process.env.MONGO_URI;
let testMongoUri;
if (currentMongoUri) {
  const uri = new URL(currentMongoUri);
  uri.pathname = '/portfolio_test';
  testMongoUri = uri.toString();
} else {
  testMongoUri = 'mongodb://localhost:27017/portfolio_test';
}

process.env.MONGO_URI = process.env.TEST_MONGO_URI || testMongoUri;

const { spawnSync } = require('child_process');

const jestBin = require.resolve('jest/bin/jest');
const result = spawnSync(
  process.execPath,
  [jestBin, ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
