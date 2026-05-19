/**
 * Run every registered tender scraper and persist new opportunities.
 * Idempotent via TenderOpportunity.rawHash.
 */

import { prisma } from "@atlas/db";
import { runAllScrapers } from "@atlas/lib";

export async function runScraper() {
  const { items, errors } = await runAllScrapers();
  let created = 0, skipped = 0;
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
      if (e?.code === "P2002") skipped++;
      else errors.push({ source: it.source, message: e?.message ?? "insert failed" });
    }
  }
  return { ok: true, note: `created=${created} skipped=${skipped} errors=${errors.length}` };
}
