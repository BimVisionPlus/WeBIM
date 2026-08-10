// Where the platform server (files + auth + AI + ws relay) lives.
//
// - Dev (vite on 5173/5174): a separately-run relay on :8787.
// - Production (built app served behind the reverse proxy): same-origin
//   under /api — deploy/Caddyfile terminates HTTPS and proxies /api/*
//   (WebSocket included) to the relay, so no CORS and wss for free.
// - Override either with VITE_API_BASE at build time.

const DEV_PORTS = new Set(["5173", "5174"]);

export function apiBase(): string {
  const override = import.meta.env.VITE_API_BASE as string | undefined;
  if (override) return override.replace(/\/$/, "");
  if (DEV_PORTS.has(window.location.port)) {
    return `http://${window.location.hostname}:8787`;
  }
  return `${window.location.origin}/api`;
}

/** WebSocket base for the sync relay (ws:// in dev, wss:// behind TLS). */
export function relayBase(): string {
  return apiBase().replace(/^http/, "ws");
}
