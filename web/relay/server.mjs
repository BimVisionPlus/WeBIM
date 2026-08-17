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
// AI (relay/ai.mjs): self-hosted only — an OpenAI-compatible model server
// (Ollama/vLLM/llama.cpp) at AI_BASE_URL for text+vision, and an
// AUTOMATIC1111-compatible Stable Diffusion at SD_BASE_URL for img2img.
// Nothing runs against a closed API; unset AI_BASE_URL answers 501.
//
// Run: npm run relay   (defaults to port 8787, override with PORT)

import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import {
  aiConfig,
  aiEnabled,
  answerDrawingQuestion,
  imageRenderEnabled,
  renderConcept,
  writeRenderBrief,
} from "./ai.mjs";
import { createAuth } from "./auth.mjs";
import { createMembers } from "./members.mjs";
import { createStorage } from "./storage.mjs";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

const AI_NOT_CONFIGURED =
  "AI chưa cấu hình — chạy một model server tự host (Ollama/vLLM/llama.cpp) " +
  "rồi đặt AI_BASE_URL (vd http://127.0.0.1:11434/v1) và AI_MODEL " +
  "(vd qwen2.5vl:7b). Thêm SD_BASE_URL trỏ tới Stable Diffusion tự host nếu " +
  "muốn sinh ảnh thật.";

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

