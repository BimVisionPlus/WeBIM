// WeBIM platform server: sync relay (WebSocket) + CDE file storage (HTTP).
//
// The relay half is deliberately dumb: it never inspects project
// payloads. Every frame from one socket is forwarded verbatim to every
// other socket; clients already filter by projectId and merge
// idempotently (state-based LWW). The only server-side smarts is
// presence hygiene: a synthetic "leave" is broadcast when a socket
// whose clientId was registered disconnects.
//
// The HTTP half is one storage adapter behind the CDE: PUT/GET/LIST of
// opaque blobs under ./data. Document metadata (ISO 19650 codes,
// statuses, revisions, audit) lives in the synced project itself — this
// server can be swapped for S3-compatible/BYO storage without touching
// the client's CDE model.
//
// Run: npm run relay   (defaults to port 8787, override with PORT)

import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

function safeKeyToPath(key) {
  const decoded = decodeURIComponent(key);
  if (decoded.includes("..") || decoded.startsWith("/")) return null;
  return join(DATA_DIR, normalize(decoded));
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra,
  };
}

export function startRelay(port = 8787) {
  const httpServer = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }
    try {
      if (url.pathname === "/health") {
        response.writeHead(200, corsHeaders({ "Content-Type": "application/json" }));
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      if (url.pathname.startsWith("/files/")) {
        const key = url.pathname.slice("/files/".length);
        const filePath = safeKeyToPath(key);
        if (!filePath) {
          response.writeHead(400, corsHeaders());
          response.end("bad key");
          return;
        }
        if (request.method === "PUT") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, Buffer.concat(chunks));
          response.writeHead(200, corsHeaders({ "Content-Type": "application/json" }));
          response.end(JSON.stringify({ ok: true, key: decodeURIComponent(key) }));
          return;
        }
        if (request.method === "GET") {
          const body = await readFile(filePath);
          response.writeHead(200, corsHeaders({ "Content-Type": "application/octet-stream" }));
          response.end(body);
          return;
        }
      }
      if (url.pathname === "/list" && request.method === "GET") {
        const prefix = url.searchParams.get("prefix") ?? "";
        const root = safeKeyToPath(prefix) ?? DATA_DIR;
        const entries = [];
        const walk = async (directory, relative) => {
          let names = [];
          try {
            names = await readdir(directory);
          } catch {
            return;
          }
          for (const name of names) {
            const full = join(directory, name);
            const info = await stat(full);
            if (info.isDirectory()) {
              await walk(full, `${relative}${name}/`);
            } else {
              entries.push({ key: `${relative}${name}`, size: info.size });
            }
          }
        };
        await walk(root, prefix ? `${decodeURIComponent(prefix)}/` : "");
        response.writeHead(200, corsHeaders({ "Content-Type": "application/json" }));
        response.end(JSON.stringify({ files: entries }));
        return;
      }
      response.writeHead(404, corsHeaders());
      response.end("not found");
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, corsHeaders());
      response.end(String(error.message ?? error));
    }
  });

  const server = new WebSocketServer({ server: httpServer });
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

  httpServer.listen(port);
  server.httpServer = httpServer;
  const originalClose = server.close.bind(server);
  server.close = (callback) => {
    originalClose(() => httpServer.close(callback));
  };
  return server;
}

const isMain =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  startRelay(port);
  console.log(
    `WeBIM platform server on :${port} — ws relay + /files file storage`,
  );
}
