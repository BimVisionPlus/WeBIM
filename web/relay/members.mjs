// Thành viên & phân quyền THEO TỪNG DỰ ÁN.
//
// users.json trả lời "bạn là ai" (danh tính + role toàn cục); file này trả
// lời "bạn được làm gì TRONG DỰ ÁN NÀO". Trục của sản phẩm là dự án, nên
// quyền cũng phải xoay quanh dự án: một kỹ sư là editor ở dự án A hoàn toàn
// có thể chỉ là viewer — hoặc không là gì cả — ở dự án B.
//
// Mô hình cố ý nhỏ:
//   - Dự án CHƯA ĐĂNG KÝ = chế độ mở như trước giờ (role toàn cục quyết
//     định) — demo và người dùng mới không bị tường chắn.
//   - "Đăng ký" một dự án tạo bản ghi {owner, members}; từ lúc đó CHỈ chủ
//     dự án, thành viên được mời, và admin toàn cục chạm được vào nó —
//     sync, file, tất cả — chặn ở server chứ không phải chỉ ẩn nút.
//   - Chủ dự án mời/đổi/xoá thành viên với role editor|viewer.
//
// Lưu ở relay/users/memberships.json (volume ghi được, sống qua deploy);
// ghi kiểu tmp+rename để một lần rớt điện không để lại file JSON cụt.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "users",
  "memberships.json",
);

const MEMBER_ROLES = new Set(["editor", "viewer"]);

export function createMembers({ path = DEFAULT_PATH } = {}) {
  let projects = {};
  if (existsSync(path)) {
    try {
      projects = JSON.parse(readFileSync(path, "utf8")).projects ?? {};
    } catch {
      // File hỏng thì thà chạy như chưa đăng ký gì còn hơn sập cả relay —
      // nhưng phải nói ra, vì "mọi dự án bỗng mở toang" là sự kiện an ninh.
      console.error(`[webim] memberships.json hỏng — bỏ qua (${path})`);
      projects = {};
    }
  }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify({ projects }, null, 2));
    renameSync(tmp, path);
  };

  return {
    /** Bản ghi dự án hoặc null nếu chưa đăng ký (chế độ mở). */
    get(projectId) {
      return projects[projectId] ?? null;
    },

    /**
     * Quyền hiệu dụng của một danh tính trong một dự án.
     * Trả {scope: "open", role: <role toàn cục>} khi dự án chưa đăng ký;
     * {scope: "project", role: "owner"|"editor"|"viewer"|null} khi đã đăng
     * ký — null nghĩa là KHÔNG có quyền gì, kể cả đọc.
     */
    effectiveRole(identity, projectId) {
      if (!identity) return { scope: "open", role: null };
      const record = projects[projectId];
      if (!record) return { scope: "open", role: identity.role };
      if (identity.role === "admin" || record.owner === identity.username) {
        return { scope: "project", role: "owner" };
      }
      return { scope: "project", role: record.members[identity.username] ?? null };
    },

    /** Số dự án một người đang làm chủ — thước đo hạn mức gói (C4). */
    countOwned(username) {
      return Object.values(projects).filter((record) => record.owner === username).length;
    },

    /** Đăng ký dự án — người gọi thành chủ. Lỗi nếu đã có chủ. */
    claim(projectId, identity) {
      if (!projectId || !identity) throw new Error("Cần đăng nhập.");
      if (projects[projectId]) {
        throw new Error("Dự án đã được đăng ký rồi.");
      }
      projects[projectId] = { owner: identity.username, members: {} };
      persist();
      return projects[projectId];
    },

    /** Thêm/đổi role một thành viên — chỉ chủ dự án hoặc admin toàn cục. */
    setMember(projectId, actor, username, role) {
      const record = projects[projectId];
      if (!record) throw new Error("Dự án chưa đăng ký.");
      if (this.effectiveRole(actor, projectId).role !== "owner") {
        throw new Error("Chỉ chủ dự án mới quản lý được thành viên.");
      }
      if (!MEMBER_ROLES.has(role)) throw new Error("Role phải là editor hoặc viewer.");
      if (username === record.owner) {
        throw new Error("Chủ dự án không cần (và không thể) tự hạ quyền mình ở đây.");
      }
      record.members[username] = role;
      persist();
      return record;
    },

    removeMember(projectId, actor, username) {
      const record = projects[projectId];
      if (!record) throw new Error("Dự án chưa đăng ký.");
      if (this.effectiveRole(actor, projectId).role !== "owner") {
        throw new Error("Chỉ chủ dự án mới quản lý được thành viên.");
      }
      if (username === record.owner) throw new Error("Không thể xoá chủ dự án.");
      delete record.members[username];
      persist();
      return record;
    },
  };
}
