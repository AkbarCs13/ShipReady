# 🚀 ShipReady — Production Readiness Command Center

**Project 19 · Deployment, Accessibility & Production Readiness**

ShipReady is a full-stack command center for getting software to production with confidence:
authentication, a sidebar dashboard, full CRUD for **projects**, **deployments** and a weighted
**readiness checklist**, plus an **AI copilot** with **persistent memory** and **self-reflection** —
all optimized for one-command local setup and clean Vercel deployment.

| | |
|---|---|
| **Framework** | Next.js 16 (App Router) · React 19 · TypeScript |
| **Database** | PostgreSQL + Drizzle ORM (Neon / Vercel Postgres in production) |
| **AI** | OpenAI Chat Completions (`gpt-4o-mini`) with an honest local rules-engine fallback |
| **Auth** | Email + password (salted scrypt) · HttpOnly SameSite session cookies · 7-day sessions |
| **Styling** | Tailwind CSS 4 + hand-built design system (dark mission-control theme) |

> **A note on the database:** this implementation uses **PostgreSQL via Drizzle** rather than
> MongoDB Atlas so it runs natively on Vercel's serverless architecture with zero persistent
> backend processes. **Neon** is the managed-Postgres equivalent of Atlas here — the setup steps
> below mirror an Atlas setup one-for-one (create cluster → copy connection string → set env var).

---

## ✨ Features

- **Authentication** — register, sign in, sign out, protected `/dashboard/*` routes, session
  persistence across refreshes, password change, profile editing.
- **Overview dashboard** — readiness gauge, deploy success rate, blockers, category coverage,
  recent releases and the copilot's latest self-reflection.
- **Projects CRUD** — search, sort, detail drawer with inline editing, deployment history,
  delete with confirmation.
- **Deployments CRUD** — filter by project/status/environment, full-text search, sort, **saved
  views**, **bulk selection + bulk delete**, inline status changes, **lossless undo**.
- **Readiness checklist** — five categories, weighted priorities (critical ×5), inline add,
  edit modal, **drag-to-reorder** (with keyboard up/down alternative), optimistic toggles, undo.
- **AI Copilot** — grounded in your live workspace data. With `OPENAI_API_KEY` it calls GPT;
  without one it uses a deterministic local analyst and **labels itself honestly** (no fake AI).
- **Persistent memory** — say `remember: …`, pin facts manually, or let the copilot extract them.
  Stored in Postgres → survives refresh, logout and redeploys.
- **Self-reflection** — every answer produces a scored self-evaluation with a lesson, expandable
  under each reply and auditable in the Reflections panel.
- **Demo data** — auto-seeded on first boot (`demo@shipready.dev` / `launch123`), reloadable per
  account from Settings.
- **Quality** — loading skeletons, empty states, error states with retry, toasts with undo,
  form validation, focus-trapped modals, skip link, `prefers-reduced-motion`, custom scrollbars,
  responsive from 360px to ultrawide.

---

## 🏁 Quickstart (local)

### Prerequisites

