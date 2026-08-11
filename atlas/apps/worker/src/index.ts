/**
 * Atlas AEC — cron worker.
 *
 * Single Node process running scheduled tasks against the same DB / Redis the
 * web app uses. Designed to run as a sibling container (`docker compose --profile
 * worker up`) or a separate service in production.
 *
 * Tasks land in `src/jobs/*.ts` and are registered in the schedule below.
 *
 *   pnpm --filter @atlas/worker dev    # local dev with watch
 *   pnpm --filter @atlas/worker start  # production
 */

import { prisma } from "@atlas/db";
import { logger } from "@atlas/lib";
import { runScraper } from "./jobs/scrape-tenders";
import { warnExpiringBonds } from "./jobs/bond-expiry";
import { snapshotDrift } from "./jobs/drift-snapshot";

const log = logger();

type Job = {
  name: string;
  cron: string;          // human-readable hint; the actual scheduling is interval-based
  intervalMs: number;
  run: () => Promise<{ ok: boolean; note?: string }>;
};

const jobs: Job[] = [
  { name: "scrape-tenders",   cron: "0 7 * * *",       intervalMs: 24 * 60 * 60 * 1000, run: runScraper },
  { name: "bond-expiry-warn", cron: "0 8 * * *",       intervalMs: 24 * 60 * 60 * 1000, run: warnExpiringBonds },
  { name: "drift-snapshot",   cron: "0 * * * *",       intervalMs:      60 * 60 * 1000, run: snapshotDrift },
];

async function main() {
  log.info({ jobs: jobs.length }, "worker.start");

  for (const j of jobs) {
    // Fire once on boot (best-effort), then on interval
    runOne(j).catch((err) => log.error({ err, job: j.name }, "worker.boot_run_failed"));
    setInterval(() => {
      runOne(j).catch((err) => log.error({ err, job: j.name }, "worker.scheduled_run_failed"));
    }, j.intervalMs);
  }

  // Heartbeat
  setInterval(() => log.info({}, "worker.heartbeat"), 5 * 60 * 1000);
}

async function runOne(j: Job) {
  const t0 = Date.now();
  log.info({ job: j.name }, "worker.job_start");
  try {
    const r = await j.run();
    log.info({ job: j.name, ms: Date.now() - t0, ...r }, "worker.job_done");
  } catch (err) {
    log.error({ err, job: j.name, ms: Date.now() - t0 }, "worker.job_failed");
  }
}

main().catch((err) => {
  log.error({ err }, "worker.fatal");
  process.exit(1);
});

// Graceful shutdown so Postgres connections aren't orphaned.
async function shutdown() {
  log.info({}, "worker.shutdown");
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
