"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface ToastOptions {
  title: string;
  message?: string;
  variant?: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
}

const ToastCtx = createContext<{ push: (t: ToastOptions) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const ICONS: Record<string, ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 8v5M12 16.5v.5" />
      <circle cx="12" cy="12" r="9.2" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 11v5M12 7.5V7" />
      <circle cx="12" cy="12" r="9.2" />
    </svg>
  ),
};

const TONE: Record<string, { color: string; bg: string }> = {
  success: { color: "#6ee7b7", bg: "rgba(52,211,153,0.14)" },
  error: { color: "#fda4af", bg: "rgba(251,113,133,0.14)" },
  info: { color: "#7dd3fc", bg: "rgba(34,211,238,0.13)" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: ToastOptions) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      const ttl = t.duration ?? (t.action ? 8000 : 4600);
      window.setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[120] flex w-[min(23rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {items.map((t) => {
          const tone = TONE[t.variant ?? "info"];
          return (
            <div key={t.id} role="status" className="toast-in card flex items-start gap-3 p-3.5" style={{ borderColor: `${tone.color}44` }}>
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ color: tone.color, background: tone.bg }}
              >
                {ICONS[t.variant ?? "info"]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t.message}</p>}
                {t.action && (
                  <button
                    className="mt-1.5 text-xs font-bold uppercase tracking-wider text-[var(--cyan)] hover:text-cyan-200"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-[var(--faint)] transition hover:text-[var(--text)]"
                onClick={() => dismiss(t.id)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}