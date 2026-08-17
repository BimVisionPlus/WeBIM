// Webhook theo dự án — sự kiện của WeBIM đi tiếp vào hệ thống của đội khác.
//
// Owner dự án đăng ký một URL; khi có sự kiện (file.put, state.push) relay
// POST payload JSON tới đó, ký HMAC-SHA256 bằng secret sinh lúc đăng ký
// (header X-WeBIM-Signature) — bên nhận verify được là WeBIM gửi chứ không
// phải ai đó đoán ra URL.
//
// Trung thực về giao hàng: MỘT lần thử + một lần thử lại sau 5 giây, kết
// quả cuối (status/lỗi + thời điểm) ghi vào bản ghi webhook để owner nhìn
// thấy hook của mình sống hay chết. Không có hàng đợi bền — relay là
// file-based zero-dep; hook chết lâu ngày là việc của người đăng ký, và
// bảng trạng thái nói điều đó thay vì im lặng nuốt.
//
// SSRF: URL webhook do NGƯỜI DÙNG nhập và được RELAY gọi — không có guard
// thì "webhook" thành cách quét mạng nội bộ của máy chủ (Ollama :11434,
// metrics, cloud metadata 169.254.169.254…). Chỉ nhận http(s), phân giải
// DNS trước khi gọi và chặn mọi IP loopback/private/link-local.

import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "users",
  "webhooks.json",
);

export const WEBHOOK_EVENTS = ["file.put", "state.push"];

/** IP có phải dải cấm (loopback/private/link-local/metadata) không. */
export function isForbiddenIp(address) {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fe80:") || // link-local
      lower.startsWith("fc") || // unique-local fc00::/7
      lower.startsWith("fd") ||
      lower.startsWith("::ffff:") // IPv4-mapped — kiểm phần IPv4 bên dưới
    );
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  return (
    a === 127 || // loopback
    a === 10 || // private
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 169 && b === 254) || // link-local + cloud metadata
    (a === 100 && b >= 64 && b <= 127) // CGNAT (Docker/Tailscale hay dùng)
  );
}

/**
 * URL có được phép làm webhook không. Trả {ok} hoặc {ok:false, reason}.
 * Phân giải DNS ngay lúc kiểm — hostname trỏ vào IP nội bộ cũng bị chặn.
 */
export async function checkWebhookUrl(rawUrl, lookupImpl = lookup) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL không hợp lệ." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Chỉ nhận http/https." };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "host.docker.internal") {
    return { ok: false, reason: "Không trỏ webhook vào chính máy chủ." };
  }
  const addresses = [];
  if (isIP(host)) {
    addresses.push(host);
  } else {
    try {
      addresses.push(...(await lookupImpl(host, { all: true })).map((entry) => entry.address));
    } catch {
      return { ok: false, reason: `Không phân giải được ${host}.` };
    }
  }
  for (const address of addresses) {
    const v4 = address.toLowerCase().startsWith("::ffff:") ? address.slice(7) : address;
    if (isForbiddenIp(v4)) {
      return { ok: false, reason: `${host} trỏ vào dải IP nội bộ (${address}) — bị chặn.` };
    }
  }
  return { ok: true };
}

export function signPayload(secret, body) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function createWebhooks({ path = DEFAULT_PATH, fetchImpl = fetch } = {}) {
  let hooks = [];
  if (existsSync(path)) {
    try {
      hooks = JSON.parse(readFileSync(path, "utf8")).hooks ?? [];
    } catch {
      console.error(`[webim] webhooks.json hỏng — bỏ qua (${path})`);
      hooks = [];
    }
  }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify({ hooks }, null, 2));
    renameSync(tmp, path);
  };

  const deliverOnce = async (hook, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WeBIM-Event": JSON.parse(body).event,
          "X-WeBIM-Signature": `sha256=${signPayload(hook.secret, body)}`,
        },
        body,
        signal: controller.signal,
      });
      return { status: response.status, ok: response.ok };
    } catch (cause) {
      return { status: 0, ok: false, error: String(cause?.message ?? cause).slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    /** Đăng ký hook; secret sinh server-side, trả về ĐÚNG MỘT LẦN. */
    async add(projectId, { url, events }) {
      const allowed = await checkWebhookUrl(url);
      if (!allowed.ok) return { error: allowed.reason };
      const wanted = (Array.isArray(events) && events.length ? events : WEBHOOK_EVENTS).filter(
        (event) => WEBHOOK_EVENTS.includes(event),
      );
      if (wanted.length === 0) {
        return { error: `events phải nằm trong: ${WEBHOOK_EVENTS.join(", ")}` };
      }
      if (hooks.filter((hook) => hook.projectId === projectId).length >= 10) {
        return { error: "Mỗi dự án tối đa 10 webhook." };
      }
      const secret = `whs_${randomBytes(24).toString("hex")}`;
      const record = {
        id: randomBytes(8).toString("hex"),
        projectId,
        url,
        events: wanted,
        secret,
        createdAt: new Date().toISOString(),
        lastStatus: null,
        lastAt: null,
      };
      hooks.push(record);
      persist();
      return { id: record.id, url, events: wanted, secret };
    },

    /** Danh sách hook của dự án — không bao giờ kèm secret. */
    list(projectId) {
      return hooks
        .filter((hook) => hook.projectId === projectId)
        .map(({ id, url, events, createdAt, lastStatus, lastAt }) => ({
          id,
          url,
          events,
          createdAt,
          lastStatus,
          lastAt,
        }));
    },

    remove(projectId, id) {
      const before = hooks.length;
      hooks = hooks.filter((hook) => !(hook.projectId === projectId && hook.id === id));
      if (hooks.length === before) return false;
      persist();
      return true;
    },

    /**
     * Bắn sự kiện tới mọi hook khớp (projectId + loại). KHÔNG chặn request
     * gốc — trả về promise để test await được, còn server thì fire-and-forget.
     */
    async emit(event) {
      const matching = hooks.filter(
        (hook) => hook.projectId === event.projectId && hook.events.includes(event.event),
      );
      if (matching.length === 0) return [];
      const body = JSON.stringify({ ...event, sentAt: new Date().toISOString() });
      return Promise.all(
        matching.map(async (hook) => {
          let result = await deliverOnce(hook, body);
          if (!result.ok) {
            await new Promise((resolve) => setTimeout(resolve, 5_000));
            result = await deliverOnce(hook, body);
          }
          hook.lastStatus = result.ok ? result.status : (result.error ?? `HTTP ${result.status}`);
          hook.lastAt = new Date().toISOString();
          persist();
          return { id: hook.id, ...result };
        }),
      );
    },
  };
}
