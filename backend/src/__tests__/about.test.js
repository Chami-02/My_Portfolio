const request = require('supertest');
const { issueSession } = require('../services/sessionService');
const app     = require('../app');
const About   = require('../models/About');
const User    = require('../models/User');
const { connectTestDB, clearDB, disconnectTestDB } = require('./helpers/db');

beforeAll(connectTestDB);
afterEach(clearDB);
afterAll(disconnectTestDB);

const ADMIN = { email: 'admin@test.com', password: 'TestPass@1234!' };

const authHeader = async () => {
  let user = await User.findOne({ email: ADMIN.email });
  if (!user) user = await User.create(ADMIN);
  // PF-108: through the real session path, so the token names a live family.
  const { accessToken: token } = await issueSession(user);
  return { Authorization: `Bearer ${token}` };
};

describe('GET /api/about', () => {
  it('creates and returns a default profile when none exists', async () => {
    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.name).toBeDefined();
    await expect(About.countDocuments()).resolves.toBe(1);
  });

  it('returns the existing profile', async () => {
    await About.create({ name: 'Existing Admin', title: 'Developer' });

    const res = await request(app).get('/api/about');

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Existing Admin');
  });
});

describe('PUT /api/about', () => {
  it('upserts the profile when authenticated', async () => {
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({
        name:  'Updated Admin',
        title: 'Full Stack Developer',
        email: 'updated@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Admin');
    expect(res.body.data.title).toBe('Full Stack Developer');
  });

  it('rejects invalid profile input', async () => {
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  it('returns 400 for model validation errors', async () => {
    const res = await request(app)
      .put('/api/about')
      .set(await authHeader())
      .send({ stats: [{}] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  // ── PF-112: authentication is the FIRST gate ────────────────────────────
  // The route used to run `aboutRules, validate, protect`, so express-validator
  // rejected the body before `protect` ever looked at the headers. An anonymous
  // caller therefore received a 400 NAMING THE FIELD IT DISLIKED — a free
  // description of the schema to someone with no credentials at all.
  //
  // ⚠️ The body has to be one `aboutRules` actually rejects, or this passes for
  // the wrong reason: a payload nothing validates reaches `protect` regardless
  // of the ordering, and the test would stay green through a revert.
  it('answers an anonymous PUT with 401, not a 400 describing the schema', async () => {
    const res = await request(app)
      .put('/api/about')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(401);
    expect(res.body.message).not.toMatch(/valid email/i);
  });

  // ── PF-112: availableForWork travels on the profile PUT ──────────────────
  // The admin panel stages every edit and commits them together, so the
  // availability flag arrives here rather than through PATCH /availability.
  describe('availableForWork', () => {
    it('rejects a non-boolean availability', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ availableForWork: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/true or false/i);
    });

    // ⚠️ THE CASE THAT MATTERS. `false` is falsy, so a rule or a payload builder
    // that conflates "absent" with "false" would validate fine and then simply
    // never write it — leaving the owner permanently marked as available with
    // every request reporting success.
    it('persists availableForWork: false', async () => {
      await About.create({ availableForWork: true });

      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ availableForWork: false });

      expect(res.status).toBe(200);
      expect(res.body.data.availableForWork).toBe(false);
      await expect(
        About.findOne({}).then((d) => d.availableForWork)
      ).resolves.toBe(false);
    });

    it('accepts availableForWork: true', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ availableForWork: true });

      expect(res.status).toBe(200);
      expect(res.body.data.availableForWork).toBe(true);
    });
  });

  // ── PF-112: THE property that makes dropping name/title from the panel safe ──
  //
  // The admin form stopped sending `name` and `title`, because editing them
  // changed nothing on the public site (both are hardcoded literals there). That
  // is only safe if an OMITTED key keeps its stored value — `updateAbout` does
  // `$set: safe`, which writes only the keys it is given.
  //
  // ⚠️ Worth an integration test rather than trusting the semantics, because the
  // failure mode is silent and destructive: if `$set` were ever swapped for a
  // whole-document replace, every save from the About panel would blank `name`,
  // a required field, and the first sign would be a 400 from an unrelated form.
  it('leaves an omitted field untouched rather than blanking it', async () => {
    const header = await authHeader();
    await request(app).put('/api/about').set(header)
      .send({ name: 'Set Once', title: 'Also Once', location: 'Galle, Sri Lanka' });

    // Exactly what the panel now sends: no name, no title.
    const res = await request(app).put('/api/about').set(header)
      .send({ location: 'Colombo, Sri Lanka', email: 'x@y.co', availabilityNote: 'note' });

    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe('Colombo, Sri Lanka');
    expect(res.body.data.name).toBe('Set Once');
    expect(res.body.data.title).toBe('Also Once');
  });

  // ── PF-112: custom social links over HTTP ─────────────────────────────────
  // The sub-schema does the per-row work; `aboutRules` only has to reject a
  // wrong TYPE with a message naming the field, rather than letting Mongoose cast
  // it into something surprising and 400 with a CastError.
  describe('socialExtra', () => {
    it('saves a custom link', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ socialExtra: [{ label: 'YouTube', url: 'https://youtube.com/@x' }] });

      expect(res.status).toBe(200);
      expect(res.body.data.socialExtra).toHaveLength(1);
      expect(res.body.data.socialExtra[0].label).toBe('YouTube');
    });

    it('rejects a non-list', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ socialExtra: 'youtube' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be a list/i);
    });

    it('rejects a row with no URL, through the model', async () => {
      const res = await request(app)
        .put('/api/about')
        .set(await authHeader())
        .send({ socialExtra: [{ label: 'YouTube', url: '' }] });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/needs a URL/i);
    });

    // ⚠️ Replacing the whole array is CORRECT for this field — it is how a
    // removed row disappears. Worth pinning, because the instinct from PF-111's
    // `backgroundImage` trap is to reach for a dot path, which here would leave
    // deleted rows behind.
    it('replaces the whole list rather than merging into it', async () => {
      const header = await authHeader();
      await request(app).put('/api/about').set(header)
        .send({ socialExtra: [{ label: 'YouTube', url: 'https://y.example' }] });

      const res = await request(app).put('/api/about').set(header)
        .send({ socialExtra: [] });

      expect(res.status).toBe(200);
      expect(res.body.data.socialExtra).toEqual([]);
    });
  });
});

