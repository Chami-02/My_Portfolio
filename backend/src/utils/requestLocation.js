// backend/src/utils/requestLocation.js
//
// PF-123 — the sender's APPROXIMATE location, from the headers Vercel's
// network adds to every request it forwards (worked out from the visitor's IP:
// usually the right city, a VPN's city for a VPN user). Free, no extra service.
//
// ⚠️ Read ONLY on Vercel (`process.env.VERCEL`). Vercel sets these headers
// itself; anywhere else (local dev, Docker) nothing sets them, and a client
// could send its own — so off Vercel there is no location at all.
//
// Never from the request BODY: the visitor cannot choose what is stored.

const MAX_PART = 100;

const header = (req, name) => {
  const raw = req.get(name);
  if (!raw) return '';
  let value = raw;
  // The city is URL-encoded ("S%C3%A3o%20Paulo"); a malformed escape keeps
  // the raw text rather than failing the submission.
  try { value = decodeURIComponent(raw); } catch { /* keep raw */ }
  return value.trim().slice(0, MAX_PART);
};

const region = (code) => (/^\d+$/.test(code) ? '' : code);

/** "US" → "United States"; an unknown code stays as it came. */
const countryName = (code) => {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

/**
 * "New York, NY, United States" — or null when there is nothing to say.
 * @param {import('express').Request} req
 */
const requestLocation = (req) => {
  if (!process.env.VERCEL) return null;
  const parts = [
    header(req, 'x-vercel-ip-city'),
    // An ISO 3166-2 subdivision code: "NY" reads well, but many countries'
    // codes are bare numbers (Sri Lanka's Western Province is "1") — those
    // say nothing to a reader, so they are left out.
    region(header(req, 'x-vercel-ip-country-region')),
    countryName(header(req, 'x-vercel-ip-country')),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};

module.exports = { requestLocation };
