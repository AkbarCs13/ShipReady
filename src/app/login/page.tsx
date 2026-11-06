"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/lib/client";
import { DEMO_EMAIL, DEMO_PASSWORD, cx, isEmail } from "@/lib/core";
import { Button, Field, Icon } from "@/components/ui";

const TERMINAL_LINES = [
  { text: "$ vercel deploy --prod", tone: "#e9effd" },
  { text: "▲ Building shipready · next 16.2", tone: "#93a3c4" },
  { text: "✓ Compiled 24 routes in 8.2s", tone: "#34d399" },
  { text: "✓ Database connected · postgres (iad1)", tone: "#34d399" },
  { text: "✓ GET /api/health → 200 OK · 38ms", tone: "#34d399" },
  { text: "✓ Copilot memory restored · 5 facts", tone: "#22d3ee" },
  { text: "✓ Self-reflection logged · score 92", tone: "#a78bfa" },
  { text: "● Production alias assigned — ready.", tone: "#e879f9" },
];

function Terminal() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = window.setInterval(() => {
      setCount((c) => (c >= TERMINAL_LINES.length ? 1 : c + 1));
    }, 1300);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="card w-full max-w-md overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#fb7185]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
        <span className="ml-2 font-mono2 text-[0.62rem] tracking-[0.18em] text-[var(--faint)]">DEPLOY.LOG — LIVE</span>
      </div>
      <div className="min-h-[13.2rem] px-4 py-3 font-mono2 text-[0.74rem] leading-[1.65]">
        {TERMINAL_LINES.slice(0, count).map((l, i) => (
          <p key={i} className="fade-up" style={{ color: l.tone }}>
            {l.text}
          </p>
        ))}
        <span className="cursor-blink text-[var(--cyan)]">▊</span>
      </div>
    </div>
  );
}