describe('PATCH /api/about/availability', () => {
  it('toggles availability when authenticated', async () => {
    const about = await About.create({ availableForWork: true });
    const header = await authHeader();

    const unavailableRes = await request(app)
      .patch('/api/about/availability')
      .set(header);

    expect(unavailableRes.status).toBe(200);
    expect(unavailableRes.body.data.availableForWork).toBe(false);
    expect(unavailableRes.body.message).toMatch(/not available/i);

    const availableRes = await request(app)
      .patch('/api/about/availability')
      .set(header);

    expect(availableRes.status).toBe(200);
    expect(availableRes.body.data.availableForWork).toBe(true);
    expect(availableRes.body.data._id).toBe(about.id);
  });

  it('returns 404 when no profile exists', async () => {
    const res = await request(app)
      .patch('/api/about/availability')
      .set(await authHeader());

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/profile not found/i);
  });
});

// ── The About section's stat cards ───────────────────────────────────────────
//
// `stats[]` has been in the schema and in `seed.js` since Phase 1, and until
// this ticket NOTHING read it — not the admin panel, not the public site. That
// is a state a green suite reports as healthy: a field nobody consumes still
// round-trips through every API test it has. The panel edits it now and the
// public About section renders it, so these pin the write path.
describe('PUT /api/about — stats', () => {
  it('stores the rows the panel sends, in order', async () => {
    const headers = await authHeader();

    const res = await request(app)
      .put('/api/about')
      .set(headers)
      .send({
        stats: [
          { label: 'Projects Built', value: '5+' },
          { label: 'Learning',       value: 'Continuous' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toHaveLength(2);
    expect(res.body.data.stats.map((s) => s.label))
      .toEqual(['Projects Built', 'Learning']);
    expect(res.body.data.stats[0].value).toBe('5+');
  });

  it('replaces the whole list rather than merging into it', async () => {
    // ⚠️ `$set` on an array REPLACES it, which is what the panel relies on —
    // removing a row in the form has to remove it in the database. Asserted
    // explicitly because "merge" is the behaviour people expect of `$set` on a
    // nested path, and the two differ only when rows are DELETED.
    const headers = await authHeader();
    await request(app).put('/api/about').set(headers)
      .send({ stats: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }] });

    const res = await request(app).put('/api/about').set(headers)
      .send({ stats: [{ label: 'B', value: '2' }] });

    expect(res.body.data.stats).toHaveLength(1);
    expect(res.body.data.stats[0].label).toBe('B');
  });

  it('accepts an empty list — the owner deleting every card', async () => {
    const headers = await authHeader();
    await request(app).put('/api/about').set(headers)
      .send({ stats: [{ label: 'A', value: '1' }] });

    const res = await request(app).put('/api/about').set(headers).send({ stats: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toEqual([]);
  });

  it('leaves the stored stats alone when the key is absent', async () => {
    // The same guarantee `name` and `title` rely on: `$set: safe` writes only
    // the keys it is given, so a payload without `stats` is not a payload that
    // clears them.
    const headers = await authHeader();
    await request(app).put('/api/about').set(headers)
      .send({ stats: [{ label: 'A', value: '1' }] });

    const res = await request(app).put('/api/about').set(headers)
      .send({ location: 'Colombo, Sri Lanka' });

    expect(res.body.data.stats).toHaveLength(1);
    expect(res.body.data.location).toBe('Colombo, Sri Lanka');
  });

  it('400s when stats is not a list', async () => {
    // Without the express-validator rule a string reaches `$set` and Mongoose's
    // cast decides — an opaque CastError that names no field.
    const headers = await authHeader();

    const res = await request(app)
      .put('/api/about')
      .set(headers)
      .send({ stats: 'five' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/Stats must be a list/i);
  });

  it('400s on a half-filled row, and writes nothing', async () => {
    // ⚠️ The model marks BOTH halves required, so one bad row rejects the whole
    // save. That is why `formToPayload` drops incomplete rows client-side
    // rather than sending them — otherwise an unfinished stat would take every
    // other edit on the form down with it.
    const headers = await authHeader();
    await request(app).put('/api/about').set(headers)
      .send({ stats: [{ label: 'Kept', value: '1' }] });

    const res = await request(app).put('/api/about').set(headers)
      .send({ stats: [{ label: 'No value' }] });

    expect(res.status).toBe(400);

    const after = await About.findOne();
    expect(after.stats).toHaveLength(1);
    expect(after.stats[0].label).toBe('Kept');
  });
});
