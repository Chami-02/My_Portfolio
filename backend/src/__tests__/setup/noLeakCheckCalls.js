// backend/src/__tests__/setup/noLeakCheckCalls.js
//
// Runs in EVERY Jest worker before its test files load (Jest `setupFiles`).
//
// PF-133: every successful password sign-in now asks Have I Been Pwned, in
// the background, whether the password has leaked. Dozens of suites sign in,
// so without this each run would call api.pwnedpasswords.com from the test
// machine. Here a call to THAT host answers "not leaked" (an empty range, as
// the real API would for a hash it does not know); every other URL goes to
// the real fetch untouched. A test that checks the leak call itself spies on
// `global.fetch` (or mocks breachedPasswords) and overrides this.
const realFetch = global.fetch;

global.fetch = (url, init) =>
  (String(url).startsWith('https://api.pwnedpasswords.com/')
    ? Promise.resolve(new Response('', { status: 200 }))
    : realFetch(url, init));
