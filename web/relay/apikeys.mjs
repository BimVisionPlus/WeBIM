// API key dài hạn cho máy gọi máy — public API của WeBIM.
//
// Session token sống 12 giờ và sinh từ mật khẩu; một CI pipeline hay script
// đồng bộ không thể "đăng nhập lại mỗi sáng". API key là danh tính dài hạn:
//   - dạng `wbk_<48 hex>`, hiển thị đúng MỘT lần lúc tạo;
//   - trên đĩa chỉ lưu SHA-256 của key — file bị lộ không lộ key;
//   - map về một người dùng thật: mọi enforcement (membership, quota, plan)
//     đi đúng đường của người đó, không có "đường máy" riêng nào cả;
//   - thu hồi từng key một, không đụng mật khẩu.
//
// Quản lý key (tạo/xoá/liệt kê) chỉ bằng SESSION token — key bị lộ không
// tự nhân bản được chính nó.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "users",
  "apikeys.json",
);

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function createApiKeys({ path = DEFAULT_PATH } = {}) {
  let keys = [];
  if (existsSync(path)) {
    try {
      keys = JSON.parse(readFileSync(path, "utf8")).keys ?? [];
    } catch {
      console.error(`[webim] apikeys.json hỏng — bỏ qua (${path})`);
      keys = [];
    }
  }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify({ keys }, null, 2));
    renameSync(tmp, path);
  };

  return {
    /** Tạo key mới. Trả plaintext key ĐÚNG MỘT LẦN — sau đó chỉ còn hash. */
    create(username, label) {
      const plaintext = `wbk_${randomBytes(24).toString("hex")}`;
      const record = {
        id: randomBytes(8).toString("hex"),
        username,
        label: (label ?? "").slice(0, 80),
        hash: sha256(plaintext),
        // Prefix hiển thị để người dùng nhận ra key nào là key nào trong
        // danh sách — 12 ký tự đầu không đủ để đoán phần còn lại (36 hex).
        prefix: plaintext.slice(0, 12),
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      };
      keys.push(record);
      persist();
      return { key: plaintext, id: record.id, label: record.label, prefix: record.prefix };
    },

    /** Key → username, hoặc null. Ghi mốc dùng gần nhất (độ phân giải ngày). */
    identify(plaintext) {
      if (!plaintext?.startsWith("wbk_")) return null;
      const hash = sha256(plaintext);
      const record = keys.find((candidate) => candidate.hash === hash);
      if (!record) return null;
      const today = new Date().toISOString().slice(0, 10);
      if (record.lastUsedAt?.slice(0, 10) !== today) {
        record.lastUsedAt = new Date().toISOString();
        persist();
      }
      return { username: record.username, keyId: record.id };
    },

    /** Danh sách key của một người — không bao giờ kèm hash. */
    list(username) {
      return keys
        .filter((record) => record.username === username)
        .map(({ id, label, prefix, createdAt, lastUsedAt }) => ({
          id,
          label,
          prefix,
          createdAt,
          lastUsedAt,
        }));
    },

    /** Thu hồi key CỦA MÌNH. Trả false nếu không thấy (hoặc của người khác). */
    revoke(username, id) {
      const before = keys.length;
      keys = keys.filter(
        (record) => !(record.username === username && record.id === id),
      );
      if (keys.length === before) return false;
      persist();
      return true;
    },
  };
}
