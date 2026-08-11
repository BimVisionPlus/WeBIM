/**
 * Verify the Sentry wiring works end-to-end.
 *
 *   SENTRY_DSN=https://<key>@<host>/<project> pnpm exec tsx scripts/test-sentry.ts
 *
 * If SENTRY_DSN is set AND @sentry/node is installed, this should appear in
 * your Sentry dashboard within ~10s.
 *
 * If SENTRY_DSN is empty, it falls through to pino — you'll see a
 * "captured.exception" line in stdout and Sentry stays untouched.
 */

import { captureException, captureMessage } from "@atlas/lib";

async function main() {
  console.log(`SENTRY_DSN=${process.env.SENTRY_DSN ? "(set)" : "(empty — log fallback)"}`);

  captureMessage("atlas-aec.smoke.test.message", {
    by: "scripts/test-sentry.ts",
    at: new Date().toISOString(),
  });

  try {
    throw new Error("atlas-aec.smoke.test.exception — deliberately thrown by test-sentry");
  } catch (err) {
    captureException(err, { source: "scripts/test-sentry.ts" });
  }

  // Give Sentry's flush a beat
  await new Promise((r) => setTimeout(r, 1500));
  console.log("Done. Check your Sentry dashboard if DSN was set.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
