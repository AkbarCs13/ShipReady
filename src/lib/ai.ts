import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deployments, memories, projects, tasks } from "@/db/schema";
import {
  CATEGORIES,
  priorityWeight,
  readinessScore,
  successRate,
} from "@/lib/core";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface MemoryCandidate {
  kind: "fact" | "preference" | "insight";
  content: string;
}
export interface CopilotResult {
  reply: string;
  engine: "openai" | "local";
  reflection: { summary: string; lesson: string; score: number };
  memoryCandidates: MemoryCandidate[];
  notice?: string;
}

interface Snapshot {
  projects: { name: string; framework: string; environment: string; status: string; region: string }[];
  deployments: {
    project: string;
    version: string;
    status: string;
    environment: string;
    commitMessage: string;
    commitSha: string;
    when: string;
  }[];
  tasks: { title: string; category: string; priority: string; done: boolean }[];
  memories: string[];
  score: number;
  rate: number | null;
  openCritical: { title: string; category: string }[];
  failures: { project: string; version: string; commitMessage: string; when: string }[];
}

export async function loadSnapshot(userId: string): Promise<Snapshot> {
  const [projs, deps, tsks, mems] = await Promise.all([
    db.select().from(projects).where(eq(projects.userId, userId)),
    db.select().from(deployments).where(eq(deployments.userId, userId)).orderBy(desc(deployments.createdAt)).limit(30),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(memories).where(eq(memories.userId, userId)).orderBy(desc(memories.createdAt)).limit(20),
  ]);
  const nameOf = new Map(projs.map((p) => [p.id, p.name]));
  const failures = deps
    .filter((d) => d.status === "failed" || d.status === "rolled_back")
    .slice(0, 5)
    .map((d) => ({
      project: nameOf.get(d.projectId) ?? "Unknown",
      version: d.version,
      commitMessage: d.commitMessage,
      when: d.createdAt.toISOString(),
    }));
  return {
    projects: projs.map((p) => ({
      name: p.name,
      framework: p.framework,
      environment: p.environment,
      status: p.status,
      region: p.region,
    })),
    deployments: deps.map((d) => ({
      project: nameOf.get(d.projectId) ?? "Unknown",
      version: d.version,
      status: d.status,
      environment: d.environment,
      commitMessage: d.commitMessage,
      commitSha: d.commitSha,
      when: d.createdAt.toISOString(),
    })),
    tasks: tsks.map((t) => ({ title: t.title, category: t.category, priority: t.priority, done: t.done })),
    memories: mems.map((m) => m.content),
    score: readinessScore(tsks),
    rate: successRate(deps),
    openCritical: tsks
      .filter((t) => !t.done && (t.priority === "critical" || t.priority === "high"))
      .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
      .slice(0, 6)
      .map((t) => ({ title: t.title, category: t.category })),
    failures,
  };
}

type Intent =
  | "readiness"
  | "deploy"
  | "env"
  | "accessibility"
  | "failures"
  | "memory"
  | "reflect"
  | "greeting";

function detectIntent(text: string): Intent {
  const q = text.toLowerCase();
  if (/(fail|error|incident|rollback|rolled back|broke|down)/.test(q)) return "failures";
  if (/(a11y|accessib|wcag|screen reader|keyboard|contrast)/.test(q)) return "accessibility";
  if (/(env|secret|api key|variable|credential|token)/.test(q)) return "env";
  if (/(memor|remember|recall|know about me)/.test(q)) return "memory";
  if (/(reflect|self.eval|how did you do|lesson|improve)/.test(q)) return "reflect";
  if (/(deploy|vercel|ship|release|host|production|rollback procedure)/.test(q)) return "deploy";
  if (/(ready|readiness|score|status|summary|overview|blocker|launch)/.test(q)) return "readiness";
  if (/^(hi|hey|hello|yo|good (morning|evening|afternoon))\b/.test(q)) return "greeting";
  return "readiness";
}

