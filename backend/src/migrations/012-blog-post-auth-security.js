#!/usr/bin/env node
// backend/src/migrations/012-blog-post-auth-security.js
//
// PF-137 (owner, 2026-10-30) — adds one blog post: how the admin panel's
// authentication and security were built.
//
// ── IT ARRIVES AS A DRAFT ───────────────────────────────────────────────────
// The owner's rule for every new record (2026-10-03): nothing new is public
// until the owner publishes it. The post lands in Admin → Blog as a draft;
// reading, editing and PUBLISH happen in the panel. `publishedAt` stays null —
// PUBLISH stamps it (PF-104).
//
// ── IDEMPOTENT, AND NEVER OVERWRITES ────────────────────────────────────────
// One atomic upsert keyed on the slug with `$setOnInsert`: if a post at this
// URL already exists — this one after the owner edited it, or any other — it
// is left exactly as it is and reported OK. A second run changes nothing.
//
// ── SELF-CONTAINED ON PURPOSE ───────────────────────────────────────────────
// The text lives in THIS file, not in a data module it requires: the runner's
// checksum covers this file only, so a required module could change after the
// migration ran in production without the guard noticing.
//
// Raw driver throughout (migration 007's rule). The slug and reading time are
// written as the model would derive them; 012's test proves both by loading
// the row through the model and checking nothing changes, and that the post
// can be PUBLISHED as stored.
//
// The two tags are added to the tag vocabulary (upsert) so the panel's chip
// picker offers them.
//
// Usage:
//   node src/migrations/012-blog-post-auth-security.js --dry-run
//   node src/migrations/012-blog-post-auth-security.js

require('dotenv').config();
const mongoose = require('mongoose');
const { databaseNameFrom } = require('../config/db');

const isDryRun = () => process.argv.includes('--dry-run');

const TAGS = ['Security', 'Authentication'];

