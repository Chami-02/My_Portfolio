const mongoose = require('mongoose');

// Cache the connection across warm serverless invocations.
// 'global' persists between invocations of the SAME warm function instance
// (and also survives hot-reloads in local development).
let cached = global._mongooseConnection;
if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

/**
 * Connects to MongoDB, reusing an existing connection if one is already
 * open or being established. Safe to call on every request — it will
 * only actually connect once per warm function instance.
 */
async function connectDB() {
  // Already connected — reuse it, no new connection made
  if (cached.conn) {
    return cached.conn;
  }

  // Not connected yet, but a connection attempt is already in progress —
  // wait for that one rather than starting a second one
  if (!cached.promise) {
    const options = {
      maxPoolSize: 10,           // Cap connections per function instance
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,     // Fail fast instead of silently queuing commands
    };

    cached.promise = mongoose.connect(process.env.MONGO_URI, options).then((m) => {
      console.log(`✅ MongoDB connected: ${m.connection.host}`);
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset the promise so the NEXT request can retry the connection
    // (important — without this, one failed connection would permanently
    // break every subsequent request on this warm instance)
    cached.promise = null;
    console.error('❌ MongoDB connection failed:', err.message);
    throw err;   // NEVER call process.exit() here — there is no persistent
                 // process to exit in a serverless function. Throwing lets
                 // the caller (our middleware, below) handle it as an error.
  }

  return cached.conn;
}

module.exports = connectDB;