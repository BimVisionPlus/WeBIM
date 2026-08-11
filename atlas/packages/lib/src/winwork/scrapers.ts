/**
 * Tender opportunity scrapers — WinWork module.
 *
 * Each source implements `fetchOpportunities()` returning a normalized
 * `ScrapedOpportunity[]`. The orchestrator de-dupes by `rawHash` (sha256
 * of the canonical fields) so re-running the cron is idempotent.
 *
 * Design notes:
 *   - These adapters are intentionally NOT calling out to the real sources
 *     yet. Production deployment wires them up with rotating proxies + a
 *     selenium / playwright worker; that's outside this PR. The contract
 *     here is the data shape the rest of the platform builds against.
 *   - To wire production scraping: set `WINWORK_SCRAPER_<SOURCE>_URL` and
 *     replace each `// TODO: live fetch` with the real call. The hashing
 *     and persistence path won't change.
 */

import { createHash } from "node:crypto";

export type ScrapedOpportunity = {
  source: "MUASAMCONG" | "DAUTHAU_ASIA" | "BAO_DAU_THAU" | "MANUAL" | "OTHER";
  sourceUrl?: string;
  sourceRef?: string;
  title: string;
  invitor?: string;
  invitorMst?: string;
  budgetVnd?: bigint;
  fundingSource?: string;
  category?: string;
  province?: string;
  district?: string;
  publishedAt?: Date;
  closingAt?: Date;
  openingAt?: Date;
  bidMethod?: string;
  bidForm?: string;
  contractType?: string;
  raw?: Record<string, unknown>;
};

/** Stable content hash to de-dupe across re-scrapes. */
export function hashOpportunity(o: ScrapedOpportunity): string {
  const key = [
    o.source,
    o.sourceRef ?? "",
    o.title.trim().toLowerCase(),
    o.invitorMst ?? "",
    o.budgetVnd?.toString() ?? "",
    o.closingAt?.toISOString() ?? "",
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

export interface TenderScraper {
  readonly id: ScrapedOpportunity["source"];
  fetch(): Promise<ScrapedOpportunity[]>;
}

// ─── muasamcong.mpi.gov.vn — official MPI portal ────────────────────────────
export const muasamcongScraper: TenderScraper = {
  id: "MUASAMCONG",
  async fetch() {
    // TODO: live HTTP fetch + DOM parse. Schema reference:
    //   https://muasamcong.mpi.gov.vn/ (Thông báo mời thầu)
    // For now, return zero items — sets up the persistence path so the
    // first real fetch result lands without code changes.
    return [];
  },
};

// ─── dauthau.asia — private aggregator ──────────────────────────────────────
export const dauthauAsiaScraper: TenderScraper = {
  id: "DAUTHAU_ASIA",
  async fetch() {
    // TODO: live fetch from API or HTML.
    return [];
  },
};

// ─── báo đấu thầu — PDF source ──────────────────────────────────────────────
export const baoDauThauScraper: TenderScraper = {
  id: "BAO_DAU_THAU",
  async fetch() {
    // TODO: PDF fetch + parsing (Surya/docTR via @atlas/ai).
    return [];
  },
};

export const ALL_SCRAPERS: TenderScraper[] = [
  muasamcongScraper,
  dauthauAsiaScraper,
  baoDauThauScraper,
];

/**
 * Run every registered scraper and return a flat de-duped list keyed by hash.
 * Failures are isolated per source: one source going down doesn't stop the others.
 */
export async function runAllScrapers(): Promise<{
  items: Array<ScrapedOpportunity & { hash: string }>;
  errors: Array<{ source: string; message: string }>;
}> {
  const items: Array<ScrapedOpportunity & { hash: string }> = [];
  const errors: Array<{ source: string; message: string }> = [];
  const seen = new Set<string>();

  for (const scraper of ALL_SCRAPERS) {
    try {
      const raw = await scraper.fetch();
      for (const o of raw) {
        const hash = hashOpportunity(o);
        if (seen.has(hash)) continue;
        seen.add(hash);
        items.push({ ...o, hash });
      }
    } catch (e: any) {
      errors.push({ source: scraper.id, message: e?.message ?? "unknown error" });
    }
  }
  return { items, errors };
}
