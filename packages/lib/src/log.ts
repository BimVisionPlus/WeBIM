/**
 * Structured logger. Pino in production, pretty console in dev.
 * Falls back to `console.*` if pino isn't installed so the lib stays usable
 * before deps land.
 */

type Level = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type Logger = {
  trace: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  fatal: (obj: unknown, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function makeFallback(prefix: Record<string, unknown> = {}): Logger {
  const emit = (level: Level) => (obj: unknown, msg?: string) => {
    if (typeof obj === "string" && msg === undefined) {
      msg = obj;
      obj = {};
    }
    const line = { level, ...prefix, ...(typeof obj === "object" && obj !== null ? obj : { obj }), msg };
    const fn = level === "error" || level === "fatal" ? console.error : level === "warn" ? console.warn : console.log;
    fn(JSON.stringify(line));
  };
  return {
    trace: emit("trace"),
    debug: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
    fatal: emit("fatal"),
    child: (b) => makeFallback({ ...prefix, ...b }),
  };
}

let _log: Logger | null = null;

export function logger(): Logger {
  if (_log) return _log;
  try {
    // pino is optional — works without it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pino = require("pino");
    const isDev = process.env.NODE_ENV !== "production";
    _log = pino({
      level: process.env.LOG_LEVEL ?? "info",
      ...(isDev
        ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }
        : {}),
      base: { app: "atlas-aec" },
      redact: ["req.headers.authorization", "req.headers.cookie", "password", "token", "tokenHash"],
    });
    return _log!;
  } catch {
    _log = makeFallback();
    return _log;
  }
}
