// Every user- or visitor-supplied value goes through this before it touches an
// email's HTML body, so it can never become markup or a disguised link.
// Shared by the contact email (PF-123) and the security alerts (PF-125).
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

module.exports = { escapeHtml };
