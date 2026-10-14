// frontend/src/services/multipart.js

/**
 * Build the `[body, config]` pair for a multipart upload.
 *
 * ⚠️ THE `Content-Type: undefined` IS LOAD-BEARING, AND OMITTING IT FAILS
 * SILENTLY. `api.js` sets `Content-Type: application/json` as an INSTANCE
 * DEFAULT, and axios 1.18.1's own transformRequest
 * (node_modules/axios/lib/defaults/index.js:56) reads:
 *
 *     if (isFormData) {
 *       return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
 *     }
 *
 * So a FormData body sent through this instance is converted to JSON — and a
 * File is not JSON-serialisable, so it collapses to `{}`. Measured in this repo:
 *
 *     WITH the json default  ->  '{"file":{}}'
 *     WITHOUT                ->  FormData, the File intact
 *
 * The request then leaves as JSON, multer parses no multipart body, `req.file`
 * is undefined, and the server answers 400 "No file uploaded — send a 'file'
 * field". That reads exactly like a wrong field name on this side, which is the
 * expensive part: the evidence points away from the actual cause.
 *
 * ⚠️ Setting 'multipart/form-data' explicitly is ALSO wrong — it omits the
 * boundary parameter, which only the browser can generate, and multer then
 * fails to parse. `undefined` deletes the header so axios detects the FormData
 * and lets the browser set the full value itself.
 *
 * Guarded by services/__tests__/aboutService.test.js and projectService.test.js.
 *
 * Moved here from aboutService.js in PF-113 — the project background upload is
 * the second caller, and a second private copy is how one of them would lose
 * the `undefined` and start sending '{"file":{}}'.
 */
export const multipart = (file) => {
  const fd = new FormData();
  fd.append('file', file);   // 'file' is the field name middleware/upload.js expects
  return [fd, { headers: { 'Content-Type': undefined } }];
};

