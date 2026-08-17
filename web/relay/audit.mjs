// Nhật ký kiểm toán server-side (GĐ4) — ai làm gì, ở dự án nào, lúc nào.
//
// Sync LWW không có "lịch sử server" — máy chủ chỉ chuyển tiếp và giữ
// snapshot mới nhất. Nhật ký này là lớp trách nhiệm giải trình: đăng ký
// dự án, mời người, nộp file, đẩy snapshot, cấp gói… mỗi hành động một
// dòng JSONL append-only trong volume. NĐ 06/2021 hỏi "ai đổi cái gì,
// khi nào" — bảng này là câu trả lời phía nền tảng.
//
// Best-effort như audit của Atlas: ghi log hỏng KHÔNG được làm hỏng hành
// động chính. File xoay ở 5 MB (một bản .1 giữ lại) — nhật ký vô hạn trên
// một relay zero-dep là đĩa đầy chậm rãi.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "users",
  "audit.jsonl",
);

const ROTATE_BYTES = 5 * 1024 * 1024;

export function createAudit({ path = DEFAULT_PATH } = {}) {
  return {
    /** Ghi một sự kiện — nuốt lỗi, hành động chính không được chết vì log. */
    log(event) {
      try {
        mkdirSync(dirname(path), { recursive: true });
        if (existsSync(path) && statSync(path).size > ROTATE_BYTES) {
          renameSync(path, `${path}.1`);
        }
        appendFileSync(
          path,
          JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n",
        );
      } catch (error) {
        console.error("[webim] audit write failed:", error?.message ?? error);
      }
    },

    /** Sự kiện gần nhất của một dự án, mới trước. */
    forProject(projectId, limit = 100) {
      return this.recent(5000)
        .filter((event) => event.projectId === projectId)
        .slice(0, limit);
    },

    /** Sự kiện gần nhất toàn hệ thống, mới trước (admin). */
    recent(limit = 200) {
      const lines = [];
      for (const file of [`${path}.1`, path]) {
        if (!existsSync(file)) continue;
        lines.push(...readFileSync(file, "utf8").split("\n").filter(Boolean));
      }
      const events = [];
      for (const line of lines.slice(-limit * 2)) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // dòng cụt do rớt điện giữa chừng — bỏ, không chết
        }
      }
      return events.reverse().slice(0, limit);
    },
  };
}

/**
 * Số liệu sản phẩm TỪ CHÍNH audit log — không nhúng tracker bên thứ ba
 * (quyết định trong ROADMAP: dữ liệu server-side đã có là đủ, hợp khẩu vị
 * khách xây dựng VN và khỏi cần privacy policy phức tạp).
 *
 * Hàm thuần trên mảng events để test được không cần file.
 */
export function summarizeEvents(events, now = Date.now()) {
  const DAY = 86_400_000;
  const inWindow = (event, days) => {
    const at = Date.parse(event.at);
    return Number.isFinite(at) && now - at <= days * DAY;
  };
  const window = (days) => {
    const slice = events.filter((event) => inWindow(event, days));
    const by = (action) => slice.filter((event) => event.action === action);
    return {
      activeUsers: new Set(
        slice
          .filter((event) => event.action !== "auth.login_failed")
          .map((event) => event.user),
      ).size,
      registers: by("auth.register").length,
      claims: by("project.claim").length,
      uploads: by("file.put").length,
      renders: by("ai.render").length,
      loginFailures: by("auth.login_failed").length,
    };
  };

  // Activation: người đăng ký trong 30 ngày qua có ÍT NHẤT một hành động
  // tạo giá trị (claim hoặc nộp file) trong 7 ngày sau khi đăng ký.
  const registered = events.filter(
    (event) => event.action === "auth.register" && inWindow(event, 30),
  );
  let activated = 0;
  for (const registration of registered) {
    const start = Date.parse(registration.at);
    const acted = events.some(
      (event) =>
        event.user === registration.user &&
        (event.action === "project.claim" || event.action === "file.put") &&
        Date.parse(event.at) >= start &&
        Date.parse(event.at) <= start + 7 * DAY,
    );
    if (acted) activated += 1;
  }

  return {
    last7d: window(7),
    last30d: window(30),
    activation: {
      registered30d: registered.length,
      activated,
      rate: registered.length ? Math.round((activated / registered.length) * 100) : null,
    },
  };
}
