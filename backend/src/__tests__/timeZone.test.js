const { isTimeZone } = require('../utils/timeZone');

describe('isTimeZone', () => {
  it.each(['Asia/Colombo', 'Europe/London', 'UTC', 'America/Port-au-Prince', 'Etc/GMT+5', 'Asia/Calcutta'])(
    'accepts %s', (zone) => expect(isTimeZone(zone)).toBe(true),
  );

  it.each([
    ['blank', ''],
    ['an offset ICU itself accepts', '+05:30'],
    ['free text offset', 'UTC+5:30'],
    ['a typo', 'Asia/Colmbo'],
    ['a path trick', '../Asia/Colombo'],
    ['a number', 530],
    ['an array', ['Asia/Colombo']],
    ['null', null],
  ])('rejects %s', (_why, value) => expect(isTimeZone(value)).toBe(false));
});

describe('isTimeZone — the SHAPE check, on an engine that accepts offsets', () => {
  // ⚠️ Node 20's ICU REJECTED "+05:30"; Node 24 (this project's runtime since
  // 2026-10-15) ACCEPTS it, like Chrome (ECMA-402 2024 offset time zones). The
  // shape check is the only thing standing between a typed offset and a stored
  // fixed offset. The stub keeps that proof independent of the engine running
  // the tests — measured: on Node 24, removing the check fails 4 tests.
  let spy;
  beforeEach(() => { spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({})); });
  afterEach(() => spy.mockRestore());

  it.each(['+05:30', '-03:00', '+0530'])('still rejects the offset %s', (v) => {
    expect(isTimeZone(v)).toBe(false);
  });

  it('still accepts a place — the control', () => {
    expect(isTimeZone('Asia/Colombo')).toBe(true);
  });
});
