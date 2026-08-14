repo: Chami-02/My_Portfolio
branch: master

## Last sync
date: 2026-08-01T12:28:45Z

### Updated in this project
- Upstream `master` is unchanged since the last sync — `backend/src/seed.js`, `frontend/src/data/projects.js` and `frontend/src/data/skills.js` all match what this concept was built from; no screens needed rebuilding.
- Closed one gap against `ABOUT_DATA.social`: the Blog page footer now carries Facebook and Instagram links alongside GitHub, LinkedIn and Email (the main page already had them).
- Canonicalised the LinkedIn URL across all three screens to the seed's exact form (with trailing slash).
- Kept two intentional local overrides: the bio says "Computer Science undergraduate at the University of Westminster" (user correction to the seed's "Software Engineering Undergraduate"), and the fourth project reads "Life Below Water" (seed has the typo "Life below warter").

## Screen map
| Project screen | Built from repo files |
| --- | --- |
| Portfolio Revolution.dc.html — Hero | frontend/src/components/sections/HeroSection.jsx, frontend/src/hooks/useTypewriter.js, frontend/src/components/common/TerminalWindow.jsx |
| Portfolio Revolution.dc.html — About | frontend/src/components/sections/AboutSection.jsx, backend/src/seed.js (ABOUT_DATA) |
| Portfolio Revolution.dc.html — Skills | backend/src/seed.js (SKILLS), frontend/src/data/skills.js |
| Portfolio Revolution.dc.html — Projects | backend/src/seed.js (PROJECTS), frontend/src/data/projects.js |
| Portfolio Revolution.dc.html — Blog teaser | backend/src/seed.js (BLOG_POSTS) |
| Portfolio Revolution.dc.html — Nav / Contact / Footer | frontend/src/components/layout/Navbar.jsx, frontend/src/components/sections/ContactSection.jsx, backend/src/seed.js (ABOUT_DATA.social), frontend/src/styles/global.css |
| Blog.dc.html — Index + reader | backend/src/seed.js (BLOG_POSTS content bodies) |
| Admin.dc.html — Sign-in | frontend/src/pages/AdminLoginPage.jsx, frontend/src/services/authService.js |
| Admin.dc.html — Shell + panels | frontend/src/components/admin/AdminLayout.jsx, frontend/src/components/admin/panels/*.jsx |
| Admin.dc.html — Seed content | backend/src/seed.js (PROJECTS, SKILLS, BLOG_POSTS, ABOUT_DATA) |

Note: this project holds a redesign concept only — nothing is written back to the repository.

## Sync history
### 2026-07-31T03:42:32Z
- Upstream unchanged; re-verified every content surface against `backend/src/seed.js` (projects, 26 skills, 4 posts, stats row).

### 2026-07-30T11:38:33Z
- Project card copy switched to the exact seed descriptions (Personal Portfolio, ClearDrive.lk, Smart Campus API).
- Skills chips aligned to the seed list: "JWT Authentication" (was "JWT Auth") and the missing GitHub chip added.

### 2026-07-30T09:40:11Z
- About section rewritten from the live `About` seed data (bio, availability note, 5+/10+/5+/Continuous stats).
- Projects cards populated with the real projects: Personal Portfolio, ClearDrive.lk, Smart Campus API, Life Below Water.
- Blog section built from the four seeded posts (title, excerpt, tags, reading time).
- Skills chips extended with Java, Next.js, FastAPI, PostgreSQL, Redis, SQLAlchemy and Jira.