const POST = {
  title: 'Authentication and Security: How I Locked Down My Portfolio’s Admin Panel',
  slug: 'authentication-and-security-how-i-locked-down-my-portfolios-admin-panel',
  excerpt:
    'A walk through the sign-in, sessions, password recovery, alerts and browser defences behind my portfolio’s admin panel, and the NIST and OWASP standards each decision came from.',
  tags: TAGS,
  sections: [
    {
      heading: 'Introduction',
      body: [
        'My portfolio has an admin panel. From it I edit every project, skill and blog post, read the messages visitors send, and download or restore a full backup of the site. Anyone who signs in to it can change what the world sees under my name.',
        'That makes the front door the most valuable part of the whole application, so I decided early on to build it the way a professional team would: not from instinct, but from published standards, with every decision written down and tested.',
        'This post walks through what I built, in the order a visitor to the admin panel meets it, and why each piece is there.',
      ],
      bullets: [],
    },
    {
      heading: 'Start From Standards, Not From Instinct',
      body: [
        'Security is full of advice that sounds sensible and is wrong. Forcing a symbol into every password, making people change it every ninety days, and showing a password hint all feel protective, and all three make real accounts weaker.',
        'So every rule in the panel traces back to a source I can name:',
      ],
      bullets: [
        'NIST SP 800-63B, the US government’s guidance on passwords, sessions and authenticators.',
        'The OWASP Application Security Verification Standard (ASVS), a checklist of what a secure web application must do.',
        'The OWASP Cheat Sheets for authentication, session management, forgotten passwords, input validation and logging.',
        'RFC 7636 (PKCE) and RFC 9700, the current best practice for OAuth 2.0 sign-in.',
      ],
    },
    {
      heading: 'Passwords: Length Beats Complexity',
      body: [
        'NIST’s guidance is clear that length is what makes a password strong. A long passphrase of ordinary words is far harder to guess than a short string of substituted symbols, and it is easier to remember.',
        'So the panel asks for a long password, at least fifteen characters, and deliberately does not demand a capital letter, a number or a symbol. Instead, every new password has to pass four checks:',
      ],
      bullets: [
        'It must not contain my name, my email address or words from the site itself, which are the first things an attacker would try.',
        'It must score the top mark on zxcvbn, a strength estimator that recognises keyboard patterns, dates, repeats and common words.',
        'It must not match any of my last five passwords.',
        'It must not appear in a known data breach, checked against the Have I Been Pwned database.',
      ],
    },
    {
      heading: 'Checking Breaches Without Sending the Password',
      body: [
        'Asking a third party whether a password has leaked sounds like a leak in itself. Have I Been Pwned solves this with a technique called k-anonymity: the server hashes the password with SHA-1 and sends only the first five characters of that hash. The service replies with every leaked hash that starts the same way, and the comparison happens on my server. The password, and even its full hash, never leave it.',
        'The same check also runs quietly when I sign in. If the password I am using today shows up in a breach published after I chose it, I am still let in, but every admin page shows a banner asking me to change it. That is NIST’s rule: change a password when there is evidence it is compromised, not on a timer.',
        'If the breach service is unreachable, the check fails open. A third-party outage should never lock the owner out of their own site.',
      ],
      bullets: [],
    },
    {
      heading: 'Storing Passwords Safely',
      body: [
        'The database never holds a password, only a bcrypt hash of it. Bcrypt is slow on purpose and salts every hash, so a stolen copy of the database cannot be reversed with a lookup table, and each guess costs an attacker real time.',
        'There is exactly one function in the code that writes a password, and every path that sets one goes through it: the forgotten-password reset, the change from Settings and the emergency command-line reset. One writer means one place to get hashing, history and session revocation right.',
        'Sign-in also guards against a subtler leak. If the address is unknown, the server still runs a bcrypt comparison against a dummy hash, so a wrong address takes as long to reject as a wrong password. Without that, an attacker could time the responses to learn which addresses have accounts.',
      ],
      bullets: [],
    },
    {
      heading: 'Signing In With Google, the Modern Way',
      body: [
        'The panel also offers Sign in with Google. It uses the OAuth 2.0 authorization code flow with PKCE, which is what current best practice recommends for every kind of client.',
        'In plain words: the browser never receives a Google token at all. Google hands back a one-time code, my backend exchanges it directly with Google together with a secret only the backend knows, and it verifies the identity token it gets back, including that the token was issued for my application and no other.',
      ],
      bullets: [
        'PKCE ties the code to the browser that started the sign-in, so an intercepted code is useless to anyone else.',
        'A state value protects against a forged sign-in started from another site.',
        'Google never creates an account. It can only sign in to an address I have already allowed, and the first Google account to do so is bound to that address from then on.',
      ],
    },
    {
      heading: 'Sessions: Short-Lived Access, Rotating Refresh',
      body: [
        'After signing in, the browser holds two things. An access token, a signed JWT that proves who I am on each request, lives only in memory and expires after fifteen minutes. A refresh token is used to get a new access token when the old one runs out.',
        'The refresh token rotates: every time it is used, the server issues a new one and retires the old. If a retired token is ever presented again, that can only mean two copies exist, mine and someone else’s, so the server treats it as theft and ends that whole session at once. This is refresh token reuse detection, recommended by the OAuth security best practice.',
        'Each session is a row in the database, so the server, not the token, has the final say. Signing out, resetting a password or ending a session from another device takes effect on the server immediately.',
      ],
      bullets: [],
    },
    {
      heading: 'Seeing and Ending Sessions',
      body: [
        'The Settings page lists every device that is signed in: the browser and system, roughly where it signed in from, when it started and when it was last active. The device I am using is marked, and any other can be signed out.',
        'Signing out another device asks for my password first. ASVS requires re-authentication before sensitive account actions, because a stolen, already-open session should not be enough to lock the real owner out.',
        'Below the list is a sign-in history for the last ninety days: successes and failures, the method used and the device. Old entries expire on their own, so the history never grows without limit.',
      ],
      bullets: [],
    },
    {
      heading: 'Forgot Password, Without Helping an Attacker',
      body: [
        'A careless forgot-password form tells attackers which email addresses have accounts: “we have sent you a code” for one, “no such user” for another. This is called user enumeration, and OWASP lists it as a weakness to avoid.',
        'My form gives exactly the same answer, in the same amount of time, for any address. The real work, looking up the account and sending the email, happens after the response has already gone back, so even the timing reveals nothing.',
      ],
      bullets: [
        'The emailed code is six digits, stored only as an HMAC so a database copy does not reveal it.',
        'It expires after ten minutes, the maximum NIST allows for this kind of code, and works only once.',
        'Only a handful of wrong guesses are allowed, counted inside the database query itself so two parallel guesses cannot both slip through.',
        'A successful reset ends every session everywhere and sends an email saying the password was changed.',
        'The reset does not sign anyone in. You sign in afresh with the new password, like everyone else.',
      ],
    },
    {
      heading: 'Changing a Password While Signed In',
      body: [
        'Changing the password from Settings takes two steps: my current password, then a code emailed to the address I signed in with. An open laptop alone is not enough, and neither is a stolen password alone.',
        'Every check on the new password happens before the code is sent, so a weak choice is refused straight away instead of after a trip to the inbox. When the change completes, every other device is signed out and this one stays signed in.',
        'A wrong current password is answered with a plain “check and try again”, never with a sign-out. An error that ended the session would turn a typo into a lockout.',
      ],
      bullets: [],
    },
    {
      heading: 'Rate Limiting on a Serverless Platform',
      body: [
        'Every door that accepts a password or a code has its own rate limiter, and the whole API has a general one on top. Limiting attempts is what turns guessing from a matter of minutes into a matter of centuries.',
        'There was a catch. The backend runs as serverless functions, and a limiter that counts in memory forgets everything whenever a new instance starts, which on a serverless host can be every few requests. An attacker would simply be talking to a fresh counter each time.',
        'So every limiter counts in MongoDB instead, with one atomic update per request and the database’s own clock deciding when a window ends. The limits now hold across every instance and survive restarts.',
        'The two kinds of limiter fail differently on purpose. If the database cannot be reached, the general limiter lets traffic through, so visitors can still read the site, while the sign-in limiters refuse, so an outage never becomes a free-for-all on the password form.',
      ],
      bullets: [],
    },
    {
      heading: 'Alerts: Hearing About It When Something Happens',
      body: [
        'Defences only help if someone notices when they are tested. The panel sends three kinds of security email:',
      ],
      bullets: [
        'A sign-in alert, only when a device I have not used recently signs in, so a normal day stays quiet and an unusual one stands out.',
        'A password-changed alert, to the main address and the one the change was made from.',
        'A daily digest of failed sign-ins, so a slow, patient guessing attempt still shows up somewhere.',
      ],
    },
    {
      heading: 'Defending the Browser',
      body: [
        'Some attacks never touch the server. They run inside the browser of someone already signed in. The main defence against that is a strict Content Security Policy, a header that tells the browser exactly which scripts it may run.',
        'My policy allows scripts from the site itself and inline scripts only by their exact cryptographic hash, never anything injected. It also forbids other sites from framing the pages, which blocks clickjacking. These headers live in the deployment configuration and a test fails the build if they are weakened.',
      ],
      bullets: [
        'Helmet sets the standard security headers on every API response.',
        'CORS accepts requests only from the site’s exact origins.',
        'Admin and sign-in responses are marked no-store, so no cache keeps a copy.',
      ],
    },
    {
      heading: 'Treating Every Input as Hostile',
      body: [
        'Every request body is validated before it reaches the database, with a size limit on the body itself. Beyond the obvious checks, three classes of attack shaped the code:',
      ],
      bullets: [
        'NoSQL injection: a value that should be a string must be a string. An object such as a MongoDB operator, or an array, is refused before any query runs.',
        'Mass assignment: the server only accepts the fields a form is meant to change. A request that adds an extra field, such as one that would make a user an administrator, has it dropped.',
        'File uploads: images are checked by their first bytes, the file’s real signature, never by the name or the type the browser claims, and each upload has its own route that decides where the file is stored.',
        'Backups: even a backup file I downloaded myself is treated as untrusted on restore. Every row is checked by the real model rules, and the restore is all or nothing inside one database transaction, with a safety copy of what it replaced.',
      ],
    },
    {
      heading: 'Secrets, Logs and the Pipeline',
      body: [
        'Secrets live in environment variables, never in the repository. The logs are written so they cannot leak them either: tokens, codes and passwords are never logged, and library errors that embed a token are not printed.',
        'The CI pipeline treats security as a gate, not a suggestion. Every push runs a credential scan, a dependency audit, CodeQL static analysis and the full test suites, and nothing reaches production unless all of them pass. Dependabot keeps libraries patched, and database migrations and deployments each wait for my explicit approval.',
      ],
      bullets: [],
    },
    {
      heading: 'What Comes Next',
      body: [
        'Security is never finished. Once the site moves to its own domain, two upgrades are planned: moving the refresh token into an httpOnly cookie the page’s scripts cannot read, and adding passkeys, which replace the password entirely with a key that cannot be phished.',
      ],
      bullets: [],
    },
    {
      heading: 'Takeaways',
      body: [
        'The biggest lesson was that good security is mostly careful, unglamorous decisions, each with a reason behind it:',
      ],
      bullets: [
        'Build from standards like NIST and OWASP, not from rules that merely feel safe.',
        'Never tell an attacker what they do not already know, whether in an error message, a response or its timing.',
        'Keep one place for every sensitive operation, so it can be right once.',
        'Make defences visible to the owner through alerts, history and sessions they can end.',
        'Test the guards themselves, including that they fail when they should.',
      ],
    },
  ],
};

