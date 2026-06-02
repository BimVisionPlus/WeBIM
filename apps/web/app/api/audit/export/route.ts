/**
 * GET /api/audit/export?format=csv&days=30&entity=Project&action=create&entityId=...
 *
 * Streams a CSV of audit events the caller can see. Same access rule as
 * /audit page (org membership ∪ project access ∪ own actions).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { rateLimitGuard } from "@atlas/lib";

function csvField(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "audit.export" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "30"), 1), 365);
    const entity = (url.searchParams.get("entity") ?? "").trim();
    const action = (url.searchParams.get("action") ?? "").trim();
    const entityId = (url.searchParams.get("entityId") ?? "").trim();

    const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
    const orgIds = memberships.map((m) => m.orgId);
    const projects = await prisma.project.findMany({
      where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);
    const since = new Date(Date.now() - days * 86400000);

    const events = await prisma.auditEvent.findMany({
      where: {
        createdAt: { gte: since },
        OR: [{ orgId: { in: orgIds } }, { projectId: { in: projectIds } }, { actorId: session.userId }],
        ...(entity ? { entityType: entity } : {}),
        ...(action ? { action: { contains: action } } : {}),
        ...(entityId ? { entityId } : {}),
      },
      include: { actor: { select: { name: true, email: true } }, org: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const header = ["timestamp_iso","actor_name","actor_email","action","entity_type","entity_id","org","project_id","ip","before","after"];
    const rows = events.map((e) => [
      e.createdAt.toISOString(),
      e.actor?.name ?? "",
      e.actor?.email ?? "",
      e.action,
      e.entityType,
      e.entityId ?? "",
      e.org?.slug ?? "",
      e.projectId ?? "",
      e.ip ?? "",
      e.before,
      e.after,
    ].map(csvField).join(","));

    const filename = `audit-${new Date().toISOString().slice(0,10)}${entity ? `-${entity}` : ""}${entityId ? `-${entityId.slice(-8)}` : ""}.csv`;
    const csv = "﻿" + header.join(",") + "\n" + rows.join("\n") + "\n"; // BOM for Excel

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
