"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "@/lib/core";
import { useToast } from "@/components/toast";

/* ── Icons ──────────────────────────────────────────────────────── */
const PATHS: Record<string, ReactNode> = {
  rocket: <><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.8-.7-2.2-.7-3 .8Z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.9 12.9 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2Z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  grid: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  box: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
  launch: <><path d="M12 2v8" /><path d="m8 6 4-4 4 4" /><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /></>,
  checks: <><path d="m3 7 2 2 4-4" /><path d="m3 17 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></>,
  spark: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.4" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M10 11v6M14 11v6" /></>,
  pencil: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  brain: <><path d="M12 4.5a2.5 2.5 0 0 0-5 0 2.7 2.7 0 0 0-2.6 3.3A2.8 2.8 0 0 0 3.2 13 2.9 2.9 0 0 0 5 18.3a2.7 2.7 0 0 0 4.5 2.1A2.4 2.4 0 0 0 12 19Z" /><path d="M12 4.5a2.5 2.5 0 0 1 5 0 2.7 2.7 0 0 1 2.6 3.3 2.8 2.8 0 0 1 1.2 5.2 2.9 2.9 0 0 1-1.8 5.3 2.7 2.7 0 0 1-4.5 2.1A2.4 2.4 0 0 1 12 19Z" /><path d="M12 4.5V19" /></>,
  reflect: <><path d="M12 3v18" strokeDasharray="2.5 3" /><path d="M8 7H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4" /><path d="M16 7h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-4" /></>,
  alert: <><path d="m10.3 3.8-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  up: <path d="m18 15-6-6-6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  terminal: <><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></>,
  shield: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
  zap: <path d="M13 2 3 14h8l-1 8 11-13h-8l1-7Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  globe: <><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19" /><path d="M12 2.5a15 15 0 0 1 0 19 15 15 0 0 1 0-19Z" /></>,
  clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2" /></>,
  git: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v6M12 15.5v6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  database: <><ellipse cx="12" cy="5" rx="8.5" ry="3" /><path d="M3.5 5v14c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3V5" /><path d="M3.5 12c0 1.66 3.8 3 8.5 3s8.5-1.34 8.5-3" /></>,
  key: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 10-10" /><path d="m16 7 3 3" /></>,
  access: <><circle cx="12" cy="5" r="2" /><path d="M4 9.5c2.7.7 5.3 1 8 1s5.3-.3 8-1" /><path d="M12 10.5v4l-3 6.5M12 14.5l3 6.5" /></>,
  info: <><circle cx="12" cy="12" r="9.2" /><path d="M12 11v5M12 7.5V7" /></>,
};

export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", className)}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

export function Spinner({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cx("animate-spin shrink-0", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── Buttons ────────────────────────────────────────────────────── */
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "violet" | "ghost" | "danger" | "danger-ghost";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
  icon?: string;
}
export function Button({ variant = "ghost", size = "md", loading, icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "icon" && "btn-icon", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === "sm" ? 14 : 15} /> : null}
      {children}
    </button>
  );
}

/* ── Badges ─────────────────────────────────────────────────────── */
const STATUS_TONE: Record<string, { c: string; label: string; pulse?: boolean }> = {
  live: { c: "#34d399", label: "LIVE", pulse: true },
  healthy: { c: "#34d399", label: "HEALTHY", pulse: true },
  building: { c: "#22d3ee", label: "BUILDING", pulse: true },
  queued: { c: "#60a5fa", label: "QUEUED" },
  failed: { c: "#fb7185", label: "FAILED" },
  down: { c: "#fb7185", label: "DOWN" },
  rolled_back: { c: "#fbbf24", label: "ROLLED BACK" },
  degraded: { c: "#fbbf24", label: "DEGRADED" },
  setup: { c: "#a78bfa", label: "IN SETUP" },
};

export function StatusBadge({ status }: { status: string }) {
  const t = STATUS_TONE[status] ?? { c: "#93a3c4", label: status.toUpperCase() };
  return (
    <span className="badge" style={{ color: t.c, borderColor: `${t.c}55`, background: `${t.c}14` }}>
      <span className={cx("h-1.5 w-1.5 rounded-full", t.pulse && "pulse-dot")} style={{ background: t.c }} />
      {t.label}
    </span>
  );
}

