/**
 * GET /api/health — deep health check of every downstream dependency.
 *
 * Returns 200 if all hard dependencies are up (Postgres, Redis when configured),
 * 503 if any are down. Soft deps (Ollama, MinIO, APS) report `ok: false` without
 * failing the response — they degrade product features but don't take the app down.
 *
 * Wire this to UptimeRobot / BetterUptime / a cron worker polling.
 */

import { NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { aiHealth } from "@atlas/ai";

export const dynamic = "force-dynamic";

type CheckResult = { ok: boolean; latencyMs: number; detail?: string };

async function timed(fn: () => Promise<void>): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - t0, detail: String(e?.message ?? e).slice(0, 200) };
  }
}

async function checkPostgres(): Promise<CheckResult> {
  return timed(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
}

async function checkRedis(): Promise<CheckResult> {
  return timed(async () => {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL not configured");
    const IORedis = require("ioredis");
    const c = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await c.connect();
    await c.ping();
    await c.quit();
  });
}

async function checkS3(): Promise<CheckResult> {
  return timed(async () => {
    const endpoint = process.env.S3_ENDPOINT;
    if (!endpoint) throw new Error("S3_ENDPOINT not configured");
    // Different providers expose health differently:
    //   MinIO     → /minio/health/live (200)
    //   Cloudflare R2 → no health endpoint; root returns 400 (alive) or network error (down)
    //   AWS S3    → no health endpoint; same shape as R2
    // We treat HTTP 4xx as "alive but not authorized" = service up.
    try {
      const res = await fetch(`${endpoint}/minio/health/live`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
    } catch {
      // fall through to TCP-style check
    }
    const res2 = await fetch(endpoint, { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (!res2) throw new Error("unreachable");
    // 200, 400, 403 — all mean service up (R2/S3 don't expose a public health URL)
    if (res2.status >= 500) throw new Error(`HTTP ${res2.status}`);
  });
}

// Probe the active LLM + STT providers via the provider-aware aiHealth().
// Field names `ollama` / `whisper` are kept for UI / banner compatibility —
// they represent the ACTIVE LLM and STT provider, whichever it is (Ollama,
// Groq, etc). The AI offline banner polls these fields.
async function checkAi(): Promise<{ ollama: CheckResult; whisper: CheckResult }> {
  const t0 = Date.now();
  try {
    const h = await aiHealth();
    const llmOk = h.enabled && h.ollama.reachable && h.ollama.missing.length === 0;
    const sttOk = h.enabled && h.whisper.reachable;
    const latencyMs = Date.now() - t0;
    return {
      ollama: {
        ok: llmOk,
        latencyMs,
        detail: llmOk ? undefined : (h.ollama.error ?? (h.ollama.missing.length ? `missing models: ${h.ollama.missing.join(",")}` : "unreachable")),
      },
      whisper: {
        ok: sttOk,
        latencyMs,
        detail: sttOk ? undefined : (h.whisper.error ?? "unreachable"),
      },
    };
  } catch (e: any) {
    const latencyMs = Date.now() - t0;
    const detail = String(e?.message ?? e).slice(0, 200);
    return {
      ollama: { ok: false, latencyMs, detail },
      whisper: { ok: false, latencyMs, detail },
    };
  }
}

export async function GET() {
  const [postgres, redis, s3, ai] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkS3(),
    checkAi(),
  ]);

  const hardOk = postgres.ok && (process.env.REDIS_URL ? redis.ok : true);
  const status = hardOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: hardOk,
      time: new Date().toISOString(),
      hard: {
        postgres,
        redis: process.env.REDIS_URL ? redis : { ok: true, latencyMs: 0, detail: "not configured" },
      },
      soft: { s3, ollama: ai.ollama, whisper: ai.whisper },
    },
    { status },
  );
}
