# Changelog

Every release of parindragallage.com is recorded here, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
MAJOR.MINOR.PATCH, where a PATCH fixes something, a MINOR adds something, and a
MAJOR changes something people relied on. Each release has a matching git tag
(`v1.0.0`), created on the commit that went live.

## [Unreleased]

## [1.0.0] - 2026-11-07

The first public release.

### Added

- **The site:** home page with hero, about, skills, projects, education and
  certificates, blog teaser and contact form, in dark and light themes, on
  phones, tablets and desktops.
- **Blog:** posts written in sections, search across whole posts, tag filters,
  reading time, and read counts.
- **Projects and certificates:** their own search pages and a page per item.
- **Contact:** messages are stored and emailed to the owner; the owner can reply
  from the site's own address.
- **Sent replies:** every reply sent from the admin panel is listed under
  Messages → SENT, kept even when the message it answered is deleted, and can
  be searched and deleted there.
- **Admin panel** at `/admin`: every section of the site is edited here.
  Changes are staged and go live only on SAVE; new items start as drafts.
- **Analytics:** a private dashboard and a public numbers box, from a visitor
  counter that stores daily totals only (no cookies, no IP addresses).
- **Seasonal effects:** snow in December, leaves and bats around Halloween.
- **Search engines:** sitemap, `robots.txt`, per-page titles and descriptions,
  and a link-preview card.
- **Privacy page** at `/privacy`.

### Security

- Sign-in by password, Google or passkey, for the owner only.
- Short-lived access tokens, with the refresh token in an `httpOnly` cookie.
- New passwords are checked for length, strength and known data breaches;
  password change and reset need a code sent by email.
- Active sessions and sign-in history, alerts for a new device, and a daily
  digest of failed sign-ins.
- Rate limits on every sign-in and form, counted in the database.
- Security headers and a strict Content Security Policy.
- Backup and all-or-nothing restore, behind the password.

### Operations

- Every change passes automated checks before it can merge.
- Production deploys go through two human approvals (database changes, then
  code), followed by an automatic smoke test.
- An hourly health check of the live site.
- Written runbook: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

[Unreleased]: https://github.com/Chami-02/My_Portfolio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Chami-02/My_Portfolio/releases/tag/v1.0.0