const ENV_TONE: Record<string, string> = { production: "#22d3ee", staging: "#a78bfa", preview: "#60a5fa" };
export function EnvBadge({ env }: { env: string }) {
  const c = ENV_TONE[env] ?? "#93a3c4";
  return (
    <span className="badge" style={{ color: c, borderColor: `${c}45`, background: `${c}10` }}>
      {env.toUpperCase()}
    </span>
  );
}

const PRIO_TONE: Record<string, string> = { critical: "#fb7185", high: "#fbbf24", medium: "#60a5fa", low: "#5d6c8c" };
export function PriorityBadge({ p }: { p: string }) {
  const c = PRIO_TONE[p] ?? "#93a3c4";
  return (
    <span className="badge" style={{ color: c, borderColor: `${c}50`, background: `${c}12` }}>
      {p.toUpperCase()}
    </span>
  );
}

/* ── Overlays ───────────────────────────────────────────────────── */
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((f) => !f.hasAttribute("disabled"));
    const first = focusables()[0];
    window.setTimeout(() => first?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = focusables();
        if (list.length === 0) return;
        const firstEl = list[0];
        const lastEl = list[list.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(3,6,14,0.72)] p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx("card fade-up max-h-[88vh] w-full overflow-y-auto p-5 sm:p-6", wide ? "max-w-2xl" : "max-w-md")}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button aria-label="Close dialog" className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--text)]" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-[rgba(3,6,14,0.66)] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="slide-in-right h-full w-full max-w-lg overflow-y-auto border-l border-[var(--line)] bg-[#0b1222] p-5 sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button aria-label="Close panel" className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--text)]" onClick={onClose}>
            <Icon name="x" size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Delete",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ── States & layout bits ───────────────────────────────────────── */
export function EmptyState({
  icon = "box",
  title,
  body,
  children,
}: {
  icon?: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="card fade-up flex flex-col items-center px-6 py-14 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.25),transparent_70%)] blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] text-[var(--cyan)]">
          <Icon name={icon} size={28} />
        </div>
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(251,113,133,0.35)] bg-[rgba(251,113,133,0.1)] text-[var(--rose)]">
        <Icon name="alert" size={24} />
      </div>
      <h3 className="font-display text-lg font-bold">Something went wrong</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--muted)]">{message}</p>
      {onRetry && (
        <Button className="mt-5" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden="true" />;
}

export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-[var(--rose)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[var(--faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Progress({ value, hue = "var(--cyan)" }: { value: number; hue?: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(146,176,255,0.1)]"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: `linear-gradient(90deg, ${hue}, ${hue}bb)`, boxShadow: `0 0 12px ${hue}66` }}
      />
    </div>
  );
}

export function Gauge({ value, size = 168, label = "READY" }: { value: number; size?: number; label?: string }) {
  const id = useId().replace(/:/g, "");
  const r = 42;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.min(100, Math.max(0, value)) / 100);
  const tone = value >= 80 ? "#34d399" : value >= 50 ? "#22d3ee" : "#fbbf24";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Readiness score ${value} percent`}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="55%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#e879f9" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(146,176,255,0.12)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          transform="rotate(-90 50 50)"
          className="gauge-sweep"
          style={{ ["--gauge-circ" as string]: `${circ}`, filter: "drop-shadow(0 0 6px rgba(34,211,238,0.5))", transition: "stroke-dashoffset 0.9s cubic-bezier(0.3,0.7,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold" style={{ color: tone }}>
          {value}
          <span className="text-lg text-[var(--muted)]">%</span>
        </span>
        <span className="eyebrow mt-1" style={{ color: "var(--muted)" }}>{label}</span>
      </div>
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  children?: ReactNode;
}) {
  return (
    <div className="fade-up mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-1.5">{eyebrow}</p>
        <h1 className="font-display text-2xl font-bold sm:text-[1.7rem]">{title}</h1>
        {desc && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--muted)]">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

export function CopyBtn({ text, small = true }: { text: string; small?: boolean }) {
  const { push } = useToast();
  const [done, setDone] = useState(false);
  return (
    <Button
      size={small ? "sm" : "md"}
      icon={done ? "check" : "copy"}
      aria-label="Copy to clipboard"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          push({ title: "Copied to clipboard", variant: "success" });
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          push({ title: "Couldn't access the clipboard", message: "Select the text and copy manually.", variant: "error" });
        }
      }}
    >
      {done ? "Copied" : "Copy"}
    </Button>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.id} className="chip" data-active={value === o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}>
          {o.label}
        </button>
      ))}
    </div>
  );
}