"use client";

import { useCallback, useEffect, useState } from "react";

/** Small data-fetching hook shared by all pages: load + reload + states. */
export function useData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

/** POST/PUT/DELETE helper returning {ok, error}. */
export async function apiCall(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const payload = await res.json().catch(() => ({}));
    return { ok: false, error: payload.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false };
  }
}
