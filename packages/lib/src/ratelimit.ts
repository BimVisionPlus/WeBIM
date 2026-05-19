/**
 * Token-bucket rate limiter.
 *
 * Redis-backed if REDIS_URL is set, otherwise in-memory (single-process only).
 * Suitable for auth endpoints, waitlist POST, password reset, invite-accept.
 *
 *   const ok = await rateLimit({ key: `signin:${ip}`, max: 5, windowSec: 60 });
 *   if (!ok.allowed) return new Response("Too Many Requests", { status: 429 });
 */

import { logger } from "./log";

type Args = { key: string; max: number; windowSec: number };
type Result = { allowed: boolean; remaining: number; resetAt: number };

const memBuckets = new Map<string, { count: number; resetAt: number }>();

function memCheck({ key, max, windowSec }: Args): Result {
  const now = Date.now();
  const win = windowSec * 1000;
  const b = memBuckets.get(key);
  if (!b || b.resetAt < now) {
    const resetAt = now + win;
    memBuckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }
  b.count += 1;
  if (b.count > max) return { allowed: false, remaining: 0, resetAt: b.resetAt };
  return { allowed: true, remaining: max - b.count, resetAt: b.resetAt };
}

let redisClient: any = null;
async function redis() {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    // ioredis is optional — fall back to memory if absent.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");
    redisClient = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    logger().warn({ err }, "ratelimit.redis_unavailable");
    return null;
  }
}

export async function rateLimit(args: Args): Promise<Result> {
  const r = await redis();
  if (!r) return memCheck(args);
  try {
    const k = `rl:${args.key}`;
    const win = args.windowSec;
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, win);
    const ttl = await r.ttl(k);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : win * 1000);
    if (count > args.max) return { allowed: false, remaining: 0, resetAt };
    return { allowed: true, remaining: args.max - count, resetAt };
  } catch (err) {
    logger().warn({ err }, "ratelimit.redis_err_fallback_memory");
    return memCheck(args);
  }
}

/** Pull a stable IP-like key from a Request. */
export function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anon"
  );
}

/**
 * One-call guard for mutation handlers. Returns a 429 Response if the actor
 * (user-id if known, otherwise IP) has exceeded the bucket. Otherwise null.
 *
 *   const limit = await rateLimitGuard(req, { name: "winwork.bids", actorId });
 *   if (limit) return limit;
 */
export async function rateLimitGuard(
  req: Request,
  opts: { name: string; actorId?: string | null; max?: number; windowSec?: number } = { name: "default" },
): Promise<Response | null> {
  const max = opts.max ?? 120;
  const windowSec = opts.windowSec ?? 60;
  const key = `api:${opts.name}:${opts.actorId ?? clientKey(req)}`;
  const r = await rateLimit({ key, max, windowSec });
  if (r.allowed) return null;
  const retry = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: { code: "rate_limited", message: `Quá nhiều yêu cầu. Thử lại sau ${retry}s.` } }),
    { status: 429, headers: { "content-type": "application/json", "retry-after": String(retry) } },
  );
}
