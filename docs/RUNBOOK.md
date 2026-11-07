# Runbook — parindragallage.com

What to do, step by step, when you deploy, when something breaks, or when a
secret leaks. Written to be followed under stress: do the steps in order, and
don't skip the checks.

| Part | Use it when |
| --- | --- |
| [1. The map](#1-the-map) | You need to know what runs where |
| [2. Is it healthy?](#2-is-it-healthy) | Before and after anything below |
| [3. Deploy](#3-deploy) | Shipping a change |
| [4. Roll back](#4-roll-back) | A release broke the live site |
| [5. Restore the database](#5-restore-the-database) | Content is wrong or lost |
| [6. Outage](#6-outage) | The site or API is down |
| [7. A secret leaked](#7-a-secret-leaked) | A password, key or token was exposed |
| [8. Locked out of the admin](#8-locked-out-of-the-admin) | You can't sign in |

---

## 1. The map

| Piece | Where it runs | Address |
| --- | --- | --- |
| Site (React) | Vercel project for `frontend/` | https://parindragallage.com |
| API (Express) | Vercel project for `backend/`, region `bom1` | https://api.parindragallage.com |
| Database | MongoDB Atlas M0, database `portfolio_prod` | Atlas dashboard |
| Pictures and the CV | Cloudinary | Cloudinary dashboard |
| Email | Resend, sending from `mail.parindragallage.com` | Resend dashboard |
| Domain and DNS | Cloudflare (DNS only, grey cloud) | Cloudflare dashboard |
| Checks and deploys | GitHub Actions: `ci.yml`, `deploy.yml`, `health-check.yml` | Actions tab |

Secrets live in two places only: **Vercel** (environment variables of each
project) and **GitHub** (repository secrets used by `deploy.yml`). Never in the
code, never in chat.

## 2. Is it healthy?

1. Open https://api.parindragallage.com/api/health. It must answer
   `"database": "portfolio_prod"`. ⚠️ A `200` with `"database": null` means the
   API is up but **the database is not** — that is an outage.
2. Open https://parindragallage.com and check the home page shows its content.
3. For the full check, run the same smoke test the pipeline runs, from `backend/`:

   ```bash
   node scripts/smoke-test.js https://api.parindragallage.com portfolio_prod https://parindragallage.com
   ```

   Every line must pass. It only reads; it changes nothing.
4. Or press **Run workflow** on **Production health check** in the Actions tab.

## 3. Deploy

The only way to production is `deploy.yml`. Vercel's own git deploys are off
for `master` on purpose.

1. Merge the pull request into `master` (CI must be green: `All Checks Pass`).
2. CI runs again on `master`. When it passes, **Deploy to Production** starts.
3. **Approval 1, Migrate:** read the `plan` job's output (what the migrations
   would change). Approve only if it is what you expect. `0 pending` is normal.
4. **Approval 2, Deploy:** approve. Both projects deploy the build CI tested.
5. The **smoke test** job runs by itself. Green = done. Red = go to §4.
6. Do §2 yourself once.

**Re-deploy without a new commit** (e.g. after changing a Vercel environment
variable, which only applies to NEW deployments): Actions → Deploy to
Production → **Run workflow**, on a commit whose CI is already green.

## 4. Roll back

**Rule: roll back the CODE, never the database.** Migrations are forward-only:
a mistake in one is fixed by writing the next numbered migration.

1. Vercel → the **frontend** project → Deployments → find the last good
   production deployment → **⋯ → Instant Rollback**. Confirm.
2. If the API changed in the bad release too, do the same in the **backend**
   project.
3. Do §2. The site should now be the previous version.
4. Fix the problem on a new branch, through the normal pull request and §3.
5. ⚠️ _To confirm in the PF-154 rehearsal before this line is trusted:_ how far
   back the free plan lets you roll, and what happens to the next deploy after a
   rollback (Vercel may stop giving it the domain until you press **Undo
   Rollback**).

## 5. Restore the database

Atlas M0 (free) keeps **no backups of its own**. Your backups are the files
you download from the admin panel, so download one every month.

**Take a backup:** `/admin` → Settings → **Backup** → **DOWNLOAD BACKUP**
(asks for your password). Keep the file somewhere private.

**Restore:**
1. `/admin` → Settings → **Backup** → **RESTORE FROM FILE** → pick the file.
2. The site checks the file first and shows what it would replace.
3. Confirm with your password. The restore is all-or-nothing: if any part
   fails, nothing changes.
4. Before replacing anything it keeps a **safety copy** (the last 3, listed
   under **Safety copies**). If the restore was a mistake, download that copy
   and restore it.
5. Messages are MERGED, not replaced, so a restore never loses new messages.

⚠️ A backup holds the database only. Pictures and the CV stay in Cloudinary,
and a restore does not bring back a deleted picture.

## 6. Outage

1. **Find which piece is down** with §2:
   - site down, API fine → the frontend deployment (§4) or DNS (Cloudflare).
   - `/api/health` fails → the backend deployment (§4) or Vercel itself.
   - `/api/health` says `"database": null` → Atlas.
2. **Check the providers' status pages:** vercel-status.com,
   status.mongodb.com (Atlas), status.cloudinary.com, resend-status.com,
   cloudflarestatus.com. If one of them is down, there is nothing to fix on
   our side — wait, and check again.
3. **Did a deploy just happen?** If the outage started right after one, roll
   back (§4) first and investigate after.
4. **Atlas:** check the cluster is running, that Network Access has not
   changed (Vercel has no fixed address, so the list must still let it in), and
   that the database user exists.
5. **Free-tier limits:** Vercel → Usage; Atlas → Metrics (512 MB storage).
   A plan that ran out stops serving until the month resets.
6. Write down what happened, when, and what fixed it. That becomes the
   post-incident note (what went well, what to improve, no blame).

## 7. A secret leaked

**First, always:** rotate (replace) the secret **before** anything else.
Deleting a chat message or a commit does not un-leak it.

| Secret | Where it lives | How to replace it |
| --- | --- | --- |
| `MONGO_URI` | Vercel backend + GitHub `MONGO_URI_PROD` | Atlas → Database Access → edit the user → new password. Update both places, then re-deploy (§3) |
| `JWT_SECRET` | Vercel backend | New random value (`openssl rand -hex 32`), re-deploy. You will need to sign in again |
| `GOOGLE_CLIENT_SECRET` | Vercel backend | Google Cloud Console → Credentials → the OAuth client → add a new secret, re-deploy, then delete the old one |
| `CLOUDINARY_API_SECRET` | Vercel backend | Cloudinary → Settings → API Keys → generate a new key pair, update `CLOUDINARY_API_KEY` too, re-deploy, delete the old pair |
| `RESEND_API_KEY` | Vercel backend | Resend → API Keys → create, re-deploy, delete the old one |
| `CRON_SECRET` | Vercel backend | New random value, re-deploy |
| `VERCEL_TOKEN` | GitHub secret | Vercel → Account Settings → Tokens → delete the old one, create a new one, update the GitHub secret |
| Your admin password | The database (hashed) | `/admin` → Settings → Password. If you can't sign in, §8 |

After replacing: check §2, then look at Settings → Sessions and sign out any
device you don't recognise.

## 8. Locked out of the admin

1. Try the other doors: Google, passkey, then **Forgot password?** (a code goes
   to your email).
2. **Break-glass**, only if all of those fail. From `backend/`, with the
   production `MONGO_URI` in your local `backend/.env`:

   ```bash
   npm run admin:password
   ```

   It asks you to type the database name back, sets a new password, and signs
   out every session. Remove the production address from your local `.env`
   afterwards.