function Orbits() {
  return (
    <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 opacity-60" aria-hidden="true">
      <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="1" strokeDasharray="3 5" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(167,139,250,0.22)" strokeWidth="1" />
      <g className="orbit-spin">
        <circle cx="160" cy="100" r="4" fill="#22d3ee" />
      </g>
      <g className="orbit-spin-rev">
        <circle cx="100" cy="12" r="3" fill="#e879f9" />
      </g>
      <circle cx="100" cy="100" r="5" fill="#a78bfa" />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  function validate(): boolean {
    const next: typeof errors = {};
    if (mode === "signup" && name.trim().length < 2) next.name = "Enter your name (2+ characters).";
    if (!isEmail(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "At least 8 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await api(mode === "signin" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: mode === "signin" ? { email, password } : { name, email, password },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(errMsg(err));
      setBusy(false);
    }
  }

  async function launchDemo() {
    setServerError(null);
    setDemoBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email: DEMO_EMAIL, password: DEMO_PASSWORD } });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setServerError(errMsg(err));
      setDemoBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-[var(--line)] p-10 lg:flex xl:p-14">
        <Orbits />
        <div className="fade-up flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22d3ee,#a78bfa_60%,#e879f9)] text-[#06121c] shadow-[0_0_30px_-6px_rgba(34,211,238,0.8)]">
            <Icon name="rocket" size={20} />
          </span>
          <span className="font-display text-xl font-bold">
            Ship<span className="text-[var(--cyan)]">Ready</span>
          </span>
          <span className="badge ml-1 border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.1)] text-[var(--violet)]">MISSION CONTROL</span>
        </div>

        <div className="relative my-10 max-w-lg">
          <p className="eyebrow fade-up mb-4" style={{ animationDelay: "80ms" }}>
            19 · Deployment, Accessibility & Production Readiness
          </p>
          <h1 className="font-display fade-up text-[2.6rem] font-bold leading-[1.08] xl:text-5xl" style={{ animationDelay: "160ms" }}>
            Ship with <span className="bg-[linear-gradient(100deg,#22d3ee,#a78bfa,#e879f9)] bg-clip-text text-transparent">proof</span>,
            <br />
            not hope.
          </h1>
          <p className="fade-up mt-4 max-w-md text-[0.95rem] leading-relaxed text-[var(--muted)]" style={{ animationDelay: "240ms" }}>
            One command center for your deployments, readiness checklist and an AI copilot that
            <strong className="text-[var(--text)]"> remembers across sessions</strong> and
            <strong className="text-[var(--text)]"> reflects on every answer</strong>.
          </p>
          <div className="fade-up mt-7" style={{ animationDelay: "320ms" }}>
            <Terminal />
          </div>
        </div>

        <div className="fade-up grid max-w-lg grid-cols-3 gap-3" style={{ animationDelay: "400ms" }}>
          {[
            { icon: "activity", label: "Health probe", sub: "/api/health · live" },
            { icon: "access", label: "WCAG AA", sub: "keyboard-first UI" },
            { icon: "brain", label: "Persistent AI", sub: "memory + reflection" },
          ].map((f) => (
            <div key={f.label} className="card px-3.5 py-3">
              <Icon name={f.icon} size={16} className="mb-2 text-[var(--cyan)]" />
              <p className="text-[0.78rem] font-semibold">{f.label}</p>
              <p className="mt-0.5 font-mono2 text-[0.62rem] text-[var(--faint)]">{f.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Auth panel */}
      <section className="flex w-full flex-col items-center justify-center px-4 py-10 sm:px-8 lg:w-[30rem] xl:w-[34rem]">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22d3ee,#a78bfa_60%,#e879f9)] text-[#06121c]">
            <Icon name="rocket" size={17} />
          </span>
          <span className="font-display text-lg font-bold">
            Ship<span className="text-[var(--cyan)]">Ready</span>
          </span>
        </div>

        <div className="card fade-up w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-[rgba(7,12,24,0.6)] p-1" role="tablist" aria-label="Authentication mode">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                className={cx(
                  "rounded-lg py-2 text-sm font-semibold transition",
                  mode === m
                    ? "bg-[linear-gradient(110deg,rgba(34,211,238,0.2),rgba(167,139,250,0.16))] text-[#bdf3ff] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
                onClick={() => {
                  setMode(m);
                  setErrors({});
                  setServerError(null);
                }}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 className="font-display text-xl font-bold">{mode === "signin" ? "Welcome back, commander" : "Open your command center"}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {mode === "signin" ? "Your workspace, memory and reflections are waiting." : "Free workspace · seeded demo data available in one click."}
          </p>

          {expired && (
            <div className="mt-4 rounded-xl border border-[rgba(251,191,36,0.35)] bg-[rgba(251,191,36,0.08)] px-3.5 py-2.5 text-xs text-[#fde68a]" role="status">
              Your session expired. Sign in again to continue.
            </div>
          )}
          {serverError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.09)] px-3.5 py-2.5 text-xs leading-relaxed text-[#fecdd3]" role="alert">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {mode === "signup" && (
              <Field label="Full name" htmlFor="name" error={errors.name}>
                <input id="name" ref={mode === "signup" ? emailRef : undefined} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" aria-invalid={Boolean(errors.name)} />
              </Field>
            )}
            <Field label="Email" htmlFor="email" error={errors.email}>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.dev" autoComplete="email" aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password} hint={mode === "signup" ? "Minimum 8 characters. Stored as a salted scrypt hash." : undefined}>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} aria-invalid={Boolean(errors.password)} />
            </Field>
            <Button type="submit" variant="primary" loading={busy} className="w-full" icon="rocket">
              {mode === "signin" ? "Sign in to mission control" : "Create my workspace"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
            <span className="h-px flex-1 bg-[var(--line)]" />
            or
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <Button variant="violet" className="w-full" loading={demoBusy} onClick={launchDemo} icon="zap">
            Launch demo workspace
          </Button>
          <p className="mt-3 text-center font-mono2 text-[0.66rem] leading-relaxed text-[var(--faint)]">
            {DEMO_EMAIL} · {DEMO_PASSWORD}
            <br />
            pre-seeded projects, deployments & copilot memory
          </p>
        </div>

        <p className="mt-6 max-w-md text-center text-[0.7rem] leading-relaxed text-[var(--faint)]">
          Sessions use HttpOnly, SameSite cookies · secrets stay server-side · built for Vercel + Postgres
        </p>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return <LoginInner />;
}