// WeBIM sync relay: a thin WebSocket fan-out for the element-level sync
// engine (web/src/sync/syncEngine.ts).
//
// The relay is deliberately dumb: it never inspects project payloads.
// Every frame from one socket is forwarded verbatim to every other
// socket; clients already filter by projectId and merge idempotently
// (state-based LWW), so duplicate or stale delivery is harmless. The
// only server-side smarts is presence hygiene: the first frame of a
// socket registers its clientId, and a synthetic "leave" is broadcast
// when that socket disconnects.
//
// Run: npm run relay   (defaults to port 8787, override with PORT)

import { WebSocketServer } from "ws";

export function startRelay(port = 8787) {
  const server = new WebSocketServer({ port });
  const clients = new Map(); // socket -> clientId | null

  server.on("connection", (socket) => {
    clients.set(socket, null);

    socket.on("message", (data) => {
      const text = data.toString();
      let clientId = null;
      try {
        clientId = JSON.parse(text).clientId ?? null;
      } catch {
        return; // drop malformed frames
      }
      if (clientId && clients.get(socket) === null) {
        clients.set(socket, clientId);
      }
      for (const [peer] of clients) {
        if (peer !== socket && peer.readyState === peer.OPEN) {
          peer.send(text);
        }
      }
    });

    socket.on("close", () => {
      const clientId = clients.get(socket);
      clients.delete(socket);
      if (!clientId) return;
      const leave = JSON.stringify({ type: "leave", clientId });
      for (const [peer] of clients) {
        if (peer.readyState === peer.OPEN) {
          peer.send(leave);
        }
      }
    });
  });

  return server;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  startRelay(port);
  console.log(`WeBIM sync relay listening on ws://0.0.0.0:${port}`);
}
