"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errMsg, useFetch } from "@/lib/client";
import {
  CATEGORIES,
  readinessScore,
  successRate,
  timeAgo,
  type Deployment,
  type Memory,
  type Project,
  type Reflection,
  type Task,
} from "@/lib/core";
import { Button, EmptyState, EnvBadge, ErrorState, Gauge, Icon, PageHead, Progress, Skeleton, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast";

function Stat({ icon, label, value, sub, hue, delay }: { icon: string; label: string; value: string; sub: string; hue: string; delay: number }) {
  return (
    <div className="card card-hover fade-up p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <p className="font-mono2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: hue, background: `color-mix(in srgb, ${hue} 12%, transparent)` }}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <p className="font-display mt-2 text-[1.9rem] font-bold leading-none">{value}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{sub}</p>
    </div>
  );
}

export default function OverviewPage() {
  const projectsQ = useFetch<{ projects: Project[] }>("/api/projects");
  const depsQ = useFetch<{ deployments: Deployment[] }>("/api/deployments");
  const tasksQ = useFetch<{ tasks: Task[] }>("/api/tasks");
  const aiQ = useFetch<{ memories: Memory[]; reflections: Reflection[] }>("/api/messages");
  const { push } = useToast();
  const [seeding, setSeeding] = useState(false);

  const loading = projectsQ.loading || depsQ.loading || tasksQ.loading || aiQ.loading;
  const error = projectsQ.error || depsQ.error || tasksQ.error;

  async function loadDemo() {
    setSeeding(true);
    try {
      await api("/api/demo/reset", { method: "POST" });
      push({ title: "Demo workspace loaded", message: "Projects, deployments, checklist and copilot memory are live.", variant: "success" });
      projectsQ.reload();
      depsQ.reload();
      tasksQ.reload();
      aiQ.reload();
    } catch (e) {
      push({ title: "Couldn't load demo data", message: errMsg(e), variant: "error" });
    } finally {
      setSeeding(false);
    }
  }

  if (error) {
    return (
      <>
        <PageHead eyebrow="Mission overview" title="Mission overview" />
        <ErrorState message={error} onRetry={() => { projectsQ.reload(); depsQ.reload(); tasksQ.reload(); aiQ.reload(); }} />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHead eyebrow="Mission overview" title="Mission overview" desc="Pulling live telemetry from your workspace…" />
        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-12 h-64 lg:col-span-4" />
          <div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-8">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[7.5rem]" />)}
          </div>
          <Skeleton className="col-span-12 h-72 lg:col-span-5" />
          <Skeleton className="col-span-12 h-72 lg:col-span-7" />
        </div>
      </>
    );
  }

  const projects = projectsQ.data?.projects ?? [];
  const deps = depsQ.data?.deployments ?? [];
  const tasks = tasksQ.data?.tasks ?? [];
  const memories = aiQ.data?.memories ?? [];
  const reflections = aiQ.data?.reflections ?? [];

  if (projects.length === 0 && deps.length === 0 && tasks.length === 0) {
    return (
      <>
        <PageHead eyebrow="Mission overview" title="Mission overview" desc="Everything between you and a confident launch." />
        <EmptyState icon="rocket" title="Your command center is empty" body="Load the realistic demo workspace to explore every feature, or start clean by creating your first project.">
          <Button variant="primary" icon="zap" loading={seeding} onClick={loadDemo}>Load demo workspace</Button>
          <Link href="/dashboard/projects?new=1" className="btn btn-ghost"><Icon name="plus" size={15} />Create first project</Link>
        </EmptyState>
      </>
    );
  }

  const score = readinessScore(tasks);
  const rate = successRate(deps);
  const live = deps.filter((d) => d.status === "live").length;
  const openBlockers = tasks.filter((t) => !t.done && (t.priority === "critical" || t.priority === "high"));
  const criticalOpen = openBlockers.filter((t) => t.priority === "critical").length;
  const doneCount = tasks.filter((t) => t.done).length;
  const latestReflection = reflections[0];
  const recent = deps.slice(0, 5);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Removed project";

  return (
    <>
      <PageHead eyebrow="Mission overview" title="Mission overview" desc="Everything between you and a confident launch — live from your database.">
        <Link href="/dashboard/copilot" className="btn btn-primary"><Icon name="spark" size={15} />Ask the copilot</Link>
      </PageHead>

      <div className="grid grid-cols-12 gap-4">
        {/* Gauge */}
        <div className="card fade-up col-span-12 flex flex-col items-center justify-center gap-3 p-6 lg:col-span-4" style={{ animationDelay: "60ms" }}>
          <Gauge value={score} />
          <div className="text-center">
            <p className="text-sm font-semibold">Launch readiness</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{doneCount} of {tasks.length} checklist items closed</p>
          </div>
          <Link href="/dashboard/checklist" className="text-xs font-bold uppercase tracking-wider text-[var(--cyan)] transition hover:text-cyan-200">
            Open checklist →
          </Link>
        </div>

        {/* Stats */}
        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8">
          <Stat icon="box" label="Projects" value={String(projects.length)} sub={`${projects.filter((p) => p.status === "healthy").length} healthy · ${projects.filter((p) => p.status !== "healthy").length} need attention`} hue="#22d3ee" delay={100} />
          <Stat icon="launch" label="Live deployments" value={String(live)} sub={`of ${deps.length} tracked across all environments`} hue="#34d399" delay={160} />
          <Stat icon="activity" label="Deploy success" value={rate === null ? "—" : `${rate}%`} sub={rate === null ? "no finished deployments yet" : "finished deployments reaching live"} hue="#a78bfa" delay={220} />
          <Stat icon="alert" label="Open blockers" value={String(openBlockers.length)} sub={`${criticalOpen} critical · ${openBlockers.length - criticalOpen} high priority`} hue="#fbbf24" delay={280} />
        </div>

        {/* Category coverage */}
        <div className="card fade-up col-span-12 p-5 lg:col-span-5" style={{ animationDelay: "340ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Category coverage</h2>
            <span className="eyebrow">CHECKLIST</span>
          </div>
          <div className="space-y-4">
            {CATEGORIES.map((c) => {
              const items = tasks.filter((t) => t.category === c.id);
              const done = items.filter((t) => t.done).length;
              const pct = items.length ? Math.round((done / items.length) * 100) : 0;
              return (
                <div key={c.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.hue, boxShadow: `0 0 8px ${c.hue}` }} />
                      {c.label}
                    </span>
                    <span className="font-mono2 text-xs text-[var(--muted)]">{done}/{items.length}</span>
                  </div>
                  <Progress value={pct} hue={c.hue} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent deployments */}
        <div className="card fade-up col-span-12 p-5 lg:col-span-7" style={{ animationDelay: "400ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Recent deployments</h2>
            <Link href="/dashboard/deployments" className="text-xs font-bold uppercase tracking-wider text-[var(--cyan)] hover:text-cyan-200">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">No deployments logged yet. <Link className="text-[var(--cyan)] underline" href="/dashboard/deployments?new=1">Log the first one</Link>.</p>
          ) : (
            <ul className="divide-y divide-[rgba(146,176,255,0.08)]">
              {recent.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                  <span className="font-mono2 text-sm font-semibold text-[#bdf3ff]">{d.version}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{projectName(d.projectId)}</span>
                  <EnvBadge env={d.environment} />
                  <StatusBadge status={d.status} />
                  <span className="w-16 text-right font-mono2 text-[0.68rem] text-[var(--faint)]">{timeAgo(d.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Copilot insight */}
        <div className="card fade-up col-span-12 p-5 lg:col-span-7" style={{ animationDelay: "460ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display flex items-center gap-2 text-base font-bold">
              <Icon name="brain" size={17} className="text-[var(--violet)]" />
              Copilot self-reflection
            </h2>
            <span className="badge border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.1)] text-[var(--violet)]">{memories.length} MEMORIES</span>
          </div>
          {latestReflection ? (
            <div className="rounded-xl border border-[rgba(167,139,250,0.22)] bg-[rgba(167,139,250,0.06)] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-relaxed text-[var(--text)]">{latestReflection.summary}</p>
                <span className="font-display shrink-0 text-xl font-bold text-[var(--violet)]">{latestReflection.score}</span>
              </div>
              <p className="mt-2.5 border-t border-[rgba(167,139,250,0.18)] pt-2.5 text-xs leading-relaxed text-[var(--muted)]">
                <strong className="text-[#d8ccff]">Lesson:</strong> {latestReflection.lesson}
              </p>
              <p className="mt-2 font-mono2 text-[0.64rem] text-[var(--faint)]">{timeAgo(latestReflection.createdAt)} · {latestReflection.engine === "openai" ? "GPT engine" : "local analyst"}</p>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--muted)]">No reflections yet — ask the copilot something and it will evaluate its own answer.</p>
          )}
          <Link href="/dashboard/copilot" className="btn btn-ghost mt-4 w-full"><Icon name="spark" size={15} />Continue the conversation</Link>
        </div>

        {/* Quick actions */}
        <div className="card fade-up col-span-12 p-5 lg:col-span-5" style={{ animationDelay: "520ms" }}>
          <h2 className="font-display mb-3 text-base font-bold">Quick actions</h2>
          <div className="space-y-2">
            {[
              { href: "/dashboard/projects?new=1", icon: "plus", label: "New project", sub: "Register a service or app", hue: "#22d3ee" },
              { href: "/dashboard/deployments?new=1", icon: "launch", label: "Log deployment", sub: "Track a release end-to-end", hue: "#34d399" },
              { href: "/dashboard/checklist", icon: "checks", label: "Close blockers", sub: `${openBlockers.length} high-weight items open`, hue: "#fbbf24" },
              { href: "/dashboard/guide", icon: "book", label: "Deploy to Vercel", sub: "Six-step production guide", hue: "#e879f9" },
            ].map((a) => (
              <Link key={a.label} href={a.href} className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-3.5 py-3 transition hover:border-[rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.06)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: a.hue, background: `color-mix(in srgb, ${a.hue} 13%, transparent)` }}>
                  <Icon name={a.icon} size={16} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span className="block text-xs text-[var(--faint)]">{a.sub}</span>
                </span>
                <Icon name="external" size={13} className="text-[var(--faint)] transition group-hover:text-[var(--cyan)]" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}