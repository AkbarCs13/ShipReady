"use client";

import Link from "next/link";
import { CopyBtn, Icon, PageHead } from "@/components/ui";

const STEPS: { title: string; body: string; code?: string; note?: string }[] = [
  {
    title: "Push the repository to GitHub",
    body: "Vercel deploys straight from Git. Create a repo and push this project — no build configuration is required, Next.js is auto-detected.",
    code: "git init\ngit add .\ngit commit -m \"feat: ShipReady command center\"\ngit remote add origin https://github.com/<you>/shipready.git\ngit push -u origin main",
  },
  {
    title: "Provision a production Postgres database",
    body: "Use Neon (Vercel's native Postgres partner) or Vercel Postgres. Create a database, then copy the pooled connection string — it looks like the example below. Any standard Postgres 14+ works.",
    code: "postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require",
    note: "This app persists everything — users, sessions, projects, deployments, checklist, copilot memory and reflections — in Postgres via Drizzle ORM.",
  },
  {
    title: "Create the Vercel project",
    body: "Import the repo at vercel.com/new. Framework preset: Next.js. Build command: npm run build (default). The included vercel.json pins the deployment region to iad1 — change it to be near your database.",
    code: "npm i -g vercel\nvercel link\nvercel env pull .env.local   # optional: sync env vars locally",
  },
  {
    title: "Set production environment variables",
    body: "In Vercel → Project → Settings → Environment Variables, add the variables below for Production (and Preview/Development if you want them there too). Redeploy after changing them.",
    code: "DATABASE_URL=postgresql://…\nOPENAI_API_KEY=sk-…\nOPENAI_MODEL=gpt-4o-mini   # optional",
    note: "The OpenAI key is read only in server route handlers — it never reaches the browser bundle. Without it, the copilot honestly labels itself as the local rules engine.",
  },
  {
    title: "Create the tables (one command)",
    body: "From your machine, point DATABASE_URL at the production database and push the Drizzle schema. On first boot the app auto-seeds the demo account and workspace if the database is empty.",
    code: "DATABASE_URL=\"postgresql://…\" npx drizzle-kit push --force",
  },
  {
    title: "Deploy and verify",
    body: "Trigger the deploy, then run the post-launch verification below. The app uses same-origin /api/* routes, so there are no hardcoded localhost URLs, no CORS configuration and no SPA fallback needed — every route is a real Next.js route that survives hard refreshes.",
    code: "vercel --prod\ncurl https://<your-app>.vercel.app/api/health\n# → {\"ok\":true,\"database\":\"up\",\"ai\":\"configured\",…}",
  },
];

const ENV_VARS = [
  { name: "DATABASE_URL", required: true, where: "Server only", desc: "Pooled Postgres connection string (Neon / Vercel Postgres / local). Used by Drizzle and the session store." },
  { name: "OPENAI_API_KEY", required: false, where: "Server only", desc: "Enables the GPT copilot. Without it, the deterministic local analyst answers from live workspace data." },
  { name: "OPENAI_MODEL", required: false, where: "Server only", desc: "Overrides the default model (gpt-4o-mini)." },
];

