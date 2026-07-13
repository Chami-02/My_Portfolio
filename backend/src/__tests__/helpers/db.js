const mongoose = require('mongoose');

const TEST_DB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio_test';

const connectTestDB = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI);
  }
};

const clearDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

const disconnectTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

module.exports = { connectTestDB, clearDB, disconnectTestDB };