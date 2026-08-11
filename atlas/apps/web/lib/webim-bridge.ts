/**
 * WeBIM → Atlas bridge: authentication, CORS and project scoping for the
 * `/api/webim/*` routes.
 *
 * WeBIM Web is a separate Vite app served from its own origin, so it cannot
 * ride the Auth.js session cookie the rest of the API depends on. It presents
 * an org-scoped `ApiKey` instead — the model has been in the schema since the
 * integration layer was drafted but had no reader until this bridge.
 *
 * Only the SHA-256 of the secret is stored; the plaintext exists once, in the
 * output of `scripts/webim-issue-key.ts`.
 */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@atlas/db";

/** Scopes a WeBIM key can hold. Space-separated in the DB, array in the app. */
export const BRIDGE_SCOPES = ["projects:read", "models:write"] as const;
export type BridgeScope = (typeof BRIDGE_SCOPES)[number];

export class BridgeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Vite's dev server, both ports WeBIM Web uses. Production origins come from
// the env var — a wildcard is accepted but has to be asked for explicitly.
const DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:5174"];

export function allowedOrigins(): string[] {
  const raw = process.env.WEBIM_ALLOWED_ORIGINS;
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Max-Age": "600",
    // The response body differs per origin, so it must not be cached flat.
    Vary: "Origin",
  };
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();
  if (origin && (allowed.includes("*") || allowed.includes(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Preflight response — every bridge route exports this as its OPTIONS. */
export function bridgePreflight(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export function bridgeJson(
  req: Request,
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body as any, {
    status: init?.status ?? 200,
    headers: corsHeaders(req),
  });
}

/** Maps a thrown BridgeError (or anything else) onto a CORS-bearing response. */
export function bridgeError(req: Request, err: unknown): NextResponse {
  const status = err instanceof BridgeError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Lỗi không xác định";
  return bridgeJson(req, { error: message }, { status });
}

export interface BridgeKey {
  id: string;
  orgId: string;
  name: string;
  scopes: string[];
  /** Who issued the key — the actor recorded on anything it writes. */
  createdByUserId: string | null;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Authenticate `Authorization: Bearer <secret>` and assert one scope.
 *
 * Revoked and expired keys are rejected before the scope check so a stale key
 * always reports the same reason regardless of what it was asking for.
 */
export async function requireApiKey(req: Request, scope: BridgeScope): Promise<BridgeKey> {
  const header = req.headers.get("authorization") ?? "";
  const secret = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
  if (!secret) {
    throw new BridgeError(401, "Thiếu API key (Authorization: Bearer …)");
  }

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashSecret(secret) },
  });
  if (!key) throw new BridgeError(401, "API key không hợp lệ");
  if (key.revokedAt) throw new BridgeError(401, "API key đã bị thu hồi");
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
    throw new BridgeError(401, "API key đã hết hạn");
  }
  if (!key.scopes.includes(scope)) {
    throw new BridgeError(403, `API key thiếu quyền ${scope}`);
  }

  // Best-effort: a failed touch must not fail the request it was recording.
  await prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    id: key.id,
    orgId: key.orgId,
    name: key.name,
    scopes: key.scopes,
    createdByUserId: key.createdByUserId,
  };
}

/**
 * A key may only touch projects owned by its own org. Returns the fields the
 * bridge needs downstream (`key` is the S3 path prefix).
 */
export async function requireProjectInOrg(projectId: string, orgId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, key: true, name: true, ownerOrgId: true },
  });
  if (!project || project.ownerOrgId !== orgId) {
    // Deliberately the same answer for "does not exist" and "not yours" —
    // otherwise the bridge enumerates project ids across orgs.
    throw new BridgeError(404, "Không tìm thấy dự án");
  }
  return project;
}
