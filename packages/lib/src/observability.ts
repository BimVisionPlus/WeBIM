/**
 * Observability scaffold — Sentry without requiring it as a hard dependency.
 *
 * If SENTRY_DSN is set AND the @sentry/node package is installed at runtime,
 * we initialize it once and forward errors. Otherwise we fall back to the pino
 * logger so the app never crashes due to missing Sentry.
 *
 * Usage (anywhere):
 *   import { captureException } from "@atlas/lib";
 *   try { ... } catch (e) { captureException(e, { route: "rfi.create" }); }
 */

import { logger } from "./log";

let sentry: any = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sentry = require("@sentry/node");
    sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    });
    logger().info({}, "observability.sentry.initialized");
  } catch (err) {
    logger().warn({ err }, "observability.sentry.module_missing");
    sentry = null;
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  init();
  if (sentry) {
    try {
      sentry.captureException(err, { extra: context });
      return;
    } catch {
      /* fall through */
    }
  }
  logger().error({ err, ...context }, "captured.exception");
}

export function captureMessage(msg: string, context?: Record<string, unknown>) {
  init();
  if (sentry) {
    try {
      sentry.captureMessage(msg, { extra: context });
      return;
    } catch {
      /* fall through */
    }
  }
  logger().info({ ...context }, msg);
}
