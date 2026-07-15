process.env.NODE_ENV = 'test';

const currentMongoUri = process.env.MONGO_URI;
const testMongoUri = currentMongoUri
  ? currentMongoUri.replace(/\/[^/?]+(\?.*)?$/, '/portfolio_test$1')
  : 'mongodb://localhost:27017/portfolio_test';

process.env.MONGO_URI = process.env.TEST_MONGO_URI || testMongoUri;

const { spawnSync } = require('child_process');

const jestBin = require.resolve('jest/bin/jest');
const result = spawnSync(
  process.execPath,
  [jestBin, ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

process.exit(result.status ?? 1);
