const mongoose = require('mongoose');

// Cache the connection across warm serverless invocations.
// 'global' persists between invocations of the SAME warm function instance
// (and also survives hot-reloads in local development).
let cached = global._mongooseConnection;
if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

/**
 * Extract the database name from a MongoDB connection string.
 *
 * Returns null when no database is specified — which is the case
 * this guard exists to catch. The driver silently defaults to a
 * database literally named "test" in that situation, and nothing
 * in the URI looks wrong.
 *
 * Added in PF-66.
 */
function databaseNameFrom(uri) {
  if (!uri) return null;

  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//i, '');
  const slash = afterScheme.indexOf('/');
  if (slash === -1) return null;                    // no path at all

  const path = afterScheme.slice(slash + 1);
  const name = path.split('?')[0].trim();

  return name || null;                              // "/" with no name
}

function assertExplicitDatabase(uri) {
  const name = databaseNameFrom(uri);

  if (!name) {
    throw new Error(
      'MONGO_URI has no database name.\n' +
      'The driver would silently connect to a database called "test".\n' +
      'Add an explicit name, e.g. ...mongodb.net/portfolio?retryWrites=true'
    );
  }

  return name;
}

/**
 * Connects to MongoDB, reusing an existing connection if one is already
 * open or being established. Safe to call on every request — it will
 * only actually connect once per warm function instance.
 */
async function connectDB() {
  // Refuse to go any further on a URI with no database name (PF-66).
  // Checked before the cache so a bad env can never be served from a
  // connection an earlier, better-configured call happened to open.
  const dbName = assertExplicitDatabase(process.env.MONGO_URI);

  // Already connected — reuse it, no new connection made
  if (cached.conn) {
    return cached.conn;
  }

  // Not connected yet, but a connection attempt is already in progress —
  // wait for that one rather than starting a second one
  if (!cached.promise) {
    // Logged here rather than at the top of the function so it prints once
    // per real connection, not once per request on a warm instance.
    console.log(`→ connecting to database: ${dbName}`);

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

// Attached to the exported function so `require('./config/db')` keeps
// returning connectDB itself for existing callers, while the PF-66 helpers
// stay reachable as named imports for their tests.
module.exports.databaseNameFrom = databaseNameFrom;
module.exports.assertExplicitDatabase = assertExplicitDatabase;