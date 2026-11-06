"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("Network error — check your connection and try again.", 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=1";
    }
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function useFetch<T>(path: string | null): {
  data: T | null;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const tick = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    const id = ++tick.current;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => {
        if (tick.current === id) setData(d);
      })
      .catch((e: unknown) => {
        if (tick.current === id) setError(e instanceof Error ? e.message : "Failed to load.");
      })
      .finally(() => {
        if (tick.current === id) setLoading(false);
      });
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, setData, loading, error, reload };
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}