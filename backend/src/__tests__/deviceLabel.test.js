// PF-132 — the Sessions card's "Chrome on macOS" label, from real User-Agents.
const { deviceLabel, isBot, browserName, deviceType } = require('../utils/deviceLabel');

const UA = {
  chromeMac:     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariMac:     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  firefoxWin:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  edgeWin:       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  operaWin:      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/114.0.0.0',
  safariIphone:  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIphone:  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  firefoxIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung:       'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  chromeOs:      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  firefoxLinux:  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

describe('deviceLabel', () => {
  it.each([
    ['chromeMac',     'Chrome on macOS'],
    ['safariMac',     'Safari on macOS'],
    ['firefoxWin',    'Firefox on Windows'],
    ['edgeWin',       'Edge on Windows'],          // says Chrome/ too — Edge must win
    ['operaWin',      'Opera on Windows'],
    ['safariIphone',  'Safari on iOS'],            // says "like Mac OS X" — iOS must win
    ['chromeIphone',  'Chrome on iOS'],
    ['firefoxIphone', 'Firefox on iOS'],
    ['chromeAndroid', 'Chrome on Android'],        // says Linux too — Android must win
    ['samsung',       'Samsung Internet on Android'],
    ['chromeOs',      'Chrome on ChromeOS'],
    ['firefoxLinux',  'Firefox on Linux'],
  ])('%s → %s', (key, label) => {
    expect(deviceLabel(UA[key])).toBe(label);
  });

  it('names one half when only one is known', () => {
    expect(deviceLabel('curl/8.7.1 (Windows)')).toBe('Windows');
    expect(deviceLabel('Firefox/132.0')).toBe('Firefox');
  });

  it.each([
    ['a missing header', undefined],
    ['an empty one',     ''],
    ['an array',         ['Chrome/1 Windows']],
    ['a bot',            'curl/8.7.1'],
  ])('%s → Unknown device', (_label, value) => {
    expect(deviceLabel(value)).toBe('Unknown device');
  });

  it('reads only the first 512 characters', () => {
    expect(deviceLabel(`${'x'.repeat(600)} Chrome/1 Windows`)).toBe('Unknown device');
  });
});

describe('the visitor counter\'s helpers (PF-145)', () => {
  const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
  const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
  const IPAD_OLD = 'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 Version/12.0 Mobile/15E148 Safari/604.1';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';

  it.each([
    [ANDROID_PHONE, 'phone'],
    [IPHONE, 'phone'],
    [ANDROID_TABLET, 'tablet'],
    [IPAD_OLD, 'tablet'],
    [MAC, 'desktop'],
  ])('deviceType of %s', (ua, type) => {
    expect(deviceType(ua)).toBe(type);
  });

  it('browserName names the browser, or Other', () => {
    expect(browserName(MAC)).toBe('Chrome');
    expect(browserName(IPHONE)).toBe('Safari');
    expect(browserName('SomethingElse/1.0')).toBe('Other');
  });

  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'facebookexternalhit/1.1',
    'LinkedInBot/1.0',
    'Mozilla/5.0 HeadlessChrome/130.0.0.0',
    'Chrome-Lighthouse',
    'curl/8.7.1',
    'python-requests/2.32',
    '',
    undefined,
    ['Mozilla/5.0'],
  ])('isBot says yes to %s', (ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it.each([ANDROID_PHONE, ANDROID_TABLET, IPHONE, MAC])('isBot says no to a real browser: %s', (ua) => {
    expect(isBot(ua)).toBe(false);
  });
});
