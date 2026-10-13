#!/usr/bin/env node
// backend/scripts/set-admin-password.js — `npm run admin:password` (PF-120)
//
// The BREAK-GLASS way to set the admin password: no email, no panel, no
// running server. Until PF-124/125 there was no way to change a password at
// all short of `npm run seed`, which wipes every collection first.
//
//   1. Reads MONGO_URI from backend/.env and refuses a URI with no database
//      name (assertExplicitDatabase — a pathless URI is the `test` database).
//   2. Prints the target database and makes you TYPE its name back. Pointing
//      a laptop at production is exactly what this script is for, so the
//      confirmation is the guard against doing it by accident.
//   3. Asks for the new password TWICE with hidden input.
//      ⚠️ Never as an argument or an env var: both land in shell history or
//      process listings. Refuses to run without a terminal for that reason.
//   4. Sets it through `save()`, so User's `pre('save')` hook hashes it.
//      ⚠️ Never an update query — those skip the hook and store PLAINTEXT.
//   5. Revokes every session the admin has: if the old password leaked,
//      whoever used it is signed out now, not when their token runs out.

require('dotenv').config();

const readline = require('readline');
const mongoose = require('mongoose');
const User     = require('../src/models/User');
const { assertExplicitDatabase } = require('../src/config/db');
const { revokeAllForUser }       = require('../src/services/sessionService');

/**
 * The part worth testing. Expects an open mongoose connection.
 * Throws (and changes nothing) unless there is exactly ONE user — this site
 * has one admin, and guessing which of several to change is not this
 * script's call.
 */
async function setAdminPassword({ password }) {
  const users = await User.find({});
  if (users.length !== 1) {
    throw new Error(`Expected exactly one admin user, found ${users.length}. Nothing changed.`);
  }
  const [user] = users;
  user.password = password;
  await user.save();               // pre('save') hashes; schema enforces the minimum length
  await revokeAllForUser(user._id);
  return { email: user.email };
}

/** One line of input. `hidden` echoes nothing while the user types. */
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // readline echoes each keystroke through _writeToOutput; after the
      // prompt itself is printed, swallow everything until Enter.
      rl._writeToOutput = (s) => { if (!rl.muted) rl.output.write(s); };
    }
    rl.question(question, (answer) => {
      if (hidden) process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
    rl.muted = hidden;
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error('Run this in a terminal — the password is typed, never piped or passed as an argument.');
  }

  const dbName = assertExplicitDatabase(process.env.MONGO_URI);
  console.log(`\nThis sets the admin password in database: ${dbName}`);
  const typed = await ask('Type the database name to confirm: ');
  if (typed.trim() !== dbName) throw new Error('Database name did not match. Nothing changed.');

  const password = await ask('New password: ', { hidden: true });
  const again    = await ask('Repeat it:    ', { hidden: true });
  if (password !== again) throw new Error('The two entries differ. Nothing changed.');

  await mongoose.connect(process.env.MONGO_URI);
  const { email } = await setAdminPassword({ password });
  console.log(`✅ Password set for ${email}. Every existing session has been signed out.`);
}

if (require.main === module) {
  main()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      // The message only — a Mongoose ValidationError's full object carries
      // the value it rejected, which here would be the password.
      console.error(`✖ ${err.message}`);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { setAdminPassword };
