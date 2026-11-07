# parindragallage.com

[![CI Pipeline](https://github.com/Chami-02/My_Portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/Chami-02/My_Portfolio/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Chami-02/My_Portfolio/actions/workflows/codeql.yml/badge.svg)](https://github.com/Chami-02/My_Portfolio/actions/workflows/codeql.yml)

The source code for **parindragallage.com**: a production-ready personal portfolio, blog, and content-management platform.

The project combines a public React site with a protected administration area and an Express/MongoDB API. Content such as projects, skills, blog posts, education, certificates, profile information, messages, analytics, media, and the downloadable CV can be managed without changing frontend source files.

## Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Technology](#technology)
- [Getting started with Docker](#getting-started-with-docker)
- [Local development without Docker](#local-development-without-docker)
- [Environment variables](#environment-variables)
- [Available commands](#available-commands)
- [Testing and quality checks](#testing-and-quality-checks)
- [Application routes](#application-routes)
- [API areas](#api-areas)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)

## Highlights

### Public portfolio

- Responsive portfolio landing page with sections for profile, skills, projects, education, certificates, and contact.
- Searchable project and blog views with detail pages and share metadata.
- Blog posts with publish dates, tags, reading-time information, view tracking, and content sections.
- Public CV download with a user-facing fallback page when the document is unavailable.
- Visitor totals, site statistics, sitemap generation, and privacy information.
- Seasonal visual effects, theme support, reduced-motion handling, lazy-loaded routes, and accessible navigation.

### Protected administration

- Dashboard with overview statistics and analytics.
- CRUD-style content management for projects, skills, skill categories, blog posts, profile/about content, education, and certificates.
- Contact-message inbox with search, sent replies, and email notifications.
- Password authentication with short-lived access tokens and rotating refresh sessions.
- Optional Google sign-in and WebAuthn/passkey authentication.
- Password reset, password history, password-strength checks, session management, and sign-in history.
- Media uploads through Cloudinary.
- Database backup downloads, restore workflow, and safety snapshots.
- Seasonal-effect configuration and site vocabulary management.

### Operational safeguards

- MongoDB migrations with status, dry-run, baseline, and idempotence verification commands.
- Helmet security headers, CORS allow-listing, request validation, body-size limits, rate limiting, structured errors, and upload restrictions.
- Separate development, test, and end-to-end database conventions.
- Unit tests, coverage thresholds, browser end-to-end tests, dependency audits, credential scanning, and CodeQL analysis in GitHub Actions.

## Architecture

```text
Browser
  │
  ├── React + Vite + React Router
  │       └── Axios / TanStack Query
  │
  └── Express API
          ├── MongoDB / Mongoose
          ├── Cloudinary       (media and CV storage)
          ├── Google OAuth      (optional admin sign-in)
          ├── WebAuthn          (optional passkeys)
          └── Resend            (optional email delivery)
```

The repository is organized into two independently installable applications:

- `frontend/` — React 19 single-page application built with Vite and served by nginx in the production container.
- `backend/` — Express 5 API using MongoDB and Mongoose. It can run as a Node.js service or deploy as the API project described in the operational runbook.

In development, Vite proxies `/api` requests to the backend. Docker Compose exposes the frontend at `http://localhost:5173` and the backend at `http://localhost:5050`.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | React, React Router, Vite, Tailwind CSS, CSS Modules |
| Data fetching | Axios, TanStack Query |
| Frontend testing | Vitest, Testing Library, jsdom, Playwright |
| Backend | Node.js 24, Express 5, Mongoose 9 |
| Database | MongoDB 7 |
| Authentication | JWT sessions, Google OAuth, WebAuthn/passkeys, bcryptjs |
| Media | Cloudinary |
| Email | Resend |
| Containers | Docker, nginx, Docker Compose |
| Automation | GitHub Actions, npm audit, CodeQL, Dependabot |

The application is written in JavaScript and JSX. It is not currently a TypeScript codebase.

## Getting started with Docker

### Prerequisites

- Docker Desktop with Docker Compose
- Git

### Start the development stack

```bash
git clone https://github.com/Chami-02/My_Portfolio.git
cd My_Portfolio
docker compose up --build
```

Open:

| Service | URL |
| --- | --- |
| Portfolio frontend | http://localhost:5173 |
| Backend health check | http://localhost:5050/api/health |
| Mongo Express | http://localhost:8081 |
| MongoDB | `mongodb://localhost:27017` |

MongoDB data is persisted in the named Docker volume `mongo_data`.

Mongo Express is intended for local development only. Its credentials in `docker-compose.yml` are development credentials and must never be exposed publicly.

### Stop the stack

```bash
docker compose down
```

To remove the local database volume as well:

```bash
docker compose down -v
```

## Local development without Docker

Use Node.js 24, as required by both application manifests. Run the frontend and backend in separate terminals.

### 1. Configure the backend

```bash
cd backend
cp .env.example .env
npm ci
```

Set at least `MONGO_URI` and `JWT_SECRET` in `backend/.env`. Optional integrations remain disabled when their credentials are blank.

Start the API:

```bash
npm run dev
```

The backend listens on the port configured by `PORT` (the repository's development examples use port `5050`).

### 2. Configure the frontend

```bash
cd frontend
npm ci
```

The checked-in development environment points the frontend at `http://localhost:5050/api`. If you need a different API origin, set:

```bash
VITE_API_URL=http://localhost:5050/api
```

Start Vite:

```bash
npm run dev
```

### 3. Prepare content

For a new local database, use the backend migration and seed commands as appropriate:

```bash
cd backend
npm run migrate
npm run seed
```

Do not point local, test, or end-to-end commands at production data. The backend examples define separate database names for development (`portfolio_dev`), tests (`portfolio_test`), and browser tests (`portfolio_e2e`).

## Environment variables

### Frontend

The frontend uses the Vite-exposed variable below:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Yes for a non-proxy deployment | Base URL for the backend API, for example `https://api.example.com/api` |

Frontend variables are embedded into the browser build. Never put secrets in `VITE_*` variables.

### Backend

Copy [`backend/.env.example`](./backend/.env.example) to `backend/.env` for local development. The main settings are:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment |
| `PORT` | API listening port |
| `MONGO_URI` | MongoDB connection string, including the intended database name |
| `JWT_SECRET` | Secret used for authentication and password-code signing |
| `ACCESS_TOKEN_TTL` | Short-lived access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh-session lifetime |
| `FRONTEND_URL` | Frontend origin used for redirects and passkey validation |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth credentials |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Optional media storage credentials |
| `CLOUDINARY_FOLDER` | Cloudinary folder prefix |
| `RESEND_API_KEY` | Optional email delivery credential |

For browser end-to-end testing, use [`backend/.env.e2e.example`](./backend/.env.e2e.example) as the template. The E2E environment deliberately uses a separate database and keeps real email and Cloudinary credentials disabled.

Never commit `.env` files, production connection strings, OAuth secrets, API keys, or real credentials.

## Available commands

### Frontend

Run commands from `frontend/`.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production frontend bundle |
| `npm run preview` | Preview the production bundle locally |
| `npm run lint` | Run ESLint |
| `npm run test:run` | Run the Vitest suite once |
| `npm run test:coverage` | Run Vitest with coverage |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run check` | Run linting, coverage, and the production build |

### Backend

Run commands from `backend/`.

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with Node's watch mode |
| `npm start` | Start the API |
| `npm run seed` | Seed application data |
| `npm run migrate` | Apply pending migrations |
| `npm run migrate:status` | Show migration status |
| `npm run migrate:dry` | Preview pending migration changes |
| `npm run migrate:baseline` | Mark the current database as the migration baseline |
| `npm run migrate:verify` | Verify migration idempotence |
| `npm test` | Run the Jest suite |
| `npm run test:coverage` | Run Jest with coverage |
| `npm run test:atlas` | Run the Atlas-backed test mode |
| `npm run admin:password` | Set an administrator password interactively |

## Testing and quality checks

The CI pipeline validates the application in layers:

1. Frontend linting, unit tests, coverage, and production build.
2. Backend Jest tests and coverage.
3. MongoDB-backed browser end-to-end tests with Playwright.
4. npm audit with a high-severity failure threshold.
5. Credential scanning.
6. Migration status and idempotence checks.
7. CodeQL JavaScript/TypeScript security analysis.

Run the most useful local checks before opening a pull request:

```bash
cd frontend
npm run check
npm run test:e2e

cd ../backend
npm test
npm run migrate:verify
```

The backend Jest suite is configured with global coverage thresholds of 70% statements, 60% branches, 70% functions, and 70% lines. Frontend Vitest coverage is configured with 70% statements, 55% branches, 70% functions, and 70% lines.

Some integration and E2E tests require MongoDB, browser dependencies, and the environment files described above.

## Application routes

### Public frontend routes

| Route | Purpose |
| --- | --- |
| `/` | Portfolio home page |
| `/projects` | Searchable project listing |
| `/projects/:slug` | Project detail page |
| `/blog` | Published blog listing |
| `/blog/:slug` | Blog post detail page |
| `/certificates` | Certificate listing |
| `/certificates/:slug` | Certificate detail view |
| `/privacy` | Privacy information |
| `/cv-unavailable` | CV availability fallback |
| `/admin/login` | Administrator sign-in |
| `/admin/forgot-password` | Password reset |
| `/admin/*` | Protected administration application |

### Backend health endpoints

```text
GET /
GET /api/health
```

`/api/health` reports the service status, runtime environment, timestamp, and connected database name. A `200` response with a null database value means the API process is reachable but the database connection is unavailable.

## API areas

The Express API is grouped into route modules under [`backend/src/routes/`](./backend/src/routes/):

```text
/api/projects
/api/skills
/api/skill-categories
/api/contact
/api/blog
/api/about
/api/auth
/api/resume
/api/vocabulary
/api/dashboard
/api/backup
/api/cron
/api/education
/api/certificates
/api/visits
/api/sitemap.xml
/api/site-numbers
```

Authentication, validation, rate limiting, caching, upload handling, database connection management, and error translation are applied through middleware in [`backend/src/middleware/`](./backend/src/middleware/).

## Project structure

```text
.
├── backend/
│   ├── src/
│   │   ├── config/          # Database, CORS, and Cloudinary configuration
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Security, validation, uploads, rate limits
│   │   ├── migrations/      # Ordered MongoDB migrations
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API route modules
│   │   ├── services/        # Email, storage, auth, sessions, backups
│   │   ├── utils/           # Shared backend helpers
│   │   ├── app.js           # Express application
│   │   └── server.js        # Runtime entry point
│   └── scripts/             # Smoke tests, migration checks, admin utilities
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared, layout, project, and admin UI
│   │   ├── data/            # Static portfolio data
│   │   ├── hooks/           # React hooks and query integration
│   │   ├── pages/           # Public and admin pages
│   │   ├── providers/       # Theme, motion, and splash providers
│   │   ├── services/        # API service modules
│   │   ├── styles/          # Global styles and style tests
│   │   └── utils/            # UI and form helpers
│   ├── e2e/                 # Playwright scenarios
│   ├── public/              # Static assets
│   ├── Dockerfile           # Vite build + nginx runtime image
│   └── nginx.conf           # SPA fallback and security headers
├── docs/
│   ├── RUNBOOK.md           # Production operations and incident response
│   └── design/              # Design references and prototypes
├── .github/workflows/       # CI, deployment, health checks, and CodeQL
└── docker-compose.yml       # Local frontend, backend, MongoDB, and Mongo Express
```

## Deployment

The production topology and operational procedures are documented in [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).

The current deployment model is:

- Frontend hosted as the Vercel frontend project.
- Backend hosted as the Vercel API project.
- MongoDB Atlas for production persistence.
- Cloudinary for media and CV storage.
- Resend for transactional email.
- Cloudflare for DNS.
- GitHub Actions for CI, migration approval, deployment, and health checks.

Production changes should go through the pull-request workflow. The deployment workflow runs the tested build, provides migration review/approval steps, deploys the applications, and runs a smoke test.

## Security

- Do not commit environment files or secrets.
- Use a unique, high-entropy `JWT_SECRET` outside local development.
- Use separate databases for development, tests, E2E, and production.
- Keep Mongo Express disabled outside local development.
- Keep Cloudinary, OAuth, email, and database credentials in the deployment platform's secret store.
- Rotate credentials immediately if they are exposed; deleting a commit or message does not invalidate a leaked secret.
- Review [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) for rollback, outage response, database restore, secret rotation, and administrator lockout procedures.

## Contributing

1. Create a focused branch from the default branch.
2. Keep frontend and backend changes scoped to the behavior being changed.
3. Add or update unit, integration, or E2E coverage for observable behavior.
4. Run the relevant checks locally.
5. Open a pull request and include:
   - What changed and why.
   - Any migration or environment-variable changes.
   - Test commands and results.
   - Deployment or rollback considerations.

Please do not include credentials, production data, database dumps, generated coverage output, or local environment files in commits.

## License

This project is licensed under the [MIT License](./LICENSE).
