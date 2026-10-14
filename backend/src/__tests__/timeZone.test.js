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
  // ⚠️ Node 20's ICU REJECTS "+05:30", so the tests above pass with or without
  // the shape check. Newer engines (ECMA-402 2024 offset time zones) ACCEPT it,
  // and then the shape check is the only thing standing between a typed offset
  // and a stored fixed offset. Simulate that engine to prove the check exists.
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
