/**
 * GitHub Actions cron wrapper for drift-snapshot job.
 *
 *   tsx scripts/cron-drift-snapshot.ts
 */
import { snapshotDrift } from "../apps/worker/src/jobs/drift-snapshot";

(async () => {
  const r = await snapshotDrift();
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
})();
