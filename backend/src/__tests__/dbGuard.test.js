// backend/src/__tests__/dbGuard.test.js
const { databaseNameFrom, assertExplicitDatabase } = require('../config/db');

describe('databaseNameFrom (PF-66)', () => {

  it('extracts a name from an srv URI', () => {
    expect(databaseNameFrom(
      'mongodb+srv://u:p@cluster.mongodb.net/portfolio?retryWrites=true'
    )).toBe('portfolio');
  });

  it('extracts a name from a standard URI', () => {
    expect(databaseNameFrom('mongodb://localhost:27017/portfolio_e2e'))
      .toBe('portfolio_e2e');
  });

  it('returns null when the path is empty — THE BUG THIS CATCHES', () => {
    expect(databaseNameFrom(
      'mongodb+srv://u:p@cluster.mongodb.net/?appName=portfolio-cluster'
    )).toBeNull();
  });

  it('returns null when there is no path at all', () => {
    expect(databaseNameFrom('mongodb+srv://u:p@cluster.mongodb.net'))
      .toBeNull();
  });

  it('handles a URI with no query string', () => {
    expect(databaseNameFrom('mongodb://localhost:27017/portfolio'))
      .toBe('portfolio');
  });

  it('returns null for empty input', () => {
    expect(databaseNameFrom('')).toBeNull();
    expect(databaseNameFrom(undefined)).toBeNull();
  });

});

describe('assertExplicitDatabase (PF-66, wired into the migration runner)', () => {

  /*
   * `databaseNameFrom` above answers "what database does this URI name?".
   * This one turns that answer into a REFUSAL, and until the migration runner
   * called it there was no caller outside `connectDB` — so `npm run migrate`
   * against a URI with no database path connected to `test` and reported a
   * clean plan against an empty database.
   */

  it('throws when there is no path at all', () => {
    expect(() => assertExplicitDatabase(
      'mongodb+srv://u:p@cluster.mongodb.net'
    )).toThrow(/has no database name/);
  });

  it('throws on a trailing-slash URI — THE SHAPE A HAND-EDIT PRODUCES', () => {
    // Deleting `portfolio_dev` from a working URI leaves exactly this.
    expect(() => assertExplicitDatabase(
      'mongodb+srv://u:p@cluster.mongodb.net/?retryWrites=true'
    )).toThrow(/has no database name/);
  });

  it('returns the name, and does not throw, for a valid URI', () => {
    expect(assertExplicitDatabase(
      'mongodb+srv://u:p@cluster.mongodb.net/portfolio_prod?retryWrites=true'
    )).toBe('portfolio_prod');
  });

  it('⚠️ is EXPORTED — the regression that made it uncallable', () => {
    // It has always existed in db.js; a consumer can only use it if the
    // module actually hands it out. A behavioural test alone would pass
    // against a copy of the function defined somewhere else.
    expect(typeof require('../config/db').assertExplicitDatabase).toBe('function');
  });

  it('does NOT object to a well-formed URI naming the wrong database', () => {
    // ⚠️ The limit of the guard, pinned so nobody reads it as more
    // protection than it is: /portfolio_dev in the production secret passes
    // here and always will. Only the banner's "Target database:" line and
    // the human approver catch that one.
    expect(assertExplicitDatabase(
      'mongodb+srv://u:p@cluster.mongodb.net/portfolio_dev'
    )).toBe('portfolio_dev');
  });

});
