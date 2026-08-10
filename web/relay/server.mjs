// WeBIM platform server: sync relay (WebSocket) + CDE file storage (HTTP)
// + auth/roles + AI drawing reader.
//
// The relay half is deliberately dumb: it never inspects project
// payloads. Every frame from one socket is forwarded verbatim to every
// other socket; clients already filter by projectId and merge
// idempotently (state-based LWW). Server-side smarts are limited to
// presence hygiene (synthetic "leave" on disconnect) and authorization
// (viewer clients' model-sync frames are dropped; presence passes).
//
// Storage is a swappable adapter (relay/storage.mjs): local disk by
// default, any S3-compatible endpoint via env (BYO storage). Document
// metadata lives in the synced project itself.
//
// Auth (relay/auth.mjs): token login against relay/users.json with
// admin/editor/viewer roles; absent users.json = open dev mode.
//
// AI (POST /ai/read-drawing): reads a stored PDF and answers a question
// about it with Claude. Requires ANTHROPIC_API_KEY; otherwise 501.
//
// Run: npm run relay   (defaults to port 8787, override with PORT)

import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createAuth } from "./auth.mjs";
import { createStorage } from "./storage.mjs";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

function safeKey(key) {
  const decoded = decodeURIComponent(key);
  if (decoded.includes("..") || decoded.startsWith("/")) return null;
  return decoded;
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extra,
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function answerDrawingQuestion(storage, key, question) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const pdf = await storage.get(key);
  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "Bạn là kỹ sư xây dựng đọc bản vẽ kỹ thuật. Trả lời ngắn gọn, chính xác," +
      " bằng ngôn ngữ của câu hỏi. Nếu bản vẽ không đủ thông tin, nói rõ điều đó" +
      " thay vì suy đoán. Khi trích số liệu, nêu vị trí trên bản vẽ nếu xác định được.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf.toString("base64"),
            },
          },
          { type: "text", text: question },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function writeRenderBrief(image, style) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const base64 = image.replace(/^data:image\/png;base64,/, "");
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            brief_vi: {
              type: "string",
              description:
                "Kịch bản render tiếng Việt: vật liệu, ánh sáng, bối cảnh, góc máy — bám hình khối trong ảnh",
            },
            prompt_en: {
              type: "string",
              description:
                "One-paragraph English image-generation prompt for the same concept (photorealistic architectural render)",
            },
          },
          required: ["brief_vi", "prompt_en"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: base64 },
          },
          {
            type: "text",
            text:
              "Đây là ảnh chụp khối mô hình BIM (massing) của một công trình. " +
              `Phong cách mong muốn: ${style}. Viết kịch bản render concept bám đúng ` +
              "hình khối này (không bịa thêm khối mới) và một prompt tiếng Anh cho " +
              "công cụ sinh ảnh.",
          },
        ],
      },
    ],
  });
  const text = response.content.find((block) => block.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

async function renderWithStability(image, prompt) {
  const base64 = image.replace(/^data:image\/png;base64,/, "");
  const form = new FormData();
  form.append(
    "image",
    new Blob([Buffer.from(base64, "base64")], { type: "image/png" }),
    "model.png",
  );
  form.append("prompt", prompt);
  form.append("control_strength", "0.7");
  form.append("output_format", "png");
  const response = await fetch(
    "https://api.stability.ai/v2beta/stable-image/control/sketch",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
        Accept: "image/*",
      },
      body: form,
    },
  );
  if (!response.ok) {
    throw new Error(`Stability ${response.status}: ${await response.text()}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export function startRelay(port = 8787, options = {}) {
  const auth = options.auth ?? createAuth();
  const storage = options.storage ?? createStorage(DATA_DIR);
  if (!auth.enabled) {
    console.warn(
      "[webim] auth OPEN mode — create relay/users.json to require login " +
        "(node relay/auth.mjs hash <password>)",
    );
  }

  const identityOf = (request) => {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    return auth.verify(token);
  };

  const httpServer = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const reply = (status, body, type = "application/json") => {
      response.writeHead(status, corsHeaders({ "Content-Type": type }));
      response.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }
    try {
      if (url.pathname === "/health") {
        return reply(200, { ok: true, storage: storage.kind, auth: auth.enabled });
      }
      if (url.pathname === "/auth/mode") {
        return reply(200, { enabled: auth.enabled });
      }
      if (url.pathname === "/auth/login" && request.method === "POST") {
        const { username, password } = JSON.parse((await readBody(request)).toString());
        const session = auth.login(username, password);
        return session ? reply(200, session) : reply(401, { error: "invalid credentials" });
      }

      const identity = identityOf(request);

      if (url.pathname.startsWith("/files/")) {
        const key = safeKey(url.pathname.slice("/files/".length));
        if (!key) return reply(400, { error: "bad key" });
        if (request.method === "PUT") {
          if (!auth.allows(identity, "editor")) {
            return reply(identity ? 403 : 401, { error: "editor role required" });
          }
          await storage.put(key, await readBody(request));
          return reply(200, { ok: true, key });
        }
        if (request.method === "GET") {
          if (!auth.allows(identity, "viewer")) {
            return reply(401, { error: "login required" });
          }
          const body = await storage.get(key);
          response.writeHead(200, corsHeaders({ "Content-Type": "application/octet-stream" }));
          response.end(body);
          return;
        }
      }

      if (url.pathname === "/list" && request.method === "GET") {
        if (!auth.allows(identity, "viewer")) {
          return reply(401, { error: "login required" });
        }
        const prefix = safeKey(url.searchParams.get("prefix") ?? "") ?? "";
        return reply(200, { files: await storage.list(prefix) });
      }

      if (url.pathname === "/ai/read-drawing" && request.method === "POST") {
        if (!auth.allows(identity, "editor")) {
          return reply(identity ? 403 : 401, { error: "editor role required" });
        }
        if (!process.env.ANTHROPIC_API_KEY) {
          return reply(501, {
            error:
              "AI chưa cấu hình — đặt ANTHROPIC_API_KEY trên platform server để bật đọc bản vẽ.",
          });
        }
        const { key, question } = JSON.parse((await readBody(request)).toString());
        const cleanKey = safeKey(key ?? "");
        if (!cleanKey || !question?.trim()) {
          return reply(400, { error: "key and question required" });
        }
        const answer = await answerDrawingQuestion(storage, cleanKey, question.trim());
        return reply(200, { answer });
      }

      if (url.pathname === "/ai/render-concept" && request.method === "POST") {
        if (!auth.allows(identity, "editor")) {
          return reply(identity ? 403 : 401, { error: "editor role required" });
        }
        if (!process.env.ANTHROPIC_API_KEY) {
          return reply(501, {
            error:
              "AI chưa cấu hình — đặt ANTHROPIC_API_KEY để viết kịch bản render " +
              "(thêm STABILITY_API_KEY nếu muốn sinh ảnh thật).",
          });
        }
        const { image, style } = JSON.parse((await readBody(request)).toString());
        if (!image?.startsWith("data:image/png;base64,") || !style?.trim()) {
          return reply(400, { error: "image (png data URL) and style required" });
        }
        const brief = await writeRenderBrief(image, style.trim());
        let rendered = null;
        if (process.env.STABILITY_API_KEY) {
          rendered = await renderWithStability(image, brief.prompt_en);
        }
        return reply(200, { ...brief, image: rendered });
      }

      reply(404, { error: "not found" });
    } catch (error) {
      reply(error.code === "ENOENT" ? 404 : 500, {
        error: String(error.message ?? error),
      });
    }
  });

  const server = new WebSocketServer({ server: httpServer });
  const clients = new Map(); // socket -> {clientId, role}

  server.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const identity = auth.verify(url.searchParams.get("token"));
    if (!identity) {
      socket.close(4401, "login required");
      return;
    }
    clients.set(socket, { clientId: null, role: identity.role });

    socket.on("message", (data) => {
      const text = data.toString();
      let frame;
      try {
        frame = JSON.parse(text);
      } catch {
        return; // drop malformed frames
      }
      const state = clients.get(socket);
      if (frame.clientId && state.clientId === null) {
        state.clientId = frame.clientId;
      }
      // Authorization: viewers may broadcast presence, never model state.
      if (frame.type === "sync" && state.role === "viewer") return;
      for (const [peer] of clients) {
        if (peer !== socket && peer.readyState === peer.OPEN) {
          peer.send(text);
        }
      }
    });

    socket.on("close", () => {
      const state = clients.get(socket);
      clients.delete(socket);
      if (!state?.clientId) return;
      const leave = JSON.stringify({ type: "leave", clientId: state.clientId });
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
    `WeBIM platform server on :${port} — ws relay + /files storage + /auth + /ai`,
  );
}
