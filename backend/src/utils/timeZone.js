// backend/src/utils/timeZone.js
//
// PF-118 batch 2 — is this a real IANA time-zone name ("Asia/Colombo")?
//
// The About panel picks from a dropdown, so this is the GATE behind a courtesy:
// a raw API call could still send a typo. Two checks, and both are needed:
//
//   1. SHAPE — letters first, then name segments. ⚠️ Without it, Node's ICU
//      accepts OFFSET strings ("+05:30") as a timeZone, which would store a fixed
//      offset and quietly lose the daylight-saving handling the field exists for.
//   2. ICU ACCEPTS IT — `new Intl.DateTimeFormat` throws a RangeError on an
//      unknown zone. That is the same database the browser formats with, and it
//      tolerates the legacy aliases ("Asia/Calcutta") an exact-list check would
//      reject after an ICU update renamed a zone.
//
// ⚠️ Mirrored by `frontend/src/utils/timezone.js` `isTimeZone` — two packages
// that cannot import from each other. Change both together.
const SHAPE = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/;

const isTimeZone = (value) => {
  if (typeof value !== 'string' || !SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

module.exports = { isTimeZone };
