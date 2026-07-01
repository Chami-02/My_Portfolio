const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the MONGO_URI from .env.
 * Called once in server.js before app.listen().
 * Exits the process if connection fails — no DB = no API.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    process.exit(1); // Non-zero exit = failure
  }
};

module.exports = connectDB;