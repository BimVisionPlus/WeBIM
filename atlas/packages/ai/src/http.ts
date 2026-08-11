// Thin fetch wrapper with timeout + categorised failure reasons.
// Keeps every adapter free of try/catch + AbortController boilerplate.

import type { AiFailReason } from "./types";

export type HttpResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; reason: AiFailReason; status?: number; error?: string };

export async function postJson<T>(
  url: string,
  body: unknown,
  opts: { timeoutMs: number; headers?: Record<string, string> } = { timeoutMs: 30_000 },
): Promise<HttpResult<T>> {
  return doFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
    body: JSON.stringify(body),
  }, opts.timeoutMs);
}

export async function postForm<T>(
  url: string,
  form: FormData,
  opts: { timeoutMs: number; headers?: Record<string, string> } = { timeoutMs: 60_000 },
): Promise<HttpResult<T>> {
  return doFetch<T>(url, {
    method: "POST",
    headers: opts.headers,
    body: form,
  }, opts.timeoutMs);
}

export async function getJson<T>(
  url: string,
  opts: { timeoutMs: number } = { timeoutMs: 10_000 },
): Promise<HttpResult<T>> {
  return doFetch<T>(url, { method: "GET" }, opts.timeoutMs);
}

async function doFetch<T>(url: string, init: RequestInit, timeoutMs: number): Promise<HttpResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // cache: "no-store" — Next.js Node fetch caches GETs by default, which
    // would freeze /api/tags response and hide newly-pulled models.
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    if (r.status === 404) return { ok: false, reason: "model_missing", status: 404 };
    if (r.status === 429) return { ok: false, reason: "rate_limited", status: 429 };
    if (r.status >= 500) return { ok: false, reason: "server_error", status: r.status };
    if (!r.ok) return { ok: false, reason: "server_error", status: r.status, error: await safeText(r) };
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = (await r.json()) as T;
      return { ok: true, data, status: r.status };
    }
    return { ok: true, data: (await r.text()) as unknown as T, status: r.status };
  } catch (e: any) {
    if (e?.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "unreachable", error: e?.message };
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(r: Response): Promise<string | undefined> {
  try {
    return (await r.text()).slice(0, 500);
  } catch {
    return undefined;
  }
}
