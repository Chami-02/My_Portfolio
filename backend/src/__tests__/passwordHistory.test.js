// PF-124 follow-up — the password history: no reuse of the last 5 (the current
// password + the 4 before it; PCI DSS v4.0 §8.3.7 asks for 4). Through the
// real model and its save hook.
const User = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const passwords = ['pw one sunset lamp', 'pw two river stone', 'pw three cedar hill',
  'pw four amber field', 'pw five quiet harbor', 'pw six silver meadow'];

const loaded = () => User.findOne({}).select('+password +passwordHistory');

/** Create the user with passwords[0], then change through each of the next `n`. */
const changeThrough = async (n) => {
  await User.create({ email: 'a@test.com', password: passwords[0] });
  for (let i = 1; i <= n; i += 1) {
    const u = await loaded();
    u.setPassword(passwords[i]);
    await u.save();
  }
  return loaded();
};

describe('User password history (PF-124)', () => {
  it(`keeps at most ${User.HISTORY_KEPT} previous hashes, newest first`, async () => {
    const u = await changeThrough(5);           // current = passwords[5]
    expect(u.passwordHistory).toHaveLength(User.HISTORY_KEPT);
    expect(await u.matchPassword(passwords[5])).toBe(true);
    // newest first: the entry right after the current one is passwords[4]
    const bcrypt = require('bcryptjs');
    expect(await bcrypt.compare(passwords[4], u.passwordHistory[0].hash)).toBe(true);
  });

  it('refuses the current password and each of the 4 before it', async () => {
    const u = await changeThrough(5);
    for (const p of passwords.slice(1)) {       // passwords[1..5] = the last 5
      expect(await u.usedRecently(p)).toBe(true);
    }
  });

  it('accepts the 6th-oldest again — it has left the history', async () => {
    const u = await changeThrough(5);
    expect(await u.usedRecently(passwords[0])).toBe(false);
  });

  it('`current`, once proved, is compared as text — not bcrypt', async () => {
    const u = await changeThrough(1);
    expect(await u.usedRecently('anything at all here', { current: 'anything at all here' })).toBe(true);
    // A wrong `current` text never matches, even if it is the real password's text.
    expect(await u.usedRecently('unrelated new phrase', { current: passwords[1] })).toBe(false);
  });

  it('stamps passwordChangedAt and stores only hashes', async () => {
    const u = await changeThrough(2);
    expect(u.passwordChangedAt).toBeInstanceOf(Date);
    const raw = JSON.stringify(await User.collection.findOne({}));
    for (const p of passwords) expect(raw).not.toContain(p);
  });

  it('refuses to run on a user loaded WITHOUT the history — it would wipe it', async () => {
    await changeThrough(2);
    const bare = await User.findOne({}).select('+password');   // no +passwordHistory
    expect(() => bare.setPassword('another long phrase')).toThrow(/\+passwordHistory/);
  });

  it('a pre-hashed password is saved as it is — not hashed twice', async () => {
    await User.create({ email: 'a@test.com', password: passwords[0] });
    const u = await loaded();
    u.setPassword(await User.hashPassword(passwords[1]), { hashed: true });
    await u.save();
    expect(await (await loaded()).matchPassword(passwords[1])).toBe(true);
  });
});
