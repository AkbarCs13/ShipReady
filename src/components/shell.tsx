"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api, useFetch } from "@/lib/client";
import { cx, type UserPublic } from "@/lib/core";
import { Icon } from "@/components/ui";

const NAV: { section: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    section: "Command",
    items: [
      { href: "/dashboard", label: "Overview", icon: "grid" },
      { href: "/dashboard/copilot", label: "AI Copilot", icon: "spark" },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: "box" },
      { href: "/dashboard/deployments", label: "Deployments", icon: "launch" },
      { href: "/dashboard/checklist", label: "Readiness Checklist", icon: "checks" },
    ],
  },
  {
    section: "Operate",
    items: [
      { href: "/dashboard/guide", label: "Deploy Guide", icon: "book" },
      { href: "/dashboard/settings", label: "Settings", icon: "gear" },
    ],
  },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22d3ee,#a78bfa_60%,#e879f9)] text-[#06121c] shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)]">
        <Icon name="rocket" size={18} />
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Ship<span className="text-[var(--cyan)]">Ready</span>
      </span>
    </Link>
  );
}

function HealthPill() {
  const { data } = useFetch<{ ok: boolean; ai: string }>("/api/health");
  const state = !data ? "loading" : !data.ok ? "down" : data.ai === "configured" ? "full" : "local";
  const conf = {
    loading: { c: "#5d6c8c", label: "CHECKING SYSTEMS" },
    down: { c: "#fb7185", label: "DATABASE OFFLINE" },
    full: { c: "#34d399", label: "ALL SYSTEMS GO" },
    local: { c: "#22d3ee", label: "LOCAL AI MODE" },
  }[state];
  return (
    <Link
      href="/dashboard/settings"
      className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[rgba(146,176,255,0.05)] px-2.5 py-2 transition hover:border-[rgba(34,211,238,0.4)]"
      title={state === "local" ? "Database online. Add OPENAI_API_KEY to enable the GPT copilot." : "System status"}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", state !== "loading" && "pulse-dot")} style={{ background: conf.c }} />
      <span className="font-mono2 text-[0.6rem] font-semibold tracking-[0.16em]" style={{ color: conf.c }}>
        {conf.label}
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="mb-1.5 px-2 font-mono2 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[var(--faint)]">
            {group.section}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className="nav-link" data-active={active} aria-current={active ? "page" : undefined} onClick={onNavigate}>
                    <Icon name={item.icon} size={16} className={active ? "text-[var(--cyan)]" : ""} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Shell({ user, children }: { user: UserPublic; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  const userRow = (
    <div className="border-t border-[var(--line)] p-3">
      <HealthPill />
      <div className="mt-2.5 flex items-center gap-2.5 px-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.25),rgba(167,139,250,0.3))] font-display text-xs font-bold text-[#bdf3ff] ring-1 ring-[rgba(34,211,238,0.35)]">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold leading-tight">{user.name}</p>
          <p className="truncate text-[0.68rem] text-[var(--faint)]">{user.email}</p>
        </div>
        <button
          className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[rgba(251,113,133,0.12)] hover:text-[var(--rose)] disabled:opacity-50"
          onClick={logout}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
        >
          <Icon name="logout" size={15} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--line)] bg-[rgba(8,13,26,0.82)] backdrop-blur-xl lg:flex">
        <div className="border-b border-[var(--line)] px-4 py-4">
          <Brand />
        </div>
        <NavList pathname={pathname} />
        {userRow}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[rgba(6,10,20,0.86)] px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <button
          className="rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] transition hover:text-[var(--text)]"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <Icon name="menu" size={18} />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[rgba(3,6,14,0.7)] backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="slide-in-right absolute inset-y-0 right-0 flex w-[17rem] flex-col border-l border-[var(--line)] bg-[#0a1120]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4">
              <Brand />
              <button className="rounded-lg p-1.5 text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu">
                <Icon name="x" size={17} />
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            {userRow}
          </div>
        </div>
      )}

      <main id="main" className="lg:pl-60">
        <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-9 lg:py-9">{children}</div>
      </main>
    </div>
  );
}