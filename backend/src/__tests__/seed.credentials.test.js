// PF-120 — the public demo password may only ever be written to a throwaway
// database. Keyed on the DATABASE NAME; it used to be keyed on NODE_ENV, which
// is 'development' when a laptop seeds a live Atlas cluster.
const { resolveAdminCredentials } = require('../seed');

describe('resolveAdminCredentials (PF-120)', () => {
  const saved = process.env.SEED_ADMIN_PASSWORD;
  // run-jest.js loads the developer's real .env — never inherit its value.
  beforeEach(() => { delete process.env.SEED_ADMIN_PASSWORD; });
  afterAll(() => {
    if (saved === undefined) delete process.env.SEED_ADMIN_PASSWORD;
    else process.env.SEED_ADMIN_PASSWORD = saved;
  });

  it.each(['portfolio_prod', 'portfolio', 'portfolio_prod2', 'test_portfolio', 'portfolio_dev_old', undefined])(
    'refuses the demo password for %s',
    (dbName) => {
      expect(() => resolveAdminCredentials(dbName)).toThrow(/SEED_ADMIN_PASSWORD/);
    }
  );

  it('refuses even under NODE_ENV=development — the laptop-to-Atlas case', () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      expect(() => resolveAdminCredentials('portfolio_prod')).toThrow(/SEED_ADMIN_PASSWORD/);
    } finally {
      process.env.NODE_ENV = env;
    }
  });

  it.each(['portfolio_dev', 'portfolio_test', 'portfolio_test_3', 'portfolio_e2e', 'portfolio_ci'])(
    'allows the demo password for the throwaway %s',
    (dbName) => {
      expect(resolveAdminCredentials(dbName)).toMatchObject({ fromEnv: false });
    }
  );

  it('an env password always wins, on any database', () => {
    process.env.SEED_ADMIN_PASSWORD = 'a-long-owner-chosen-secret';
    expect(resolveAdminCredentials('portfolio_prod'))
      .toEqual(expect.objectContaining({ password: 'a-long-owner-chosen-secret', fromEnv: true }));
  });
});
