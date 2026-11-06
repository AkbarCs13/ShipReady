// Shared domain types + pure helpers (safe for client and server).

export type Environment = "production" | "staging" | "preview";
export type ProjectStatus = "healthy" | "degraded" | "down" | "setup";
export type DeployStatus = "queued" | "building" | "live" | "failed" | "rolled_back";
export type Priority = "critical" | "high" | "medium" | "low";
export type Category = "deployment" | "accessibility" | "security" | "performance" | "observability";
export type MemoryKind = "fact" | "preference" | "insight";

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}
export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  repoUrl: string;
  framework: string;
  environment: Environment;
  status: ProjectStatus;
  region: string;
  createdAt: string;
  updatedAt: string;
}
export interface Deployment {
  id: string;
  userId: string;
  projectId: string;
  version: string;
  environment: Environment;
  status: DeployStatus;
  commitSha: string;
  commitMessage: string;
  durationSec: number | null;
  triggeredBy: string;
  createdAt: string;
}
export interface Task {
  id: string;
  userId: string;
  category: Category;
  title: string;
  notes: string;
  done: boolean;
  priority: Priority;
  position: number;
  createdAt: string;
}
export interface Message {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  engine: "openai" | "local" | null;
  createdAt: string;
}
export interface Memory {
  id: string;
  userId: string;
  kind: MemoryKind;
  content: string;
  source: "manual" | "auto" | "reflection";
  createdAt: string;
}
export interface Reflection {
  id: string;
  userId: string;
  messageId: string | null;
  summary: string;
  lesson: string;
  score: number;
  engine: "openai" | "local";
  createdAt: string;
}

export const DEMO_EMAIL = "demo@shipready.dev";
export const DEMO_PASSWORD = "launch123";

export const CATEGORIES: { id: Category; label: string; hint: string; hue: string }[] = [
  { id: "deployment", label: "Deployment", hint: "Vercel config, env vars, routing", hue: "var(--cyan)" },
  { id: "accessibility", label: "Accessibility", hint: "WCAG AA, keyboard, semantics", hue: "var(--violet)" },
  { id: "security", label: "Security", hint: "Secrets, sessions, CORS", hue: "var(--rose)" },
  { id: "performance", label: "Performance", hint: "Bundle, caching, queries", hue: "var(--amber)" },
  { id: "observability", label: "Observability", hint: "Health checks, logs, alerts", hue: "var(--green)" },
];

export const PRIORITIES: { id: Priority; label: string; weight: number }[] = [
  { id: "critical", label: "Critical", weight: 5 },
  { id: "high", label: "High", weight: 3 },
  { id: "medium", label: "Medium", weight: 2 },
  { id: "low", label: "Low", weight: 1 },
];

export const DEPLOY_STATUSES: { id: DeployStatus; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "building", label: "Building" },
  { id: "live", label: "Live" },
  { id: "failed", label: "Failed" },
  { id: "rolled_back", label: "Rolled back" },
];

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: "healthy", label: "Healthy" },
  { id: "degraded", label: "Degraded" },
  { id: "down", label: "Down" },
  { id: "setup", label: "In setup" },
];

export const ENVIRONMENTS: Environment[] = ["production", "staging", "preview"];
export const FRAMEWORKS = ["Next.js", "Remix", "Astro", "SvelteKit", "Express", "FastAPI", "Other"];
export const REGIONS = [
  { id: "iad1", label: "iad1 · Washington D.C." },
  { id: "sfo1", label: "sfo1 · San Francisco" },
  { id: "fra1", label: "fra1 · Frankfurt" },
  { id: "hnd1", label: "hnd1 · Tokyo" },
  { id: "syd1", label: "syd1 · Sydney" },
];

export function priorityWeight(p: string): number {
  return PRIORITIES.find((x) => x.id === p)?.weight ?? 2;
}

export function readinessScore(tasks: { done: boolean; priority: string }[]): number {
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((s, t) => s + priorityWeight(t.priority), 0);
  const done = tasks.filter((t) => t.done).reduce((s, t) => s + priorityWeight(t.priority), 0);
  return Math.round((done / total) * 100);
}

export function successRate(deployments: { status: string }[]): number | null {
  const finished = deployments.filter((d) => ["live", "failed", "rolled_back"].includes(d.status));
  if (finished.length === 0) return null;
  return Math.round((finished.filter((d) => d.status === "live").length / finished.length) * 100);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortSha(sha: string): string {
  return sha ? sha.slice(0, 7) : "—";
}

export function randomSha(): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 40; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}