export function startRelay(port = 8787, options = {}) {
  const auth = options.auth ?? createAuth();
  const storage = options.storage ?? createStorage(DATA_DIR);
  const members = options.members ?? createMembers();
  if (!auth.enabled) {
    console.warn(
      "[webim] auth OPEN mode — create relay/users.json to require login " +
        "(node relay/auth.mjs hash <password>)",
    );
  }

  // Nói ra trạng thái AI ngay lúc khởi động.
  //
  // Không có dòng này thì một tiến trình cũ còn sống trông y hệt một tiến
  // trình mới: cùng cổng, cùng /health "ok". Nó đã khiến một thông điệp lỗi
  // bị xoá từ nhiều ngày trước vẫn hiện ra, và mất hai vòng chẩn đoán mới
  // tìm ra thủ phạm là chính cái tiến trình đang chạy.
  {
    const ai = aiConfig();
    console.log(
      aiEnabled(ai)
        ? `[webim] AI: ${ai.model} @ ${ai.baseUrl}` +
            (ai.sdBaseUrl ? ` · Stable Diffusion @ ${ai.sdBaseUrl}` : " · chưa có SD (chỉ brief chữ)")
        : "[webim] AI: tắt — đặt AI_BASE_URL + AI_MODEL trỏ tới model server tự host",
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
        const config = aiConfig();
        return reply(200, {
          ok: true,
          storage: storage.kind,
          auth: auth.enabled,
          ai: aiEnabled(config) ? config.model : null,
          imageRender: imageRenderEnabled(config),
        });
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

      /**
       * Cùng một câu "editor role required" từng được trả cho cả hai trường
       * hợp, kể cả 401. Người chưa đăng nhập bị nói là thiếu *quyền* — họ đi
       * tìm ai cấp quyền cho mình, trong khi việc phải làm là bấm Đăng nhập.
       * Mã HTTP đã phân biệt hai thứ đó rồi; câu chữ phải nói theo.
       */
      const needsEditor = () =>
        identity
          ? reply(403, {
              error: `Cần quyền editor trở lên — tài khoản này là ${identity.role}.`,
            })
          : reply(401, { error: "Cần đăng nhập để dùng chức năng này." });

      // ── Thành viên & phân quyền theo dự án ────────────────────────────
      const membersMatch = url.pathname.match(
        /^\/projects\/([^/]+)\/members(?:\/([^/]+))?$/,
      );
      if (membersMatch) {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const projectId = decodeURIComponent(membersMatch[1]);
        try {
          if (request.method === "GET") {
            const record = members.get(projectId);
            const you = members.effectiveRole(identity, projectId);
            return reply(200, {
              registered: record !== null,
              owner: record?.owner ?? null,
              members: record?.members ?? {},
              you,
            });
          }
          if (request.method === "PUT" && !membersMatch[2]) {
            const { username, role } = JSON.parse((await readBody(request)).toString());
            if (!auth.userExists(username)) {
              return reply(400, { error: `Không có tài khoản "${username}" trên máy chủ.` });
            }
            members.setMember(projectId, identity, username, role);
            return reply(200, { ok: true });
          }
          if (request.method === "DELETE" && membersMatch[2]) {
            members.removeMember(projectId, identity, decodeURIComponent(membersMatch[2]));
            return reply(200, { ok: true });
          }
        } catch (error) {
          return reply(403, { error: String(error.message ?? error) });
        }
      }
      if (url.pathname.match(/^\/projects\/[^/]+\/claim$/) && request.method === "POST") {
        if (!auth.allows(identity, "editor")) return needsEditor();
        const projectId = decodeURIComponent(url.pathname.split("/")[2]);
        try {
          members.claim(projectId, identity);
          return reply(200, { ok: true });
        } catch (error) {
          return reply(409, { error: String(error.message ?? error) });
        }
      }

      /**
       * Key file luôn có tiền tố projectId (store tạo `${projectId}/…`) —
       * dự án đã đăng ký thì file của nó chỉ thành viên chạm được. Chặn ở
       * đây chứ không phải trong UI: người ngoài có URL cũng không tải nổi.
       */
      const fileAccess = (key, need) => {
        const projectId = key.split("/")[0];
        const eff = members.effectiveRole(identity, projectId);
        if (eff.scope === "open") return auth.allows(identity, need);
        if (eff.role === null) return false;
        return need === "viewer" || eff.role === "owner" || eff.role === "editor";
      };

      /**
       * Snapshot dự án (C1, docs/KIEN-TRUC.md): nguồn sự thật nằm ở server.
       * GET = thành viên (viewer trở lên) kéo về merge; PUT = editor đẩy
       * {projectId, clocks, project} sau mỗi đợt commit. Lưu qua storage
       * adapter dưới key `<projectId>/.state/snapshot.json` — /list giấu
       * tiền tố .state/ để nó không hiện thành "file CDE".
       */
      /**
       * Danh sách dự án có snapshot trên máy chủ mà NGƯỜI GỌI xem được —
       * "đổi máy" đi qua đây: máy mới không có localStorage thì không biết
       * projectId nào để kéo; danh sách này là cửa "Mở từ máy chủ".
       */
      if (url.pathname === "/projects" && request.method === "GET") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const files = await storage.list("");
        const projects = [];
        for (const file of files) {
          const key = file.key ?? file;
          if (!key.endsWith("/.state/snapshot.json")) continue;
          if (!fileAccess(key, "viewer")) continue;
          const projectId = key.split("/")[0];
          let name = projectId;
          try {
            name =
              JSON.parse((await storage.get(key)).toString("utf8")).project?.name ?? projectId;
          } catch {
            // snapshot hỏng vẫn được liệt kê — người dùng còn thấy mà báo.
          }
          projects.push({ id: projectId, name, size: file.size ?? null });
        }
        return reply(200, { projects });
      }

      const stateMatch = url.pathname.match(/^\/projects\/([^/]+)\/state$/);
      if (stateMatch) {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const projectId = decodeURIComponent(stateMatch[1]);
        const stateKey = `${projectId}/.state/snapshot.json`;
        if (request.method === "GET") {
          if (!fileAccess(stateKey, "viewer")) {
            return reply(403, { error: "Bạn không phải thành viên dự án này." });
          }
          try {
            return reply(200, (await storage.get(stateKey)).toString("utf8"));
          } catch {
            return reply(404, { error: "Dự án chưa có snapshot trên máy chủ." });
          }
        }
        if (request.method === "PUT") {
          if (!fileAccess(stateKey, "editor")) {
            return reply(403, { error: "Bạn không có quyền editor trong dự án này." });
          }
          const raw = await readBody(request);
          if (raw.length > 25 * 1024 * 1024) {
            return reply(413, { error: "Snapshot quá 25 MB." });
          }
          let parsed;
          try {
            parsed = JSON.parse(raw.toString("utf8"));
          } catch {
            return reply(400, { error: "Snapshot không phải JSON hợp lệ." });
          }
          if (!parsed.project || !parsed.clocks) {
            return reply(400, { error: "Snapshot cần {project, clocks}." });
          }
          await storage.put(stateKey, raw);
          return reply(200, { ok: true });
        }
      }

      if (url.pathname.startsWith("/files/")) {
        const key = safeKey(url.pathname.slice("/files/".length));
        if (!key) return reply(400, { error: "bad key" });
        if (request.method === "PUT") {
          if (!identity) return needsEditor();
          if (!fileAccess(key, "editor")) {
            return reply(403, {
              error: "Bạn không có quyền editor trong dự án này.",
            });
          }
          await storage.put(key, await readBody(request));
          return reply(200, { ok: true, key });
        }
        if (request.method === "GET") {
          if (!identity) return reply(401, { error: "login required" });
          if (!fileAccess(key, "viewer")) {
            return reply(403, { error: "Bạn không phải thành viên dự án này." });
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
        const files = await storage.list(prefix);
        // Danh sách cũng là dữ liệu: file của dự án riêng tư không được lộ
        // tên cho người ngoài dự án.
        return reply(200, {
          files: files.filter((file) => {
            const key = file.key ?? file;
            return !key.includes("/.state/") && fileAccess(key, "viewer");
          }),
        });
      }

      if (url.pathname === "/ai/read-drawing" && request.method === "POST") {
        if (!auth.allows(identity, "editor")) return needsEditor();
        const config = aiConfig();
        if (!aiEnabled(config)) {
          return reply(501, { error: AI_NOT_CONFIGURED });
        }
        const { key, question } = JSON.parse((await readBody(request)).toString());
        const cleanKey = safeKey(key ?? "");
        if (!cleanKey || !question?.trim()) {
          return reply(400, { error: "key and question required" });
        }
        const answer = await answerDrawingQuestion(
          await storage.get(cleanKey),
          question.trim(),
          config,
        );
        return reply(200, { answer });
      }

      if (url.pathname === "/ai/render-concept" && request.method === "POST") {
        if (!auth.allows(identity, "editor")) return needsEditor();
        const config = aiConfig();
        if (!aiEnabled(config)) {
          return reply(501, { error: AI_NOT_CONFIGURED });
        }
        const { image, style } = JSON.parse((await readBody(request)).toString());
        if (!image?.startsWith("data:image/png;base64,") || !style?.trim()) {
          return reply(400, { error: "image (png data URL) and style required" });
        }
        const brief = await writeRenderBrief(image, style.trim(), config);
        // The brief is worth returning on its own; a missing image generator
        // is a configuration choice, not a failure of the request.
        const rendered = imageRenderEnabled(config)
          ? await renderConcept(image, brief.prompt_en, config)
          : null;
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
  const clients = new Map(); // socket -> {clientId, role, identity}

  /**
   * Quyền của một danh tính với MỘT frame — mọi frame mang projectId, và
   * đó là đơn vị phân quyền: dự án đã đăng ký thì frame của nó chỉ đi tới
   * (và đi từ) thành viên. Relay vẫn "dumb" về nội dung; nó chỉ nhìn địa
   * chỉ dự án trên phong bì.
   */
  const frameRole = (identity, projectId) => {
    const eff = members.effectiveRole(identity, projectId ?? "");
    if (eff.scope === "open") return eff.role; // role toàn cục như trước
    return eff.role === "owner" ? "editor" : eff.role; // null = không quyền
  };

  server.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const identity = auth.verify(url.searchParams.get("token"));
    if (!identity) {
      socket.close(4401, "login required");
      return;
    }
    clients.set(socket, { clientId: null, role: identity.role, identity });

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
      const senderRole = frameRole(state.identity, frame.projectId);
      // Người ngoài dự án không gửi được gì; viewer gửi presence, không
      // bao giờ gửi model state.
      if (senderRole === null) return;
      if (frame.type === "sync" && senderRole !== "editor" && senderRole !== "admin") {
        return;
      }
      for (const [peer, peerState] of clients) {
        if (peer === socket || peer.readyState !== peer.OPEN) continue;
        // Người ngoài dự án cũng không NHẬN được frame của nó.
        if (frameRole(peerState.identity, frame.projectId) === null) continue;
        peer.send(text);
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