function bulletBlock(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

function localReflection(intent: Intent, snap: Snapshot) {
  const dataPoints =
    Math.min(24, snap.projects.length * 4 + Math.min(8, snap.deployments.length)) +
    (snap.tasks.length > 0 ? 8 : 0);
  const score = Math.min(96, 58 + dataPoints + (snap.openCritical.length === 0 ? 6 : 0));
  const top = snap.openCritical[0];
  const lesson = top
    ? `Highest-leverage next step: close "${top.title}" (${top.category}) — it carries the most readiness weight still open.`
    : "No critical or high-priority items remain open; shift attention to regression checks and monitoring.";
  return {
    summary: `Answered a "${intent}" question from the live workspace snapshot: ${snap.projects.length} projects, ${snap.deployments.length} recent deployments, ${snap.tasks.length} checklist items, readiness ${snap.score}%.`,
    lesson,
    score,
  };
}

function localAnswer(intent: Intent, snap: Snapshot): { reply: string; memoryCandidates: MemoryCandidate[] } {
  const rateTxt = snap.rate === null ? "no finished deployments yet" : `${snap.rate}% success over the last ${snap.deployments.length} deployments`;
  const openCount = snap.tasks.filter((t) => !t.done).length;
  const candidates: MemoryCandidate[] = [];

  switch (intent) {
    case "failures": {
      if (snap.failures.length === 0) {
        return {
          reply: `Good news — **no failed or rolled-back deployments** in the recent window (${rateTxt}).\n\nTo keep it that way:\n${bulletBlock([
            "Smoke-test `/api/health` immediately after every production deploy.",
            "Keep the previous live deployment one click away for instant rollback.",
            "Log structured request IDs so the next incident is traceable.",
          ])}`,
          memoryCandidates: candidates,
        };
      }
      const f = snap.failures[0];
      candidates.push({
        kind: "insight",
        content: `Recent deployment trouble on ${f.project} ${f.version}: "${f.commitMessage}" ended in failure/rollback.`,
      });
      return {
        reply: `I found **${snap.failures.length} troubled deployment${snap.failures.length > 1 ? "s" : ""}** recently:\n${bulletBlock(
          snap.failures.map((x) => `**${x.project} ${x.version}** — ${x.commitMessage || "no commit message"}`)
        )}\n\nRecovery playbook:\n${bulletBlock([
          `Roll ${f.project} back to its last live version, then re-deploy the fix to a preview environment first.`,
          "Diff the environment variables between the failing and last live build — missing secrets are the most common cause.",
          "Check build logs for the first error, not the last; cascading errors hide the root cause.",
        ])}`,
        memoryCandidates: candidates,
      };
    }
    case "accessibility": {
      const a11y = snap.tasks.filter((t) => t.category === "accessibility");
      const open = a11y.filter((t) => !t.done);
      return {
        reply: `**Accessibility status:** ${a11y.length - open.length}/${a11y.length} checklist items complete.\n\n${
          open.length > 0 ? `Still open:\n${bulletBlock(open.map((t) => `${t.title} (${t.priority})`))}\n` : "Everything on the checklist is done. "
        }\nQuick wins that survive audits:\n${bulletBlock([
          "Every interactive element reachable by Tab, with a visible focus ring.",
          "Modals trap focus, close on Escape, and return focus to the trigger.",
          "Text contrast ≥ 4.5:1; status never conveyed by color alone.",
          "Respect `prefers-reduced-motion` for animated dashboards like this one.",
        ])}`,
        memoryCandidates: candidates,
      };
    }
    case "env": {
      return {
        reply: `**Environment & secrets checklist for production:**\n${bulletBlock([
          "`DATABASE_URL` — pooled Postgres connection string (Neon/Vercel Postgres). Server-side only.",
          "`OPENAI_API_KEY` — read exclusively in server routes; never expose it via `NEXT_PUBLIC_*`.",
          "Set variables for **Production, Preview and Development** separately in Vercel → Settings → Environment Variables.",
          "No hardcoded `localhost` URLs — this app calls same-origin `/api/*`, so it works on any domain.",
        ])}\n\nCurrent runtime: OpenAI key **${openaiConfigured() ? "configured ✓" : "not configured — the copilot is using the local rules engine"}**. After changing env vars on Vercel, redeploy for them to take effect.`,
        memoryCandidates: candidates,
      };
    }
    case "deploy": {
      return {
        reply: `**Shipping this workspace to Vercel — the short version:**\n${bulletBlock([
          "1. Push the repo to GitHub and import it at vercel.com/new — Next.js is auto-detected.",
          "2. Provision Postgres (Neon or Vercel Postgres) and copy the pooled connection string.",
          "3. Set `DATABASE_URL` and `OPENAI_API_KEY` in Vercel env settings for all environments.",
          "4. Run `npx drizzle-kit push` once against the production database to create tables.",
          "5. Deploy, then verify `/api/health` returns `ok: true` and sign in works after a hard refresh.",
        ])}\n\nYou currently track **${snap.projects.length} project${snap.projects.length === 1 ? "" : "s"}** here (${snap.projects.map((p) => p.name).join(", ") || "none yet"}). The full guided walkthrough with copyable commands lives in the **Deploy Guide** page of this app.`,
        memoryCandidates: candidates,
      };
    }
    case "memory": {
      const mems = snap.memories.slice(0, 8);
      return {
        reply: mems.length
          ? `Here is what I currently remember across sessions:\n${bulletBlock(mems)}\n\nSay **"remember: …"** to pin a new fact, or manage memories in the panel on the right. Memories are stored in Postgres, so they survive refreshes, logouts and redeploys.`
          : `I have no stored memories yet. Say **"remember: our launch window is Friday 14:00 UTC"** and I'll persist it to the database — it will still be here in your next session.`,
        memoryCandidates: candidates,
      };
    }
    case "reflect": {
      const r = localReflection(intent, snap);
      return {
        reply: `**Self-reflection on my recent answers:**\n\n${r.summary}\n\n**Lesson learned:** ${r.lesson}\n\nEvery answer I give produces a reflection like this one — you can audit them in the Reflections tab on the right.`,
        memoryCandidates: candidates,
      };
    }
    case "greeting": {
      return {
        reply: `Hey! I'm your ShipReady copilot. Current pulse of the workspace:\n${bulletBlock([
          `Readiness score: **${snap.score}%** with ${openCount} open checklist item${openCount === 1 ? "" : "s"}.`,
          `Deployment health: ${rateTxt}.`,
          snap.openCritical[0] ? `Top blocker: ${snap.openCritical[0].title}.` : "No critical blockers open.",
        ])}\n\nAsk me about readiness, failures, accessibility, env vars, or shipping to Vercel.`,
        memoryCandidates: candidates,
      };
    }
    case "readiness":
    default: {
      const byCat = CATEGORIES.map((c) => {
        const items = snap.tasks.filter((t) => t.category === c.id);
        const done = items.filter((t) => t.done).length;
        return `${c.label}: ${done}/${items.length}`;
      });
      const blockers = snap.openCritical.slice(0, 4).map((t) => `${t.title} _(${t.category})_`);
      return {
        reply: `**Readiness report — score ${snap.score}%** (${rateTxt})\n\nCategory coverage:\n${bulletBlock(byCat)}\n\n${
          blockers.length
            ? `Top blockers, in weight order:\n${bulletBlock(blockers)}\n\nClosing the top ${Math.min(2, blockers.length)} would move the score the most — they carry the highest priority weights.`
            : "No critical or high-priority blockers remain. Run a final smoke test on `/api/health`, verify auth after a hard refresh, and you're clear to launch."
        }`,
        memoryCandidates: candidates,
      };
    }
  }
}

interface OpenAIShape {
  reply?: string;
  memories?: { kind?: string; content?: string }[];
  reflection?: { summary?: string; lesson?: string; score?: number };
}

async function openaiAnswer(
  content: string,
  history: { role: "user" | "assistant"; content: string }[],
  snap: Snapshot
): Promise<{ reply: string; memoryCandidates: MemoryCandidate[]; reflection: { summary: string; lesson: string; score: number } }> {
  const system = [
    "You are ShipReady Copilot, an expert production-readiness engineer embedded in a deployment dashboard.",
    "You help with Vercel deployment, environment configuration, accessibility (WCAG), performance, security and observability.",
    "Ground every answer in the LIVE WORKSPACE SNAPSHOT below; cite real project names, numbers and tasks. Never invent data.",
    "Keep replies under 220 words, use short paragraphs, '- ' bullets and **bold** for emphasis. Plain text markdown only.",
    "Respond with STRICT JSON: {\"reply\": string, \"memories\": [{\"kind\": \"fact\"|\"preference\"|\"insight\", \"content\": string}], \"reflection\": {\"summary\": string, \"lesson\": string, \"score\": number 0-100}}.",
    "memories: 0-2 durable NEW facts worth persisting across sessions (empty array if none). reflection: honest self-evaluation of this answer's grounding and usefulness.",
    "",
    "LIVE WORKSPACE SNAPSHOT:",
    JSON.stringify({
      readinessScore: snap.score,
      deploySuccessRate: snap.rate,
      projects: snap.projects,
      recentDeployments: snap.deployments.slice(0, 12),
      openHighPriority: snap.openCritical,
      checklist: snap.tasks,
      persistedMemories: snap.memories,
    }),
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: OpenAIShape;
    try {
      parsed = JSON.parse(raw) as OpenAIShape;
    } catch {
      parsed = { reply: raw };
    }
    const fallback = localReflection(detectIntent(content), snap);
    const reply = (parsed.reply || "").trim() || "I couldn't compose an answer — please try rephrasing.";
    const memoryCandidates: MemoryCandidate[] = (parsed.memories ?? [])
      .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 3)
      .slice(0, 2)
      .map((m) => ({
        kind: m.kind === "preference" || m.kind === "insight" ? m.kind : "fact",
        content: m.content!.trim().slice(0, 300),
      }));
    const reflection = {
      summary: (parsed.reflection?.summary || fallback.summary).slice(0, 500),
      lesson: (parsed.reflection?.lesson || fallback.lesson).slice(0, 500),
      score: Math.max(0, Math.min(100, Math.round(parsed.reflection?.score ?? fallback.score))),
    };
    return { reply, memoryCandidates, reflection };
  } finally {
    clearTimeout(timer);
  }
}

export async function runCopilot(
  userId: string,
  content: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<CopilotResult> {
  const snap = await loadSnapshot(userId);
  const intent = detectIntent(content);

  if (openaiConfigured()) {
    try {
      const r = await openaiAnswer(content, history, snap);
      return { ...r, engine: "openai" };
    } catch (err) {
      const local = localAnswer(intent, snap);
      return {
        reply: local.reply,
        engine: "local",
        reflection: localReflection(intent, snap),
        memoryCandidates: local.memoryCandidates,
        notice: `OpenAI was unreachable (${err instanceof Error ? err.message.slice(0, 120) : "unknown error"}). This answer came from the local rules engine instead.`,
      };
    }
  }

  const local = localAnswer(intent, snap);
  return {
    reply: local.reply,
    engine: "local",
    reflection: localReflection(intent, snap),
    memoryCandidates: local.memoryCandidates,
  };
}
