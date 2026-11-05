const crypto = require('crypto');

/**
 * PF-140 — a real authenticator in software. It holds a real P-256 key and makes
 * the same bytes a phone or laptop would, so the tests go through the library's
 * REAL checks (origin, site, challenge, flags, signature, counter). Nothing in
 * WebAuthn is mocked.
 *
 * Each option a test can spoil is one a real device or an attacker controls:
 * `origin` (a fake site), `rpId`, `userVerified`, `counter`, `userHandle`.
 */
const FLAG = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40 };

const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const sha256 = (data) => crypto.createHash('sha256').update(data).digest();

/** CBOR byte-string header for a length below 65536. */
const cborBytes = (buf) => {
  const head = buf.length < 24 ? [0x40 + buf.length]
    : buf.length < 256 ? [0x58, buf.length]
      : [0x59, buf.length >> 8, buf.length & 0xff];
  return Buffer.concat([Buffer.from(head), buf]);
};

const createAuthenticator = ({ synced = true } = {}) => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const id = crypto.randomBytes(16);
  const jwk = publicKey.export({ format: 'jwk' });

  // A COSE_Key: { 1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y }
  const coseKey = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]),
    cborBytes(Buffer.from(jwk.x, 'base64url')),
    Buffer.from([0x22]),
    cborBytes(Buffer.from(jwk.y, 'base64url')),
  ]);

  const clientData = (type, challenge, origin) =>
    Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));

  const flags = ({ userVerified, attested }) =>
    FLAG.UP
    | (userVerified ? FLAG.UV : 0)
    | (synced ? FLAG.BE | FLAG.BS : 0)
    | (attested ? FLAG.AT : 0);

  const counterBytes = (counter) => {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(counter);
    return buf;
  };

  return {
    credentialId: b64(id),

    /** What `navigator.credentials.create()` hands back, as JSON. */
    register: ({ challenge, origin, rpId, userVerified = true }) => {
      const clientDataJSON = clientData('webauthn.create', challenge, origin);
      const idLength = Buffer.alloc(2);
      idLength.writeUInt16BE(id.length);
      const authData = Buffer.concat([
        sha256(rpId),
        Buffer.from([flags({ userVerified, attested: true })]),
        counterBytes(0),
        Buffer.alloc(16),   // aaguid: all zero, as with attestation "none"
        idLength,
        id,
        coseKey,
      ]);
      // { fmt: "none", attStmt: {}, authData }
      const attestationObject = Buffer.concat([
        Buffer.from([0xa3, 0x63]), Buffer.from('fmt'), Buffer.from([0x64]), Buffer.from('none'),
        Buffer.from([0x67]), Buffer.from('attStmt'), Buffer.from([0xa0]),
        Buffer.from([0x68]), Buffer.from('authData'), cborBytes(authData),
      ]);
      return {
        id: b64(id),
        rawId: b64(id),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(clientDataJSON),
          attestationObject: b64(attestationObject),
          transports: ['internal'],
        },
      };
    },

    /** What `navigator.credentials.get()` hands back, as JSON. */
    signIn: ({ challenge, origin, rpId, userVerified = true, counter = 0, userHandle }) => {
      const clientDataJSON = clientData('webauthn.get', challenge, origin);
      const authData = Buffer.concat([
        sha256(rpId),
        Buffer.from([flags({ userVerified, attested: false })]),
        counterBytes(counter),
      ]);
      const signature = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
      return {
        id: b64(id),
        rawId: b64(id),
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(clientDataJSON),
          authenticatorData: b64(authData),
          signature: b64(signature),
          ...(userHandle !== undefined && { userHandle }),
        },
      };
    },
  };
};

module.exports = { createAuthenticator };
