/**
 * GitHub Actions cron wrapper for bond-expiry job.
 *
 *   tsx scripts/cron-bond-expiry.ts
 *
 * Exits non-zero on failure so GH Actions marks the run red.
 */
import { warnExpiringBonds } from "../apps/worker/src/jobs/bond-expiry";

(async () => {
  const r = await warnExpiringBonds();
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
})();
