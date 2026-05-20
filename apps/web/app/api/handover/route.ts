/**
 * GET  /api/handover?projectId=...    — list tickets
 * POST /api/handover                    — file a warranty ticket
 *
 * Public-friendly endpoint: residents/CĐT can file tickets without an Atlas
 * user account (we capture name/phone/email instead). State machine drives SLA.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  unitCode: z.string().max(40).optional(),
  category: z.enum([
    "THAM_DOT", "NUT_TUONG", "DIEN_GIAT", "CAP_THOAT_NUOC", "HVAC",
    "SON_HOAN_THIEN", "CUA_KHOA", "AN_NINH", "KHAC",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
  title: z.string().min(2).max(300),
  description: z.string().min(5).max(5000),
  reporterName: z.string().min(2).max(120),
  reporterPhone: z.string().max(40).optional(),
  reporterEmail: z.string().email().optional(),
  warrantyType: z.enum(["PHAN_PHU", "PHAN_CHINH", "HA_TANG"]).default("PHAN_CHINH"),
});

// SLA windows by severity
const SLA_HOURS: Record<string, number> = { LOW: 168, MEDIUM: 72, HIGH: 24, CRITICAL: 4 };

// Warranty months by type (NĐ 06/2021)
const WARRANTY_MONTHS: Record<string, number> = { PHAN_PHU: 12, PHAN_CHINH: 24, HA_TANG: 60 };

async function nextTicketNumber(projectKey: string): Promise<string> {
  const count = await prisma.handoverTicket.count();
  return `HG-${projectKey}-${String(count + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const tickets = await prisma.handoverTicket.findMany({
      where: { projectId },
      orderBy: [{ state: "asc" }, { slaDueAt: "asc" }],
      take: 200,
    });
    return NextResponse.json({ tickets });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "handover.create", max: 30, windowSec: 600 });
  if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const project = await prisma.project.findUnique({ where: { id: d.projectId } });
    if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

    const slaHours = SLA_HOURS[d.severity] ?? 72;
    const months = WARRANTY_MONTHS[d.warrantyType] ?? 24;

    // Compute warrantyEndsAt from project end date (or now if missing)
    const baseDate = project.endDate ?? new Date();
    const warrantyEndsAt = new Date(baseDate.getTime() + months * 30 * 86_400_000);

    const ticket = await prisma.handoverTicket.create({
      data: {
        projectId: d.projectId,
        ticketNumber: await nextTicketNumber(project.key),
        unitCode: d.unitCode,
        category: d.category,
        severity: d.severity,
        title: d.title,
        description: d.description,
        reporterName: d.reporterName,
        reporterPhone: d.reporterPhone,
        reporterEmail: d.reporterEmail,
        warrantyType: d.warrantyType,
        warrantyEndsAt,
        slaDueAt: new Date(Date.now() + slaHours * 60 * 60 * 1000),
      },
    });

    await audit({
      action: "handover.create",
      entityType: "HandoverTicket",
      entityId: ticket.id,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { ticketNumber: ticket.ticketNumber, category: ticket.category, severity: ticket.severity },
    });
    return NextResponse.json({ ticket });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
