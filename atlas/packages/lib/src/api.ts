/**
 * Shared API-route plumbing.
 *
 *   const POST = apiHandler({ rateLimit: { max: 60, windowSec: 60 } }, async (req, ctx) => {
 *     const data = ctx.parse(BodySchema);
 *     return ctx.ok({ ... });
 *   });
 *
 * Contract:
 *  - Rate-limits by user ID (if logged in) or IP (else). 429 with `retryAfterSec`.
 *  - Catches Zod errors → 400 with a friendly Vietnamese field map.
 *  - Catches AuthError → 401/403.
 *  - Catches arbitrary throws → 500 with a request-correlation id (and logs).
 *
 * The envelope shape (every error response):
 *   { error: { code: string, message: string, fields?: Record<string, string> } }
 */

import { ZodError, type ZodSchema } from "zod";
import { rateLimit, clientKey } from "./ratelimit";
import { logger } from "./log";

// We don't import from "next/server" — this lib is consumed by web routes only,
// and using the Web standard Response keeps @atlas/lib portable.
type NextRequest = Request;
const NextResponse = {
  json: (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    }),
};

export type ApiOptions = {
  /** Per-actor token bucket. Defaults: 120 req / 60 s on writes, off on reads. */
  rateLimit?: { max: number; windowSec: number };
  /** Optional name (audit + log correlation). */
  name?: string;
};

export type ApiCtx = {
  req: NextRequest;
  /** Set by the handler when it knows the user. Used as rate-limit key + log corr. */
  setActorId: (id: string) => void;
  /** Parse and validate JSON body. Throws if invalid (caught → 400). */
  parse: <T>(schema: ZodSchema<T>) => Promise<T>;
  /** Friendly OK response. */
  ok: <T>(data: T, init?: ResponseInit) => Response;
  /** Friendly client-error response. */
  fail: (code: string, message: string, opts?: { status?: number; fields?: Record<string, string> }) => Response;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

const FRIENDLY_FIELD: Record<string, string> = {
  Required: "Trường này là bắt buộc.",
  "Invalid email": "Email không hợp lệ.",
  "Invalid url": "URL không hợp lệ.",
};

function vnFieldMessage(zodMsg: string): string {
  return FRIENDLY_FIELD[zodMsg] ?? zodMsg;
}

function flattenZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_";
    if (!out[k]) out[k] = vnFieldMessage(issue.message);
  }
  return out;
}

export function apiHandler(
  opts: ApiOptions,
  handler: (req: NextRequest, ctx: ApiCtx) => Promise<Response>,
) {
  return async (req: NextRequest, _routeCtx?: any): Promise<Response> => {
    const reqId = Math.random().toString(36).slice(2, 10);
    let actorId: string | null = null;
    const ctx: ApiCtx = {
      req,
      setActorId: (id) => {
        actorId = id;
      },
      parse: async (schema) => {
        let body: any;
        try {
          body = await req.json();
        } catch {
          throw new ApiError(400, "invalid_json", "Body không phải JSON hợp lệ.");
        }
        const r = schema.safeParse(body);
        if (!r.success) {
          throw new ApiError(400, "validation_failed", "Dữ liệu không hợp lệ", flattenZod(r.error));
        }
        return r.data;
      },
      ok: <T>(data: T, init?: ResponseInit) => NextResponse.json(data as any, init),
      fail: (code, message, opts = {}) =>
        NextResponse.json(
          { error: { code, message, fields: opts.fields } },
          { status: opts.status ?? 400, headers: { "x-request-id": reqId } },
        ),
    };

    // Rate limit (lazy — only on write methods unless caller opted in)
    const isMutation = ["POST", "PATCH", "PUT", "DELETE"].includes(req.method);
    if (opts.rateLimit || isMutation) {
      const cfg = opts.rateLimit ?? { max: 120, windowSec: 60 };
      const key = `api:${opts.name ?? new URL(req.url).pathname}:${actorId ?? clientKey(req)}`;
      const r = await rateLimit({ key, max: cfg.max, windowSec: cfg.windowSec });
      if (!r.allowed) {
        const retry = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
        return NextResponse.json(
          { error: { code: "rate_limited", message: `Quá nhiều yêu cầu. Thử lại sau ${retry}s.` } },
          { status: 429, headers: { "retry-after": String(retry), "x-request-id": reqId } },
        );
      }
    }

    try {
      const res = await handler(req, ctx);
      return res;
    } catch (e: any) {
      if (e instanceof ApiError) {
        return ctx.fail(e.code, e.message, { status: e.status, fields: e.fields });
      }
      // AuthError from @atlas/auth (status + message)
      if (e?.status === 401 || e?.status === 403) {
        return ctx.fail(
          e.status === 401 ? "unauthenticated" : "forbidden",
          e.message ?? (e.status === 401 ? "Chưa đăng nhập" : "Không có quyền"),
          { status: e.status },
        );
      }
      logger().error({ err: e, reqId, route: opts.name ?? req.url }, "api.unhandled");
      return ctx.fail("internal", "Có lỗi xảy ra. Vui lòng thử lại.", { status: 500 });
    }
  };
}