// The model's formula (models/Blog.js calculateReadingTimeMinutes), copied so
// this file never depends on the model's future shape. 012's test proves the
// two still agree for this post.
function readingTimeMinutes(sections) {
  const words = (text) => (text && text.trim() ? text.trim().split(/\s+/).length : 0);
  let count = 0;
  for (const s of sections) {
    count += words(s.heading);
    for (const p of s.body) count += words(p);
    for (const b of s.bullets) count += words(b);
  }
  return count > 0 ? Math.max(1, Math.ceil(count / 200)) : 1;
}

async function run() {
  const DRY_RUN = isDryRun();
  const targetDb = databaseNameFrom(process.env.MONGO_URI);

  console.log('');
  console.log(`Target database: ${targetDb ?? '(none — MONGO_URI has no database name)'}`);
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN — writes nothing' : 'LIVE — will write'}`);
  if (!DRY_RUN && targetDb === 'portfolio_prod') {
    console.log('⚠️  This is a REAL RUN against portfolio_prod.');
  }
  console.log('─'.repeat(56));

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const db = mongoose.connection;
    const now = new Date();

    console.log('\nBlog');
    const exists = await db.collection('blogs').findOne({ slug: POST.slug }, { projection: { _id: 1 } });
    if (exists) {
      console.log(`  ✅ OK       ${exists._id}  (a post at /${POST.slug} already exists — left as it is)`);
    } else {
      console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  INSERT'}  "${POST.title}"  (DRAFT)`);
      if (!DRY_RUN) {
        await db.collection('blogs').updateOne(
          { slug: POST.slug },
          {
            $setOnInsert: {
              ...POST,
              published:           false,
              publishedAt:         null,
              readingTimeMinutes:  readingTimeMinutes(POST.sections),
              readingTimeOverride: null,
              views:               0,
              createdAt:           now,
              updatedAt:           now,
              __v:                 0,
            },
          },
          { upsert: true }
        );
      }
    }

    console.log('\nVocabulary (tag)');
    for (const value of TAGS) {
      const found = await db.collection('vocabularies').findOne({ type: 'tag', value });
      if (found) {
        console.log(`  ✅ OK       ${value}`);
      } else {
        console.log(`  ${DRY_RUN ? '🔎 WOULD  ' : '✏️  INSERT'}  ${value}`);
        if (!DRY_RUN) {
          await db.collection('vocabularies').updateOne(
            { type: 'tag', value },
            { $setOnInsert: { type: 'tag', value, order: 0, createdAt: now, updatedAt: now, __v: 0 } },
            { upsert: true }
          );
        }
      }
    }

    console.log('\n' + '─'.repeat(56));
    if (DRY_RUN) console.log('\nDRY RUN — no changes were written.');
    console.log('');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { run, POST, TAGS, readingTimeMinutes };