- **Node.js 20+** and npm
- **PostgreSQL 14+** — local install, or Docker, or a free [Neon](https://neon.tech) database
- *(optional)* an **OpenAI API key** for the GPT copilot

### 1 · Install

```bash
npm install
```

### 2 · Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
OPENAI_API_KEY=            # optional — leave empty for local-analyst mode
```

No local Postgres? One-liner with Docker:

```bash
docker run -d --name shipready-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db postgres:16
```

### 3 · Create tables

```bash
npx drizzle-kit push
```

### 4 · Run

```bash
npm run dev
```

Open **http://localhost:3000** → click **“Launch demo workspace”**, or sign in with:

```
demo@shipready.dev  /  launch123
```

The demo account (3 projects, 11 deployments, 21 checklist items, seeded chat + memories +
reflections) is **auto-seeded on first boot** whenever the users table is empty — no seed
command needed. To re-seed your own account at any time: **Settings → Reload demo workspace**.

### Production build

```bash
npm run build
npm run start
```

### All commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server |
| `npx drizzle-kit push` | Create/update database tables from the schema |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript check |

---

## 🤖 AI setup

1. Create a key at [platform.openai.com](https://platform.openai.com) → API keys.
2. Put it in `.env` as `OPENAI_API_KEY=sk-…` (server-side only; **never** `NEXT_PUBLIC_`).
3. Restart the dev server. The copilot header flips to `GPT-4O-MINI · LIVE`.

Behavior guarantees:

- Requests go through `/api/chat` (server route) — the key never reaches the browser.
- GPT is prompted with a **live snapshot** of your projects/deployments/checklist/memories and
  must answer as strict JSON containing the reply, memory candidates and a self-reflection.
- If OpenAI errors or times out (30s abort), the app **falls back to the local analyst and tells
  you** — no misleading success states.
- Without a key, the local analyst answers readiness/failure/a11y/env/deploy questions from real
  database numbers. It is clearly labeled `LOCAL ANALYST` everywhere.

---

## ▲ Deploying to Vercel (complete guide)

The app is a single Next.js project: pages + serverless API routes. **No separate backend, no
CORS configuration (same-origin `/api/*`), no SPA fallback (real routes), no hardcoded localhost
URLs.**

### Step 1 — Push to GitHub

```bash
git init && git add . && git commit -m "feat: ShipReady"
git remote add origin https://github.com/<you>/shipready.git
git push -u origin main
```

### Step 2 — Provision Postgres (Neon)

1. Sign in at [neon.tech](https://neon.tech) (or Vercel → Storage → Postgres).
2. Create a project/database in a region near your users (e.g. `us-east`).
3. Copy the **pooled** connection string:
   `postgresql://USER:PASS@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require`

### Step 3 — Import to Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repo.
2. Framework preset **Next.js** (auto-detected). Build command `npm run build` (default).
3. `vercel.json` pins functions to `iad1` — edit it to match your database region.

### Step 4 — Environment variables

Vercel → Project → **Settings → Environment Variables** (add for Production, and Preview/Dev if desired):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled Neon/Vercel Postgres connection string |
| `OPENAI_API_KEY` | optional | Enables GPT copilot; local analyst otherwise |
| `OPENAI_MODEL` | optional | Defaults to `gpt-4o-mini` |

### Step 5 — Create the tables

From your machine, pointed at the **production** database:

```bash
DATABASE_URL="postgresql://…neon.tech/…" npx drizzle-kit push --force
```

(Or put the production URL in `.env` temporarily and run `npx drizzle-kit push`.)

### Step 6 — Deploy & verify

Push to `main` (or `vercel --prod`), then:

```bash
curl https://<your-app>.vercel.app/api/health
# {"ok":true,"database":"up","ai":"configured",...}
```

Verify in the browser:

- [ ] Demo sign-in works (`demo@shipready.dev` / `launch123` — seeded automatically on first boot)
- [ ] Hard-refresh on `/dashboard/projects` keeps you signed in
- [ ] Create/edit/delete flows work; undo restores a deleted deployment
- [ ] Copilot answers; `remember:` facts survive logout → login
- [ ] Reflections appear under answers

> **Deployment honesty:** the production build, TypeScript, schema push, auth, CRUD, chat,
> memory persistence and health endpoint are verified in CI/sandbox. The Vercel steps above are
> the exact procedure to run against your own Vercel account — deployment to *your* account
> requires *your* credentials and is not performed by this repository.

---

## 🛠 Production troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: `DATABASE_URL is required` | Add the env var in Vercel for the right environment, then **redeploy**. |
| `/api/health` → `ok:false` | Wrong/unpooled connection string, missing `sslmode=require`, or tables not pushed. Run `drizzle-kit push` against that exact DB. |
| Logged out after refresh | Use the `https://` URL (Secure cookies). Check the `sessions` table exists. |
| Copilot shows `LOCAL ANALYST` | `OPENAI_API_KEY` missing or added after the last deploy — set it and redeploy. 401 = bad key, 429 = quota (see Vercel function logs). |
| `Auto-seed skipped` in logs | Server booted before tables existed. Push the schema, then redeploy or sign in again — seeding retries while the users table is empty. |
| Chat times out on Hobby plan | Route allows 60s and aborts GPT at 30s with an honest local fallback. Hobby caps functions at 10s — use a faster model or upgrade for long GPT answers. |
| `password authentication failed` locally | Your `.env` `DATABASE_URL` doesn't match your Postgres credentials/database name. |

---

## 🗂 Project structure

```
src/
├── app/
│   ├── api/            # auth, projects, deployments (+bulk/restore), tasks (+reorder/restore),
│   │                   # chat, messages, memories, demo/reset, health
│   ├── dashboard/      # overview, projects, deployments, checklist, copilot, guide, settings
│   ├── login/          # split-panel auth screen with live demo launch
│   └── layout.tsx      # fonts, theme, toast provider, skip link
├── components/         # shell (sidebar), ui kit (modals, gauges, badges), toasts
├── db/                 # Drizzle schema, client, seed/auto-seed
├── lib/                # auth (scrypt + sessions), ai (OpenAI + local analyst), shared core
└── instrumentation.ts  # first-boot auto-seed (safe on empty/unmigrated DBs)
```

## 🔒 Security notes

- Passwords: salted **scrypt** hashes, timing-safe comparison.
- Sessions: 32-byte random tokens, **HttpOnly / SameSite=Lax / Secure** cookies, server-side expiry.
- Every API route validates the session **and** row ownership; input is validated server-side.
- Secrets are read from `process.env` in server routes only; nothing sensitive is bundled client-side.
- Same-origin API design removes the CORS attack surface entirely.