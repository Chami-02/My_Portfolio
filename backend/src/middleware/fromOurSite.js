const AppError = require('../utils/AppError');
const { isAllowedOrigin } = require('../config/corsOptions');

/**
 * PF-147 — refuses a request another website made this browser send. For the
 * routes that act on the refresh cookie: the browser attaches a cookie by
 * itself, so unlike a Bearer token it proves nothing about who asked.
 *
 * A layer behind `SameSite=Strict`, per OWASP's CSRF sheet:
 *   - `Sec-Fetch-Site` is set by the browser and page code cannot fake it;
 *   - it is missing on older browsers, and a missing header is not evidence of
 *     a safe request, so `Origin` must ALWAYS match the allow-list exactly.
 *     That also refuses a sibling subdomain, which `same-site` alone would pass.
 */
const OUR_SITE = ['same-origin', 'same-site'];

const fromOurSite = (req, _res, next) => {
  const fetchSite = req.get('sec-fetch-site');

  if (isAllowedOrigin(req.get('origin')) && (fetchSite === undefined || OUR_SITE.includes(fetchSite))) {
    return next();
  }

  return next(new AppError("That request didn't come from this site. Please reload the page and try again.", 403));
};

module.exports = fromOurSite;
