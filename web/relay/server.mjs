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
  answerStandardsQuestion,
  imageRenderEnabled,
  renderConcept,
  writeRenderBrief,
} from "./ai.mjs";
import { createApiKeys } from "./apikeys.mjs";
import { createAuth } from "./auth.mjs";
import { createAudit, summarizeEvents } from "./audit.mjs";
import { createWebhooks, WEBHOOK_EVENTS } from "./webhooks.mjs";
import { createOrgs } from "./orgs.mjs";
import { createMembers } from "./members.mjs";
import {
  buildCheckoutUrl,
  makeTxnRef,
  usernameFromTxnRef,
  verifyCallback,
  vnpayConfig,
  vnpayEnabled,
} from "./billing.mjs";
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

/** Trần 30 MB cho MỌI body HTTP — snapshot đã tự giới hạn 25 MB, file CDE
 * lớn hơn thế thuộc về S3/BYO storage chứ không phải một POST. */
const MAX_BODY_BYTES = 30 * 1024 * 1024;

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      request.destroy();
      throw new Error("Body vượt trần 30 MB");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function startRelay(port = 8787, options = {}) {
  const auth = options.auth ?? createAuth();
  const storage = options.storage ?? createStorage(DATA_DIR);
  const orgs = options.orgs ?? createOrgs();
  const members = options.members ?? createMembers({ orgs });
  const audit = options.audit ?? createAudit();
  const apiKeys = options.apiKeys ?? createApiKeys();
  const webhooks = options.webhooks ?? createWebhooks();
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

  /**
   * Rate-limit đường auth theo IP (C6): login/register là cửa brute-force
   * rẻ nhất. Bộ đếm trong bộ nhớ — relay đơn node nên thế là đủ, và một
   * lần restart xoá bộ đếm cũng không phải lỗ hổng đáng kể.
   */
  const authHits = new Map(); // ip -> {count, resetAt}
  const authLimited = (request) => {
    const ip = request.socket?.remoteAddress ?? "?";
    const now = Date.now();
    const entry = authHits.get(ip);
    if (!entry || now > entry.resetAt) {
      authHits.set(ip, { count: 1, resetAt: now + 60_000 });
      return false;
    }
    entry.count += 1;
    return entry.count > 20;
  };

  const identityOf = (request) => {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    // API key (wbk_) là danh tính dài hạn cho máy: map về người dùng thật
    // rồi tra role/plan SỐNG — mọi enforcement đi chung một đường với người.
    if (token?.startsWith("wbk_")) {
      const match = apiKeys.identify(token);
      if (!match) return null;
      const identity = auth.identify(match.username);
      return identity ? { ...identity, viaApiKey: match.keyId } : null;
    }
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
        if (authLimited(request)) {
          return reply(429, { error: "Thử lại sau một phút — quá nhiều lần đăng nhập." });
        }
        const { username, password } = JSON.parse((await readBody(request)).toString());
        const session = auth.login(username, password);
        if (session) {
          audit.log({ user: username, action: "auth.login" });
        } else {
          // Đăng nhập trượt là tín hiệu an ninh — đáng một dòng.
          audit.log({ user: username ?? "?", action: "auth.login_failed" });
        }
        return session
          ? reply(200, session)
          : reply(401, { error: "Sai tên đăng nhập hoặc mật khẩu." });
      }

      /**
       * Tự đăng ký (GĐ3/C3). Mặc định MỞ để onboarding không cần quản trị
       * viên; self-host kín đặt WEBIM_REGISTRATION=closed. Chỉ có nghĩa khi
       * auth đang bật — open mode không có khái niệm tài khoản.
       */
      if (url.pathname === "/auth/register" && request.method === "POST") {
        if (authLimited(request)) {
          return reply(429, { error: "Thử lại sau một phút." });
        }
        if (!auth.enabled) {
          return reply(400, {
            error: "Máy chủ đang chạy chế độ mở (chưa bật đăng nhập) — không cần tài khoản.",
          });
        }
        if ((process.env.WEBIM_REGISTRATION ?? "open") === "closed") {
          return reply(403, {
            error: "Máy chủ này không mở đăng ký — liên hệ quản trị viên để được cấp tài khoản.",
          });
        }
        try {
          const { username, password } = JSON.parse((await readBody(request)).toString());
          const session = auth.register(username, password);
          audit.log({ user: username, action: "auth.register" });
          return reply(200, session);
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
      }

      if (url.pathname === "/auth/change-password" && request.method === "POST") {
        if (authLimited(request)) {
          return reply(429, { error: "Thử lại sau một phút." });
        }
        const caller = identityOf(request);
        if (!caller) return reply(401, { error: "Cần đăng nhập." });
        try {
          const { oldPassword, newPassword } = JSON.parse((await readBody(request)).toString());
          auth.changePassword(caller.username, oldPassword, newPassword);
          audit.log({ user: caller.username, action: "auth.password_changed" });
          return reply(200, { ok: true });
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
      }

      if (url.pathname.match(/^\/auth\/users\/[^/]+\/plan$/) && request.method === "PUT") {
        const caller = identityOf(request);
        if (!auth.allows(caller, "admin")) {
          return reply(caller ? 403 : 401, { error: "Chỉ admin cấp được gói." });
        }
        try {
          const { plan, months } = JSON.parse((await readBody(request)).toString());
          const target = decodeURIComponent(url.pathname.split("/")[3]);
          const outcome = auth.setPlan(target, plan, months ?? 12);
          audit.log({
            user: caller.username,
            action: "plan.set",
            detail: `${target} → ${plan}`,
          });
          return reply(200, outcome);
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
      }

      if (url.pathname.match(/^\/auth\/users\/[^/]+\/reset-password$/) && request.method === "POST") {
        const caller = identityOf(request);
        if (!auth.allows(caller, "admin")) {
          return reply(caller ? 403 : 401, { error: "Chỉ admin đặt lại được mật khẩu." });
        }
        try {
          const { newPassword } = JSON.parse((await readBody(request)).toString());
          const target = decodeURIComponent(url.pathname.split("/")[3]);
          auth.resetPassword(target, newPassword);
          audit.log({ user: caller.username, action: "auth.password_reset", detail: target });
          return reply(200, { ok: true });
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
      }

      if (url.pathname.match(/^\/auth\/users\/[^/]+\/credits$/) && request.method === "PUT") {
        const caller = identityOf(request);
        if (!auth.allows(caller, "admin")) {
          return reply(caller ? 403 : 401, { error: "Chỉ admin nạp được credit." });
        }
        try {
          const { amount } = JSON.parse((await readBody(request)).toString());
          const target = decodeURIComponent(url.pathname.split("/")[3]);
          const balance = auth.grantRenderCredits(target, amount);
          audit.log({ user: caller.username, action: "credits.grant", detail: `${target} +${amount} → ${balance}` });
          return reply(200, { renderCredits: balance });
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
      }

      if (url.pathname.match(/^\/auth\/users\/[^/]+\/role$/) && request.method === "PUT") {
        const caller = identityOf(request);
        if (!auth.allows(caller, "admin")) {
          return reply(caller ? 403 : 401, { error: "Chỉ admin đổi được role." });
        }
        try {
          const { role } = JSON.parse((await readBody(request)).toString());
          auth.setRole(decodeURIComponent(url.pathname.split("/")[3]), role);
          return reply(200, { ok: true });
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
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

      // ── Tổ chức (organization/workspace) ──────────────────────────────
      if (url.pathname === "/orgs" && request.method === "GET") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        return reply(200, { orgs: orgs.ofUser(identity.username) });
      }
      if (url.pathname === "/orgs" && request.method === "POST") {
        if (!auth.allows(identity, "editor")) return needsEditor();
        try {
          const { name } = JSON.parse((await readBody(request)).toString());
          const org = orgs.create(name, identity.username);
          audit.log({ user: identity.username, action: "org.create", detail: org.name });
          return reply(200, { id: org.id, name: org.name });
        } catch (error) {
          return reply(400, { error: String(error.message ?? error) });
        }
      }
      const orgMemberMatch = url.pathname.match(/^\/orgs\/([^/]+)\/members(?:\/([^/]+))?$/);
      if (orgMemberMatch) {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const orgId = decodeURIComponent(orgMemberMatch[1]);
        try {
          if (request.method === "GET") {
            const org = orgs.get(orgId);
            if (!org || !orgs.roleIn(orgId, identity.username)) {
              return reply(403, { error: "Bạn không thuộc tổ chức này." });
            }
            return reply(200, {
              name: org.name,
              owner: org.owner,
              members: org.members,
              you: orgs.roleIn(orgId, identity.username),
            });
          }
          if (request.method === "PUT" && !orgMemberMatch[2]) {
            const { username, role } = JSON.parse((await readBody(request)).toString());
            if (!auth.userExists(username)) {
              return reply(400, { error: `Không có tài khoản "${username}" trên máy chủ.` });
            }
            orgs.setMember(orgId, identity.username, username, role);
            audit.log({ user: identity.username, action: "org.member.set", detail: `${username} → ${role}` });
            return reply(200, { ok: true });
          }
          if (request.method === "DELETE" && orgMemberMatch[2]) {
            orgs.removeMember(orgId, identity.username, decodeURIComponent(orgMemberMatch[2]));
            audit.log({ user: identity.username, action: "org.member.remove", detail: decodeURIComponent(orgMemberMatch[2]) });
            return reply(200, { ok: true });
          }
        } catch (error) {
          return reply(403, { error: String(error.message ?? error) });
        }
      }
      if (url.pathname.match(/^\/projects\/[^/]+\/org$/) && request.method === "PUT") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const projectId = decodeURIComponent(url.pathname.split("/")[2]);
        try {
          const { orgId } = JSON.parse((await readBody(request)).toString());
          members.assignOrg(projectId, identity, orgId ?? null);
          audit.log({
            user: identity.username,
            action: orgId ? "project.assign_org" : "project.unassign_org",
            projectId,
            ...(orgId ? { detail: `org ${orgId}` } : {}),
          });
          return reply(200, { ok: true });
        } catch (error) {
          return reply(403, { error: String(error.message ?? error) });
        }
      }

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
            const org = record?.orgId ? orgs.get(record.orgId) : null;
            return reply(200, {
              registered: record !== null,
              owner: record?.owner ?? null,
              members: record?.members ?? {},
              you,
              ...(record?.orgId
                ? { org: { id: record.orgId, name: org?.name ?? record.orgId } }
                : {}),
            });
          }
          if (request.method === "PUT" && !membersMatch[2]) {
            const { username, role } = JSON.parse((await readBody(request)).toString());
            if (!auth.userExists(username)) {
              return reply(400, { error: `Không có tài khoản "${username}" trên máy chủ.` });
            }
            members.setMember(projectId, identity, username, role);
            audit.log({
              user: identity.username,
              action: "member.set",
              projectId,
              detail: `${username} → ${role}`,
            });
            return reply(200, { ok: true });
          }
          if (request.method === "DELETE" && membersMatch[2]) {
            members.removeMember(projectId, identity, decodeURIComponent(membersMatch[2]));
            audit.log({
              user: identity.username,
              action: "member.remove",
              projectId,
              detail: decodeURIComponent(membersMatch[2]),
            });
            return reply(200, { ok: true });
          }
        } catch (error) {
          return reply(403, { error: String(error.message ?? error) });
        }
      }
      if (url.pathname.match(/^\/projects\/[^/]+\/claim$/) && request.method === "POST") {
        if (!auth.allows(identity, "editor")) return needsEditor();
        const projectId = decodeURIComponent(url.pathname.split("/")[2]);
        // Hạn mức gói (C4) cưỡng chế Ở ĐÂY, không phải trong UI: Free được
        // MỘT dự án riêng tư; Team/Enterprise không giới hạn. Đọc plan live
        // (auth.planOf) chứ không tin claim trong token — token sống 12h,
        // gói có thể hết hạn giữa chừng.
        if (
          auth.planOf(identity.username) === "free" &&
          members.countOwned(identity.username) >= 1
        ) {
          return reply(402, {
            error:
              "Gói Free được 1 dự án riêng tư. Nâng cấp Team (menu tài khoản) để đăng ký thêm — dự án được mời tham gia thì không giới hạn.",
          });
        }
        try {
          let orgId = null;
          try {
            orgId = JSON.parse((await readBody(request)).toString()).orgId ?? null;
          } catch {
            orgId = null; // body rỗng = claim cá nhân, như cũ
          }
          members.claim(projectId, identity, orgId);
          audit.log({
            user: identity.username,
            action: "project.claim",
            projectId,
            ...(orgId ? { detail: `org ${orgId}` } : {}),
          });
          return reply(200, { ok: true });
        } catch (error) {
          return reply(409, { error: String(error.message ?? error) });
        }
      }

      // ── Billing (VNPay) ─────────────────────────────────────────────────
      if (url.pathname === "/billing/plan" && request.method === "GET") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const config = vnpayConfig();
        return reply(200, {
          ...auth.planInfoOf(identity.username),
          renderCredits: auth.renderCreditsOf(identity.username),
          ownedProjects: members.countOwned(identity.username),
          teamPriceVnd: config.teamPriceVnd,
          teamMonths: config.teamMonths,
          vnpayReady: vnpayEnabled(config),
        });
      }

      if (url.pathname === "/billing/checkout" && request.method === "POST") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const config = vnpayConfig();
        if (!vnpayEnabled(config)) {
          return reply(501, {
            error:
              "Cổng VNPay chưa cấu hình — đặt VNPAY_TMN_CODE và VNPAY_HASH_SECRET " +
              "(đăng ký merchant tại vnpay.vn), hoặc liên hệ để được cấp gói tay.",
          });
        }
        // vnp_CreateDate theo giờ VN (GMT+7), định dạng yyyyMMddHHmmss.
        const now = new Date(Date.now() + 7 * 3600_000);
        const createDate = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
        const payUrl = buildCheckoutUrl(
          {
            username: identity.username,
            amountVnd: config.teamPriceVnd,
            orderInfo: `WeBIM Team ${config.teamMonths} thang cho ${identity.username}`,
            ipAddress: request.socket?.remoteAddress ?? "127.0.0.1",
            createDate,
            txnRef: makeTxnRef(identity.username),
          },
          config,
        );
        return reply(200, { payUrl });
      }

      /**
       * IPN là NGUỒN SỰ THẬT của VNPay (server-to-server); return chỉ là màn
       * hiển thị cho trình duyệt. Cả hai cùng verify chữ ký và cùng nâng gói
       * — setPlan idempotent nên đến trước đến sau đều lành.
       */
      const settleVnpay = (query) => {
        const config = vnpayConfig();
        const result = verifyCallback(query, config);
        if (!result.valid) return { ok: false, code: "97" };
        if (!result.success) return { ok: false, code: "00" }; // giao dịch huỷ/thất bại — ghi nhận, không nâng gói
        const username = usernameFromTxnRef(result.txnRef, auth.listUsernames());
        if (!username) return { ok: false, code: "01" };
        auth.setPlan(username, "team", vnpayConfig().teamMonths);
        audit.log({ user: username, action: "billing.team_activated", detail: result.txnRef });
        console.log(`[webim] billing: ${username} → team (VNPay ${result.txnRef}, ${result.amountVnd}đ)`);
        return { ok: true, code: "00" };
      };

      if (url.pathname === "/billing/vnpay-ipn" && request.method === "GET") {
        const outcome = settleVnpay(Object.fromEntries(url.searchParams));
        return reply(200, {
          RspCode: outcome.code,
          Message: outcome.ok ? "Confirm Success" : "Checksum failed",
        });
      }

      if (url.pathname === "/billing/vnpay-return" && request.method === "GET") {
        const outcome = settleVnpay(Object.fromEntries(url.searchParams));
        response.writeHead(302, {
          Location: `/?billing=${outcome.ok ? "success" : "fail"}`,
        });
        response.end();
        return;
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

      // ── Public API: API key ───────────────────────────────────────────
      // Quản lý key chỉ bằng SESSION token — key bị lộ không tự nhân bản
      // được chính nó, và không tự xoá dấu vết được.
      if (url.pathname === "/apikeys" && (request.method === "POST" || request.method === "GET")) {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        if (identity.viaApiKey) {
          return reply(403, {
            error: "Quản lý API key cần đăng nhập bằng mật khẩu, không dùng được bằng API key.",
          });
        }
        if (request.method === "GET") {
          return reply(200, { keys: apiKeys.list(identity.username) });
        }
        let label = "";
        try {
          label = JSON.parse((await readBody(request)).toString() || "{}").label ?? "";
        } catch {
          return reply(400, { error: "Body phải là JSON." });
        }
        const created = apiKeys.create(identity.username, label);
        audit.log({ user: identity.username, action: "apikey.create", detail: created.prefix });
        // key plaintext xuất hiện ĐÚNG MỘT LẦN trong response này.
        return reply(201, { ...created, note: "Lưu key ngay — sẽ không hiển thị lại." });
      }
      const apiKeyMatch = url.pathname.match(/^\/apikeys\/([^/]+)$/);
      if (apiKeyMatch && request.method === "DELETE") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        if (identity.viaApiKey) {
          return reply(403, {
            error: "Quản lý API key cần đăng nhập bằng mật khẩu, không dùng được bằng API key.",
          });
        }
        const removed = apiKeys.revoke(identity.username, apiKeyMatch[1]);
        if (!removed) return reply(404, { error: "Không thấy key này của bạn." });
        audit.log({ user: identity.username, action: "apikey.revoke", detail: apiKeyMatch[1] });
        return reply(200, { ok: true });
      }

      // ── Public API: webhook theo dự án (owner) ────────────────────────
      const webhookMatch = url.pathname.match(/^\/projects\/([^/]+)\/webhooks(?:\/([^/]+))?$/);
      if (webhookMatch) {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const projectId = decodeURIComponent(webhookMatch[1]);
        const grip = members.effectiveRole(identity, projectId);
        if (grip.scope === "open") {
          return reply(409, {
            error: "Dự án chưa được claim — claim quyền sở hữu trước rồi mới đăng ký webhook.",
          });
        }
        if (grip.role !== "owner" && identity.role !== "admin") {
          return reply(403, { error: "Chỉ owner dự án quản lý được webhook." });
        }
        if (!webhookMatch[2] && request.method === "GET") {
          return reply(200, { webhooks: webhooks.list(projectId), events: WEBHOOK_EVENTS });
        }
        if (!webhookMatch[2] && request.method === "POST") {
          let body;
          try {
            body = JSON.parse((await readBody(request)).toString());
          } catch {
            return reply(400, { error: "Body phải là JSON." });
          }
          const created = await webhooks.add(projectId, {
            url: body.url,
            events: body.events,
          });
          if (created.error) return reply(400, { error: created.error });
          audit.log({
            user: identity.username,
            action: "webhook.create",
            projectId,
            detail: created.url,
          });
          // secret xuất hiện ĐÚNG MỘT LẦN — bên nhận dùng nó verify chữ ký.
          return reply(201, { ...created, note: "Lưu secret ngay — sẽ không hiển thị lại." });
        }
        if (webhookMatch[2] && request.method === "DELETE") {
          const removed = webhooks.remove(projectId, webhookMatch[2]);
          if (!removed) return reply(404, { error: "Không thấy webhook này." });
          audit.log({
            user: identity.username,
            action: "webhook.remove",
            projectId,
            detail: webhookMatch[2],
          });
          return reply(200, { ok: true });
        }
      }

      const auditMatch = url.pathname.match(/^\/projects\/([^/]+)\/audit$/);
      if (auditMatch && request.method === "GET") {
        if (!identity) return reply(401, { error: "Cần đăng nhập." });
        const projectId = decodeURIComponent(auditMatch[1]);
        if (!fileAccess(`${projectId}/x`, "viewer")) {
          return reply(403, { error: "Bạn không phải thành viên dự án này." });
        }
        return reply(200, { events: audit.forProject(projectId) });
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
          audit.log({ user: identity.username, action: "state.push", projectId });
          // Fire-and-forget: webhook chậm/chết không được giữ chân người đẩy.
          void webhooks
            .emit({
              event: "state.push",
              projectId,
              user: identity.username,
              size: raw.length,
            })
            .catch(() => {});
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
          const body = await readBody(request);
          // Quota theo DỰ ÁN (mặc định 2 GB, chỉnh WEBIM_PROJECT_QUOTA_MB):
          // một editor không được phép ghi đầy đĩa của cả máy chủ. Đếm thật
          // qua storage.list — chậm hơn một biến đếm nhưng không bao giờ
          // lệch khỏi sự thật trên đĩa.
          const quotaMb = Number(process.env.WEBIM_PROJECT_QUOTA_MB ?? 2048);
          const projectPrefix = key.split("/")[0] + "/";
          const used = (await storage.list(projectPrefix)).reduce(
            (sum, file) => sum + (file.size ?? 0),
            0,
          );
          if (used + body.length > quotaMb * 1024 * 1024) {
            return reply(413, {
              error:
                `Dự án đã dùng ${(used / 1048576).toFixed(0)} MB / quota ${quotaMb} MB — ` +
                `xoá bớt file cũ hoặc liên hệ quản trị viên nâng quota.`,
            });
          }
          await storage.put(key, body);
          audit.log({
            user: identity?.username ?? "?",
            action: "file.put",
            projectId: key.split("/")[0],
            detail: key.split("/").slice(1).join("/"),
          });
          void webhooks
            .emit({
              event: "file.put",
              projectId: key.split("/")[0],
              key,
              size: body.length,
              user: identity?.username ?? "?",
            })
            .catch(() => {});
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

      if (url.pathname === "/ai/standards-qa" && request.method === "POST") {
        // Tra cứu là tính năng đọc: viewer đăng nhập là đủ (khác read-drawing
        // vốn đụng file dự án). Client đã retrieval sẵn các điều khoản; relay
        // chỉ chuyển cho model kèm kỷ luật trích dẫn — relay không giữ corpus.
        if (!identity) {
          return reply(401, { error: "Cần đăng nhập để hỏi AI về quy chuẩn." });
        }
        const config = aiConfig();
        if (!aiEnabled(config)) {
          return reply(501, { error: AI_NOT_CONFIGURED });
        }
        const { question, excerpts } = JSON.parse((await readBody(request)).toString());
        // Chặn kích thước TRƯỚC khi gọi model: đây là cổng chung cho mọi
        // client, không phải proxy LLM tự do.
        if (typeof question !== "string" || !question.trim() || question.length > 500) {
          return reply(400, { error: "question required (≤500 ký tự)" });
        }
        if (
          !Array.isArray(excerpts) ||
          excerpts.length === 0 ||
          excerpts.length > 8 ||
          excerpts.some(
            (excerpt) =>
              typeof excerpt?.label !== "string" ||
              typeof excerpt?.text !== "string" ||
              excerpt.label.length + excerpt.text.length > 4000,
          )
        ) {
          return reply(400, { error: "excerpts: 1–8 trích đoạn, mỗi cái ≤4000 ký tự" });
        }
        const answer = await answerStandardsQuestion(question.trim(), excerpts, config);
        audit.log({ user: identity.username, action: "ai.standards-qa" });
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
        // Credit render (GĐ6): GPU là tiền thật — đếm ở server, hết là 402.
        // Trừ SAU mọi kiểm tra (AI bật, input hợp lệ): server cấu hình thiếu
        // hay request lỗi không được phép đốt credit của người dùng.
        if (!auth.consumeRenderCredit(identity.username)) {
          return reply(402, {
            error:
              "Hết credit render. Nâng cấp Team (200 credit) hoặc liên hệ quản trị viên để nạp thêm.",
          });
        }
        audit.log({
          user: identity.username,
          action: "ai.render",
          detail: `còn ${auth.renderCreditsOf(identity.username)}`,
        });
        const brief = await writeRenderBrief(image, style.trim(), config);
        // The brief is worth returning on its own; a missing image generator
        // is a configuration choice, not a failure of the request.
        const rendered = imageRenderEnabled(config)
          ? await renderConcept(image, brief.prompt_en, config)
          : null;
        return reply(200, { ...brief, image: rendered });
      }

      if (url.pathname === "/admin/metrics" && request.method === "GET") {
        if (!auth.allows(identity, "admin")) {
          return reply(identity ? 403 : 401, { error: "Chỉ admin xem được số liệu." });
        }
        return reply(200, summarizeEvents(audit.recent(5000)));
      }

      reply(404, { error: "not found" });
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 500;
      if (status === 500) {
        // Error tracking tối thiểu: mỗi 500 một dòng có cấu trúc — grep
        // được, đếm được, không cần Sentry ở quy mô này.
        console.error(
          `[webim] 500 ${request.method} ${url.pathname}: ${error.message ?? error}`,
        );
      }
      reply(status, { error: String(error.message ?? error) });
    }
  });

  // maxPayload: một frame sync là cả project JSON — 30 MB là trần hào phóng;
  // không đặt thì mặc định ws cho 100 MB và một client lỗi có thể nuốt RAM.
  const server = new WebSocketServer({ server: httpServer, maxPayload: 30 * 1024 * 1024 });
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
