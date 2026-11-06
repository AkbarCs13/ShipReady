"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errMsg, useFetch } from "@/lib/client";
import { fmtDate, isEmail, type UserPublic } from "@/lib/core";
import { Button, Confirm, ErrorState, Field, Icon, PageHead, Skeleton } from "@/components/ui";
import { useToast } from "@/components/toast";

interface Health {
  ok: boolean;
  database: string;
  ai: string;
  model: string | null;
}

function ProfileCard({ user, onSaved }: { user: UserPublic; onSaved: (u: UserPublic) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);
  const { push } = useToast();
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!isEmail(email.trim())) next.email = "Enter a valid email.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const res = await api<{ user: UserPublic }>("/api/auth/me", { method: "PATCH", body: { name, email } });
      onSaved(res.user);
      push({ title: "Profile saved", variant: "success" });
      router.refresh();
    } catch (err) {
      push({ title: "Couldn't save profile", message: errMsg(err), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card fade-up p-5 sm:p-6" aria-label="Profile">
      <h2 className="font-display mb-1 flex items-center gap-2 text-base font-bold"><Icon name="access" size={16} className="text-[var(--cyan)]" />Profile</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">Member since {fmtDate(user.createdAt)} · sessions last 7 days (HttpOnly cookie).</p>
      <form onSubmit={save} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="st-name" error={errors.name}>
          <input id="st-name" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Email" htmlFor="st-email" error={errors.email}>
          <input id="st-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Button type="submit" variant="primary" icon="check" loading={busy}>Save profile</Button>
      </form>
    </section>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords don't match.");
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/me", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      push({ title: "Password updated", message: "Use the new password next time you sign in.", variant: "success" });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card fade-up p-5 sm:p-6" style={{ animationDelay: "80ms" }} aria-label="Password">
      <h2 className="font-display mb-1 flex items-center gap-2 text-base font-bold"><Icon name="lock" size={16} className="text-[var(--violet)]" />Password</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">Stored as a salted scrypt hash — never in plain text.</p>
      <form onSubmit={save} className="space-y-4" noValidate>
        {error && <p className="rounded-xl border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.09)] px-3.5 py-2.5 text-xs text-[#fecdd3]" role="alert">{error}</p>}
        <Field label="Current password" htmlFor="pw-cur">
          <input id="pw-cur" type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="pw-new">
            <input id="pw-new" type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm">
            <input id="pw-confirm" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <Button type="submit" icon="key" loading={busy} disabled={!current || !next || !confirm}>Update password</Button>
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const meQ = useFetch<{ user: UserPublic }>("/api/auth/me");
  const healthQ = useFetch<Health>("/api/health");
  const [resetOpen, setResetOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { push } = useToast();

  async function resetDemo() {
    try {
      await api("/api/demo/reset", { method: "POST" });
      push({ title: "Demo workspace reloaded", message: "Projects, deployments, checklist, chat and memory were re-seeded.", variant: "success" });
    } catch (e) {
      push({ title: "Reset failed", message: errMsg(e), variant: "error" });
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const health = healthQ.data;

  return (
    <>
      <PageHead eyebrow="Operate · Configuration" title="Settings" desc="Your account, your integrations, and the big red reset button." />
      {meQ.error ? (
        <ErrorState message={meQ.error} onRetry={meQ.reload} />
      ) : meQ.loading || !meQ.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <ProfileCard key={meQ.data.user.id + meQ.data.user.name} user={meQ.data.user} onSaved={(u) => meQ.setData({ user: u })} />
            <PasswordCard />
          </div>

          <div className="space-y-4">
            {/* Integrations */}
            <section className="card fade-up p-5 sm:p-6" style={{ animationDelay: "140ms" }} aria-label="Integrations">
              <h2 className="font-display mb-4 flex items-center gap-2 text-base font-bold"><Icon name="database" size={16} className="text-[var(--green)]" />Integrations</h2>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-4 py-3">
                  <Icon name="database" size={17} className="text-[var(--cyan)]" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">PostgreSQL</p>
                    <p className="text-xs text-[var(--faint)]">Drizzle ORM · pooled via DATABASE_URL</p>
                  </div>
                  <span className={`badge ${health?.ok ? "border-[rgba(52,211,153,0.45)] bg-[rgba(52,211,153,0.1)] text-[var(--green)]" : "border-[rgba(251,113,133,0.45)] bg-[rgba(251,113,133,0.1)] text-[var(--rose)]"}`}>
                    {healthQ.loading ? "CHECKING…" : health?.ok ? "CONNECTED" : "OFFLINE"}
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-4 py-3">
                  <Icon name="spark" size={17} className="text-[var(--violet)]" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">OpenAI</p>
                    <p className="text-xs text-[var(--faint)]">{health?.ai === "configured" ? `Model: ${health.model} · key stays server-side` : "Set OPENAI_API_KEY to enable GPT answers"}</p>
                  </div>
                  <span className={`badge ${health?.ai === "configured" ? "border-[rgba(52,211,153,0.45)] bg-[rgba(52,211,153,0.1)] text-[var(--green)]" : "border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.1)] text-[var(--amber)]"}`}>
                    {healthQ.loading ? "CHECKING…" : health?.ai === "configured" ? "LIVE" : "LOCAL MODE"}
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-4 py-3">
                  <Icon name="terminal" size={17} className="text-[var(--amber)]" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Local analyst</p>
                    <p className="text-xs text-[var(--faint)]">Deterministic rules engine · always available, zero cost</p>
                  </div>
                  <span className="badge border-[rgba(52,211,153,0.45)] bg-[rgba(52,211,153,0.1)] text-[var(--green)]">READY</span>
                </li>
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-[var(--faint)]">
                Configure keys via environment variables (never in the browser). See the <Link href="/dashboard/guide" className="text-[var(--cyan)] underline">Deploy Guide</Link> for the full production setup.
              </p>
            </section>

            {/* Workspace */}
            <section className="card fade-up p-5 sm:p-6" style={{ animationDelay: "200ms" }} aria-label="Workspace">
              <h2 className="font-display mb-4 flex items-center gap-2 text-base font-bold"><Icon name="refresh" size={16} className="text-[var(--amber)]" />Workspace</h2>
              <div className="rounded-xl border border-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.05)] p-4">
                <p className="text-sm font-semibold text-[#fde68a]">Reload demo data</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  Replaces <strong>your</strong> projects, deployments, checklist, chat history and memories with the realistic seeded workspace. Other accounts are untouched.
                </p>
                <Button variant="ghost" size="sm" icon="zap" className="mt-3" onClick={() => setResetOpen(true)}>Reload demo workspace</Button>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[rgba(146,176,255,0.04)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Sign out</p>
                  <p className="text-xs text-[var(--faint)]">Ends this session on this device.</p>
                </div>
                <Button variant="danger-ghost" size="sm" icon="logout" loading={signingOut} onClick={signOut}>Sign out</Button>
              </div>
            </section>
          </div>
        </div>
      )}

      <Confirm
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetDemo}
        title="Reload demo workspace?"
        body="Your current projects, deployments, checklist items, chat messages, memories and reflections will be replaced by the seeded demo data. This cannot be undone."
        confirmLabel="Reload demo data"
      />
    </>
  );
}