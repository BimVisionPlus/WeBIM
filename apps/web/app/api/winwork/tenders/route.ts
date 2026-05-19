import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  source: z.enum(["MUASAMCONG", "DAUTHAU_ASIA", "BAO_DAU_THAU", "MANUAL", "OTHER"]).default("MANUAL"),
  sourceUrl: z.string().url().optional(),
  sourceRef: z.string().max(80).optional(),
  title: z.string().min(2).max(300),
  invitor: z.string().max(200).optional(),
  invitorMst: z.string().max(20).optional(),
  budgetVnd: z.coerce.bigint().optional(),
  fundingSource: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  province: z.string().max(60).optional(),
  district: z.string().max(60).optional(),
  publishedAt: z.string().optional(),
  closingAt: z.string().optional(),
  openingAt: z.string().optional(),
  bidMethod: z.string().max(80).optional(),
  bidForm: z.string().max(20).optional(),
  contractType: z.string().max(80).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const province = url.searchParams.get("province") ?? undefined;
    const source = url.searchParams.get("source") ?? undefined;
    const days = Math.min(Number(url.searchParams.get("days") ?? "30"), 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const tenders = await prisma.tenderOpportunity.findMany({
      where: {
        scrapedAt: { gte: since },
        ...(province ? { province } : {}),
        ...(source ? { source: source as any } : {}),
      },
      orderBy: [{ closingAt: "asc" }, { scrapedAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({
      tenders: tenders.map((t) => ({
        ...t,
        budgetVnd: t.budgetVnd?.toString() ?? null,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {

  const __rl = await rateLimitGuard(req, { name: "winwork.tenders" });
  if (__rl) return __rl;
try {
    // Two auth modes: NextAuth session (user UI) OR x-scrape-secret (Python scraper sidecar).
    let actorUserId: string | null = null;
    const scrapeSecret = req.headers.get("x-scrape-secret");
    if (scrapeSecret && process.env.WINWORK_SCRAPE_SECRET && scrapeSecret === process.env.WINWORK_SCRAPE_SECRET) {
      // Service-to-service — no user, audit as null actor
      actorUserId = null;
    } else {
      const session = await requireSession();
      actorUserId = session.userId;
    }
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    // Compose a content hash so manual entries de-dupe too
    const { createHash } = await import("node:crypto");
    const rawHash = createHash("sha256")
      .update([d.source, d.sourceRef ?? "", d.title.trim().toLowerCase(), d.invitorMst ?? "", d.budgetVnd?.toString() ?? "", d.closingAt ?? ""].join("|"))
      .digest("hex");

    const existing = await prisma.tenderOpportunity.findUnique({ where: { rawHash } });
    if (existing) {
      return NextResponse.json({
        tender: { ...existing, budgetVnd: existing.budgetVnd?.toString() ?? null },
        duplicate: true,
      });
    }

    const tender = await prisma.tenderOpportunity.create({
      data: {
        source: d.source,
        sourceUrl: d.sourceUrl,
        sourceRef: d.sourceRef,
        title: d.title,
        invitor: d.invitor,
        invitorMst: d.invitorMst,
        budgetVnd: d.budgetVnd,
        fundingSource: d.fundingSource,
        category: d.category,
        province: d.province,
        district: d.district,
        publishedAt: d.publishedAt ? new Date(d.publishedAt) : undefined,
        closingAt: d.closingAt ? new Date(d.closingAt) : undefined,
        openingAt: d.openingAt ? new Date(d.openingAt) : undefined,
        bidMethod: d.bidMethod,
        bidForm: d.bidForm,
        contractType: d.contractType,
        rawHash,
      },
    });

    await audit({
      action: "tender.create",
      entityType: "TenderOpportunity",
      entityId: tender.id,
      actorId: actorUserId,
      ...reqMeta(req),
      after: { title: tender.title, source: tender.source, by: actorUserId ? "user" : "scraper" },
    });

    return NextResponse.json({
      tender: { ...tender, budgetVnd: tender.budgetVnd?.toString() ?? null },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
