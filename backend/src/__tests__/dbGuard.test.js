// backend/src/__tests__/dbGuard.test.js
const { databaseNameFrom } = require('../config/db');

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
