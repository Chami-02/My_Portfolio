/**
 * PF-147 — the refresh token travels in a cookie, and the two routes that read
 * it refuse a request from anywhere but the site. These put a test request in
 * the shape the site's own page sends, over the plain http supertest uses.
 */
const COOKIE = 'pg_refresh';
const OUR_ORIGIN = 'http://localhost:5173';

const asOurSite = (req, refreshToken) => {
  req.set('Origin', OUR_ORIGIN).set('Sec-Fetch-Site', 'same-site');
  return refreshToken ? req.set('Cookie', `${COOKIE}=${refreshToken}`) : req;
};

const setCookieLine = (res, name = COOKIE) =>
  (res.headers['set-cookie'] || []).find((line) => line.startsWith(`${name}=`));

const refreshCookieOf = (res) => setCookieLine(res)?.split(';')[0].slice(COOKIE.length + 1);

module.exports = { OUR_ORIGIN, asOurSite, setCookieLine, refreshCookieOf };
