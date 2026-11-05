const mongoose = require('mongoose');

/**
 * One row per passkey on the admin account (PF-140).
 *
 * Only the PUBLIC half is stored. It can check a signature and can never make
 * one, so a database read (backup, Compass, a leaked dump) yields nothing that
 * signs in. The private half stays on the owner's device or in their password
 * manager, and this server never sees it.
 *
 *   credentialId  base64url; how a sign-in names its passkey
 *   counter       the device's use count. Many report 0 forever, which WebAuthn
 *                 §6.1.1 says means "no counter"; the library handles that
 *   synced        'multiDevice': copied between devices by a password manager
 *   label         the device that added it ("Chrome on macOS"), never the raw
 *                 User-Agent
 */
const passkeySchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    credentialId: { type: String, required: true, unique: true },
    publicKey:    { type: Buffer, required: true },
    counter:      { type: Number, required: true, default: 0 },
    transports:   { type: [String], default: undefined },
    synced:       { type: Boolean, required: true, default: false },
    label:        { type: String },
    lastUsedAt:   { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

module.exports = mongoose.model('Passkey', passkeySchema);
