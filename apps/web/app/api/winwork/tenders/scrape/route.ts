/**
 * POST /api/winwork/tenders/scrape — run every registered scraper, persist new opportunities.
 *
 * Designed to be invoked by:
 *   - A daily cron (e.g. GitHub Actions / Vercel Cron / docker-compose cron sidecar)
 *   - A super-admin manually from the WinWork UI
 *
 * Idempotent via TenderOpportunity.rawHash uniqueness — re-running pulls only deltas.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { runAllScrapers, audit, reqMeta, rateLimitGuard } from "@atlas/lib";

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "winwork.tenders.scrape" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    if (!session.isSuperAdmin) {
      // Allow non-admin trigger only if a shared scrape secret is provided
      const headerSecret = req.headers.get("x-scrape-secret");
      if (!headerSecret || headerSecret !== process.env.WINWORK_SCRAPE_SECRET) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const { items, errors } = await runAllScrapers();

    let created = 0;
    let skipped = 0;
    for (const it of items) {
      try {
        await prisma.tenderOpportunity.create({
          data: {
            source: it.source,
            sourceUrl: it.sourceUrl,
            sourceRef: it.sourceRef,
            title: it.title,
            invitor: it.invitor,
            invitorMst: it.invitorMst,
            budgetVnd: it.budgetVnd,
            fundingSource: it.fundingSource,
            category: it.category,
            province: it.province,
            district: it.district,
            publishedAt: it.publishedAt,
            closingAt: it.closingAt,
            openingAt: it.openingAt,
            bidMethod: it.bidMethod,
            bidForm: it.bidForm,
            contractType: it.contractType,
            rawHash: it.hash,
            rawJson: it.raw as any,
          },
        });
        created++;
      } catch (e: any) {
        // Most likely a unique-constraint clash on rawHash → already in DB
        if (e?.code === "P2002") {
          skipped++;
        } else {
          errors.push({ source: it.source, message: e?.message ?? "insert failed" });
        }
      }
    }

    await audit({
      action: "tender.scrape",
      entityType: "TenderOpportunity",
      actorId: session.userId,
      ...reqMeta(req),
      after: { created, skipped, errors: errors.length },
    });

    return NextResponse.json({ created, skipped, errors });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
