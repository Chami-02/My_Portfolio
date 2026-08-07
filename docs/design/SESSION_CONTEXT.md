# Context handoff — new machine, resuming Phase 2

## What just changed

I've moved from a Windows PC to a **MacBook (Apple Silicon)** — fresh machine, everything reinstalled from scratch. My whole dev environment is new: zsh instead of PowerShell, Homebrew, nvm, Docker Desktop, VS Code. Assume **macOS conventions in every command you give me** (`brew`, `jq` not `python3 -m json.tool`, `sed -i ''` with the empty argument, `~` not `%USERPROFILE%`). I'm new to macOS, so if a step has a Mac-specific gotcha, say so.

**One config change that matters:** my backend used to run on port 5000. macOS runs AirPlay Receiver on port 5000, so I've moved the backend to **port 5050**. Every `localhost:5000` in my older notes is now `localhost:5050`. `backend/.env` has `PORT=5050`, `frontend/.env` has `VITE_API_URL=http://localhost:5050/api`, and the `server.js` fallback is updated. If I'm running through Docker, the compose mapping is `"5050:5000"` — host 5050, container still 5000 — so the Vite proxy target `http://backend:5000` is correct and should not be changed.

## The project

`Chami-02/My_Portfolio` — a full-stack MERN portfolio. Not a template: React 19 + Vite + Tailwind v4 frontend, Express + MongoDB + Mongoose backend, JWT auth, a custom admin CMS, Docker, GitHub Actions CI, deployed on Railway with MongoDB Atlas.

**Phase 1 is complete** (PF-1 → PF-51): full frontend, full REST API, auth, admin panel, test suites, CI/CD, deployment.

**Phase 2 is in progress** — a total UI rebuild from a finished design prototype, plus the backend work needed to support it.

## Where I am right now

**Sprint 9 — Epic E5: Backend Revolution** (Jira epic key `PF-53`)

| Ticket | Work | Status |
|---|---|---|
| PF-52 | Project background image schema | ✅ Done |
| PF-59 | Blog sections schema + migration | ✅ Done |
| PF-60 | About social links + résumé upload | ✅ Done |
| **PF-61** | **Vocabulary model + seed** | **← next** |
| PF-62 | Vocabulary endpoints + cascade delete | To do |
| PF-63 | Upload endpoint + Cloudinary | To do |
| PF-64 | Blog view counter | To do |
| PF-65 | Seed rewrite + sprint closeout | To do |

**Note on the numbering:** I created six Jira epics after PF-52, which consumed keys PF-53 through PF-58. So story numbers jump from PF-52 straight to PF-59. That gap is intentional, not a mistake.

**One thing to check before PF-63:** PF-60's résumé feature used `storage.js` and `upload.js`, which PF-63 formally creates. Those files may already exist. Check before rebuilding them.

## How I'm working

I have a full documentation set written for this project — 19 planning docs plus per-ticket implementation guides. **Each ticket is a Markdown file** containing exact file paths, complete code blocks, manual test commands, a verification checklist, and the commit message.

My process per ticket: open the ticket `.md` → follow the steps in order → run the verification checklist → commit with the ticket ID → move to the next one. One branch per sprint (`sprint-9-backend-revolution`), commits formatted as `feat(pf-61): <summary>`.

I'll paste the relevant ticket file into our chat when I start each one. Work from that file as the source of truth. If you think a step is wrong or a better approach exists, **say so before I run it** — but don't silently deviate from the documented plan.

## Rules that are already decided

Don't relitigate these:

- **Design fidelity is absolute.** The prototype is the authority. If code and documentation disagree, the prototype wins. No design element gets removed or simplified for performance.
- **No frontend animation libraries.** Every animation is CSS keyframes plus small vanilla JS. No Motion, no GSAP.
- **Vocabulary deletion is cascade (hard delete).** Removing a chip strips it from all content, behind an impact-count confirmation.
- **Cloudinary** for file storage, behind a provider interface.
- **Résumé is PDF only**, and uploading a new one hard-deletes the old.
- **Blog content is `sections[]`**, not a flat string. That migration is already done.
- Backend deployment is **Railway**.

## What I need from you

Explain *why*, not just *what* — I'm learning, not just shipping. When something breaks, tell me what caused it and how the fix works. Flag risks before I hit them rather than after.

Start by helping me confirm my environment is correctly restored, then we begin **PF-61**.