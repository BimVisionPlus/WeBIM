/**
 * GET /api/webim/projects — the project picker in WeBIM Web.
 *
 * Scoped to the key's own org so a WeBIM user never sees, or can publish into,
 * another tenant's projects.
 */

import { NextRequest } from "next/server";
import { prisma } from "@atlas/db";
import { rateLimitGuard } from "@atlas/lib";
import {
  bridgeError,
  bridgeJson,
  bridgePreflight,
  requireApiKey,
} from "@/lib/webim-bridge";

export async function OPTIONS(req: NextRequest) {
  return bridgePreflight(req);
}

export async function GET(req: NextRequest) {
  const limited = await rateLimitGuard(req, { name: "webim.projects" });
  if (limited) return limited;

  try {
    const key = await requireApiKey(req, "projects:read");
    const projects = await prisma.project.findMany({
      where: { ownerOrgId: key.orgId },
      select: { id: true, key: true, name: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return bridgeJson(req, { projects });
  } catch (err) {
    return bridgeError(req, err);
  }
}