const TROUBLESHOOTING: { q: string; a: string }[] = [
  {
    q: "Build fails with “DATABASE_URL is required”",
    a: "The variable isn't visible to the build/runtime. Add it in Vercel → Settings → Environment Variables for the Production environment, then redeploy. Locally, put it in .env (see .env.example).",
  },
  {
    q: "/api/health returns ok:false or 500",
    a: "The database is unreachable. Check the connection string (use the pooled one on Neon), make sure sslmode=require is present for hosted databases, and confirm you ran npx drizzle-kit push against that exact database.",
  },
  {
    q: "Sign-in works, but I'm logged out after refresh",
    a: "Session cookies are Secure in production, so they require HTTPS — always use the https:// URL. Also check that your browser isn't blocking cookies and that the sessions table exists (drizzle-kit push).",
  },
  {
    q: "Copilot says “LOCAL ANALYST · NO API KEY”",
    a: "OPENAI_API_KEY isn't set in the deployment's environment, or it was added after the last deploy. Add it and redeploy. If GPT errors mid-chat, the app falls back to the local analyst and tells you explicitly — check the function logs for the OpenAI status code (401 = bad key, 429 = quota).",
  },
  {
    q: "“Auto-seed skipped” in the logs",
    a: "The server booted before the tables existed. Run npx drizzle-kit push --force, then redeploy or hit the login endpoint again — seeding retries automatically while the users table is empty.",
  },
  {
    q: "Chat requests time out on Vercel",
    a: "The chat route sets maxDuration = 60s and aborts OpenAI calls after 30s, falling back to the local analyst. On the Hobby plan (10s limit) long GPT answers may be cut — the fallback keeps the UX intact, or upgrade the plan / use a faster model.",
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHead
        eyebrow="Operate · Ship it"
        title="Deploy to Vercel"
        desc="From localhost to production in six steps — the exact procedure this app was built and tested for."
      >
        <Link href="/dashboard/checklist" className="btn btn-ghost"><Icon name="checks" size={15} />Open launch checklist</Link>
      </PageHead>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Steps timeline */}
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card fade-up relative p-5 sm:p-6" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-start gap-4">
                <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(34,211,238,0.2),rgba(167,139,250,0.2))] text-base font-bold text-[var(--cyan)] ring-1 ring-[rgba(34,211,238,0.35)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold sm:text-lg">{s.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
                  {s.code && (
                    <div className="relative mt-3">
                      <pre className="code-block">{s.code}</pre>
                      <div className="absolute right-2 top-2">
                        <CopyBtn text={s.code} />
                      </div>
                    </div>
                  )}
                  {s.note && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-[rgba(34,211,238,0.25)] bg-[rgba(34,211,238,0.06)] px-3.5 py-2.5 text-xs leading-relaxed text-[#a5f3fc]">
                      <Icon name="info" size={14} className="mt-0.5 shrink-0" />
                      {s.note}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="space-y-4">
          {/* Env table */}
          <section className="card fade-up p-5" style={{ animationDelay: "120ms" }} aria-label="Environment variables">
            <h2 className="font-display mb-3 flex items-center gap-2 text-base font-bold"><Icon name="key" size={16} className="text-[var(--amber)]" />Environment variables</h2>
            <ul className="space-y-3">
              {ENV_VARS.map((v) => (
                <li key={v.name} className="rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono2 text-xs font-bold text-[#a5f3fc]">{v.name}</code>
                    <span className={`badge ${v.required ? "border-[rgba(251,113,133,0.45)] bg-[rgba(251,113,133,0.1)] text-[var(--rose)]" : "border-[rgba(146,176,255,0.3)] bg-[rgba(146,176,255,0.07)] text-[var(--muted)]"}`}>
                      {v.required ? "REQUIRED" : "OPTIONAL"}
                    </span>
                    <span className="badge border-[rgba(52,211,153,0.35)] bg-[rgba(52,211,153,0.07)] text-[var(--green)]">{v.where.toUpperCase()}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{v.desc}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Verification */}
          <section className="card fade-up p-5" style={{ animationDelay: "180ms" }} aria-label="Post-deploy verification">
            <h2 className="font-display mb-3 flex items-center gap-2 text-base font-bold"><Icon name="shield" size={16} className="text-[var(--green)]" />Post-deploy verification</h2>
            <ul className="space-y-2.5">
              {[
                "GET /api/health returns ok:true, database:up",
                "Demo sign-in works (demo@shipready.dev / launch123)",
                "Hard-refresh /dashboard/projects keeps you signed in",
                "Create → edit → delete a project; undo a deployment delete",
                "Copilot answers, memory persists after logout + login",
                "Reflections appear under each copilot answer",
                "Lighthouse: keyboard-only pass through nav + modals",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--muted)]">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[rgba(52,211,153,0.5)] bg-[rgba(52,211,153,0.12)] text-[var(--green)]">
                    <Icon name="check" size={10} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </section>

          {/* Architecture note */}
          <section className="card fade-up p-5" style={{ animationDelay: "240ms" }} aria-label="Architecture">
            <h2 className="font-display mb-2 flex items-center gap-2 text-base font-bold"><Icon name="globe" size={16} className="text-[var(--blue)]" />Why this deploys cleanly</h2>
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              Frontend and backend ship as <strong className="text-[var(--text)]">one Next.js app</strong>: pages plus serverless
              route handlers under <code className="font-mono2 text-[#a5f3fc]">/api/*</code>. No separate backend host, no persistent
              processes, no CORS surface (same-origin), no SPA fallback (real routes). State lives in Postgres, so any serverless
              instance can serve any request.
            </p>
          </section>
        </div>
      </div>

      {/* Troubleshooting */}
      <section className="fade-up mt-6" style={{ animationDelay: "260ms" }} aria-label="Troubleshooting">
        <h2 className="font-display mb-3 flex items-center gap-2 text-lg font-bold"><Icon name="alert" size={18} className="text-[var(--amber)]" />Production troubleshooting</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {TROUBLESHOOTING.map((t) => (
            <details key={t.q} className="card group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold transition hover:text-[var(--cyan)] [&::-webkit-details-marker]:hidden">
                {t.q}
                <Icon name="down" size={14} className="shrink-0 text-[var(--faint)] transition group-open:rotate-180" />
              </summary>
              <p className="border-t border-[var(--line)] px-5 py-4 text-sm leading-relaxed text-[var(--muted)]">{t.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}