import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  deployments,
  memories,
  messages,
  projects,
  reflections,
  tasks,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/core";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);

export async function seedWorkspace(userId: string, ownerName: string): Promise<void> {
  const [atlas, pulse, docs] = await db
    .insert(projects)
    .values([
      {
        userId,
        name: "Atlas Storefront",
        description: "Customer-facing storefront with SSR checkout, ISR product pages and edge caching.",
        repoUrl: "https://github.com/shipready/atlas-storefront",
        framework: "Next.js",
        environment: "production",
        status: "healthy",
        region: "iad1",
        createdAt: daysAgo(42),
        updatedAt: hoursAgo(5),
      },
      {
        userId,
        name: "Pulse API",
        description: "Core REST + webhook API powering billing, events and third-party integrations.",
        repoUrl: "https://github.com/shipready/pulse-api",
        framework: "Express",
        environment: "production",
        status: "degraded",
        region: "fra1",
        createdAt: daysAgo(65),
        updatedAt: hoursAgo(26),
      },
      {
        userId,
        name: "Docs Portal",
        description: "Public documentation, API reference and integration guides.",
        repoUrl: "https://github.com/shipready/docs-portal",
        framework: "Astro",
        environment: "staging",
        status: "setup",
        region: "sfo1",
        createdAt: daysAgo(9),
        updatedAt: hoursAgo(50),
      },
    ])
    .returning();

  await db.insert(deployments).values([
    { userId, projectId: atlas.id, version: "v2.4.1", environment: "production", status: "live", commitSha: "9f31c04e77a2b1d8c05f3a92e6b44d1c8a07f2e9", commitMessage: "fix: retry idempotent webhook deliveries", durationSec: 96, triggeredBy: ownerName, createdAt: hoursAgo(5) },
    { userId, projectId: pulse.id, version: "v1.18.0", environment: "production", status: "building", commitSha: "4b8e21d9c3f0a7e5d1c9b2a48f6e0d3c7b5a91e2", commitMessage: "feat: rate-limit public token endpoint", durationSec: null, triggeredBy: ownerName, createdAt: hoursAgo(1) },
    { userId, projectId: atlas.id, version: "v2.4.0", environment: "production", status: "live", commitSha: "c2d94f0a1b7e83c6d5a2f9e04b1c7d8a3e6f0b25", commitMessage: "feat: edge-cache product pages (ISR 60s)", durationSec: 104, triggeredBy: "CI · github-actions", createdAt: daysAgo(2) },
    { userId, projectId: docs.id, version: "v0.9.2", environment: "staging", status: "live", commitSha: "e7a1b3c5d9f20486a1c3e5b7d9f02468a1c3e5b7", commitMessage: "docs: quickstart for webhook signatures", durationSec: 61, triggeredBy: "CI · github-actions", createdAt: daysAgo(2.2) },
    { userId, projectId: pulse.id, version: "v1.17.2", environment: "production", status: "failed", commitSha: "a0c3e5b7d9f12468a0c3e5b7d9f12468a0c3e5b7", commitMessage: "chore: bump node runtime to 22.x", durationSec: 38, triggeredBy: ownerName, createdAt: daysAgo(3) },
    { userId, projectId: pulse.id, version: "v1.17.1", environment: "production", status: "rolled_back", commitSha: "b1d4f6a8c0e23579b1d4f6a8c0e23579b1d4f6a8", commitMessage: "perf: batch billing event writes", durationSec: 88, triggeredBy: ownerName, createdAt: daysAgo(4) },
    { userId, projectId: atlas.id, version: "v2.3.9", environment: "production", status: "live", commitSha: "d3f5a7c9e1b34680d3f5a7c9e1b34680d3f5a7c9", commitMessage: "fix: hydrate cart from session cookie", durationSec: 92, triggeredBy: "CI · github-actions", createdAt: daysAgo(6) },
    { userId, projectId: pulse.id, version: "v1.17.0", environment: "production", status: "live", commitSha: "f5a7c9e1b3d54791f5a7c9e1b3d54791f5a7c9e1", commitMessage: "feat: structured request IDs in logs", durationSec: 117, triggeredBy: ownerName, createdAt: daysAgo(8) },
    { userId, projectId: docs.id, version: "v0.9.1", environment: "staging", status: "live", commitSha: "1c3e5b7d9f0246811c3e5b7d9f0246811c3e5b7d", commitMessage: "feat: versioned API reference sidebar", durationSec: 55, triggeredBy: "CI · github-actions", createdAt: daysAgo(9) },
    { userId, projectId: atlas.id, version: "v2.3.8", environment: "preview", status: "live", commitSha: "3e5b7d9f1a4680253e5b7d9f1a4680253e5b7d9f", commitMessage: "spike: server actions for wishlist", durationSec: 83, triggeredBy: ownerName, createdAt: daysAgo(11) },
    { userId, projectId: atlas.id, version: "v2.3.7", environment: "production", status: "live", commitSha: "5b7d9f1a3c6802475b7d9f1a3c6802475b7d9f1a", commitMessage: "chore: bump next to 16.2.6", durationSec: 129, triggeredBy: "CI · github-actions", createdAt: daysAgo(13) },
  ]);

  const T = (
    category: string,
    title: string,
    priority: string,
    done: boolean,
    position: number,
    notes = ""
  ) => ({ userId, category, title, priority, done, position, notes });

  await db.insert(tasks).values([
    T("deployment", "Set production env vars in Vercel", "critical", true, 0, "DATABASE_URL + OPENAI_API_KEY for all environments."),
    T("deployment", "Smoke-test /api/health after every deploy", "high", false, 1),
    T("deployment", "Add vercel.json with region pinning", "low", true, 2),
    T("deployment", "Document the rollback procedure", "medium", false, 3),
    T("deployment", "Enable preview deployment protection", "medium", false, 4),
    T("accessibility", "Keyboard-trap focus in modals & drawers", "critical", false, 0),
    T("accessibility", "Label all icon-only buttons", "high", false, 1),
    T("accessibility", "Audit color contrast to WCAG AA", "high", true, 2),
    T("accessibility", "Add skip-to-content link", "medium", true, 3),
    T("accessibility", "Respect prefers-reduced-motion", "low", true, 4),
    T("security", "Rotate OPENAI_API_KEY, keep it server-side", "critical", true, 0),
    T("security", "HttpOnly + SameSite session cookies", "high", true, 1),
    T("security", "Rate-limit auth endpoints", "high", false, 2),
    T("security", "CORS allowlist for the production origin", "medium", false, 3),
    T("performance", "Add DB indexes for session lookups", "high", true, 0),
    T("performance", "Analyze bundle with next build output", "medium", false, 1),
    T("performance", "Cache dashboard queries (SWR)", "medium", false, 2),
    T("performance", "Compress hero imagery to AVIF", "low", true, 3),
    T("observability", "Uptime check on /api/health", "high", true, 0),
    T("observability", "Error tracking with source maps", "high", false, 1),
    T("observability", "Structured request IDs in logs", "low", false, 2),
  ]);

  await db.insert(memories).values([
    { userId, kind: "fact", content: "Launch window is Friday 14:00 UTC — freeze merges 2 hours before.", source: "manual", createdAt: daysAgo(2) },
    { userId, kind: "fact", content: "Primary region is iad1; Pulse API runs in fra1 and is latency-sensitive.", source: "manual", createdAt: daysAgo(4) },
    { userId, kind: "preference", content: "Ava prefers concise answers with checklists over long prose.", source: "auto", createdAt: daysAgo(3) },
    { userId, kind: "insight", content: "Most failed deploys in this workspace trace back to missing environment variables.", source: "reflection", createdAt: daysAgo(3) },
    { userId, kind: "fact", content: "Docs Portal is staging-only until the v1.0 API reference is signed off.", source: "manual", createdAt: daysAgo(1) },
  ]);

  const seeded = await db
    .insert(messages)
    .values([
      { userId, role: "user", content: "How ready are we for Friday's launch?", engine: null, createdAt: hoursAgo(26) },
      {
        userId,
        role: "assistant",
        engine: "local",
        createdAt: hoursAgo(26),
        content:
          "**Readiness report — score 55%** (80% success over recent deployments)\n\nTop blockers, in weight order:\n- Keyboard-trap focus in modals & drawers _(accessibility)_\n- Smoke-test /api/health after every deploy _(deployment)_\n- Rate-limit auth endpoints _(security)_\n\nClosing the top two would move the score the most — they carry the highest priority weights still open.",
      },
      { userId, role: "user", content: "remember: launch window is Friday 14:00 UTC, freeze merges 2 hours before", engine: null, createdAt: hoursAgo(25.8) },
      {
        userId,
        role: "assistant",
        engine: "local",
        createdAt: hoursAgo(25.7),
        content:
          "Pinned to long-term memory: **launch window is Friday 14:00 UTC, freeze merges 2 hours before.**\n\nIt's stored in Postgres, so I'll recall it in every future session — even after a redeploy.",
      },
    ])
    .returning();

  await db.insert(reflections).values([
    {
      userId,
      messageId: seeded[1]?.id ?? null,
      summary: "Answered a readiness question from the live snapshot: 3 projects, 11 deployments, 21 checklist items.",
      lesson: "Highest-leverage next step is the critical accessibility blocker — it carries weight 5 and is still open.",
      score: 88,
      engine: "local",
      createdAt: hoursAgo(26),
    },
    {
      userId,
      messageId: seeded[3]?.id ?? null,
      summary: "Persisted an explicit user fact to long-term memory instead of relying on the chat window.",
      lesson: "Time-bound facts (launch windows) should be re-surfaced proactively as the date approaches.",
      score: 92,
      engine: "local",
      createdAt: hoursAgo(25.7),
    },
  ]);
}

export async function resetWorkspace(userId: string, ownerName: string): Promise<void> {
  await db.delete(reflections).where(eq(reflections.userId, userId));
  await db.delete(messages).where(eq(messages.userId, userId));
  await db.delete(memories).where(eq(memories.userId, userId));
  await db.delete(deployments).where(eq(deployments.userId, userId));
  await db.delete(tasks).where(eq(tasks.userId, userId));
  await db.delete(projects).where(eq(projects.userId, userId));
  await seedWorkspace(userId, ownerName);
}

let seedPromise: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db.select({ id: users.id }).from(users).limit(1);
      if (existing.length > 0) return;
      const [demo] = await db
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          name: "Ava Chen",
          passwordHash: hashPassword(DEMO_PASSWORD),
        })
        .returning();
      await seedWorkspace(demo.id, demo.name);
      console.log("[shipready] Seeded demo workspace (demo@shipready.dev / launch123)");
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}