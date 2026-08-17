// TỔ CHỨC (organization/workspace) — lớp trên dự án.
//
// Trước đây quyền chỉ có theo TỪNG DỰ ÁN: mời từng người vào từng dự án.
// Đúng cho freelancer, sai cho công ty: một phòng thiết kế 12 người mở dự
// án mới là 12 lần mời. Org giải quyết đúng cái đó:
//
//   - Org có owner + members (role "admin" | "member").
//   - Dự án GẮN vào org thì mọi thành viên org tự có quyền: org-admin như
//     chủ dự án, org-member như editor. Không phải mời lại từng người.
//   - Mời per-project vẫn tồn tại và THẮNG org-default cho người đó —
//     hạ một member xuống viewer ở một dự án nhạy cảm vẫn làm được, và
//     khách ngoài org vẫn mời riêng như cũ.
//
// Lưu relay/users/orgs.json (volume, tmp+rename) — cùng triết lý C2:
// file cho tới khi đo được giới hạn thật.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const DEFAULT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "users",
  "orgs.json",
);

const ORG_ROLES = new Set(["admin", "member"]);

export function createOrgs({ path = DEFAULT_PATH } = {}) {
  let orgs = {};
  if (existsSync(path)) {
    try {
      orgs = JSON.parse(readFileSync(path, "utf8")).orgs ?? {};
    } catch {
      console.error(`[webim] orgs.json hỏng — bỏ qua (${path})`);
      orgs = {};
    }
  }

  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify({ orgs }, null, 2));
    renameSync(tmp, path);
  };

  const requireAdmin = (orgId, username) => {
    const org = orgs[orgId];
    if (!org) throw new Error("Không có tổ chức này.");
    if (org.owner !== username && org.members[username] !== "admin") {
      throw new Error("Chỉ owner/admin của tổ chức mới làm được việc này.");
    }
    return org;
  };

  return {
    get(orgId) {
      return orgs[orgId] ?? null;
    },

    /** Org mà một người thuộc về (owner hoặc member). */
    ofUser(username) {
      return Object.entries(orgs)
        .filter(([, org]) => org.owner === username || username in org.members)
        .map(([id, org]) => ({ id, name: org.name, role: this.roleIn(id, username) }));
    },

    /** "owner" | "admin" | "member" | null. */
    roleIn(orgId, username) {
      const org = orgs[orgId];
      if (!org) return null;
      if (org.owner === username) return "owner";
      return org.members[username] ?? null;
    },

    create(name, ownerUsername) {
      const trimmed = (name ?? "").trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        throw new Error("Tên tổ chức cần 2–80 ký tự.");
      }
      const id = randomBytes(8).toString("hex");
      orgs[id] = {
        name: trimmed,
        owner: ownerUsername,
        members: {},
        createdAt: new Date().toISOString(),
      };
      persist();
      return { id, ...orgs[id] };
    },

    setMember(orgId, actor, username, role) {
      const org = requireAdmin(orgId, actor);
      if (!ORG_ROLES.has(role)) throw new Error("Role phải là admin hoặc member.");
      if (username === org.owner) {
        throw new Error("Owner không cần role — và không thể tự hạ mình ở đây.");
      }
      org.members[username] = role;
      persist();
      return org;
    },

    removeMember(orgId, actor, username) {
      const org = requireAdmin(orgId, actor);
      if (username === org.owner) throw new Error("Không thể xoá owner của tổ chức.");
      delete org.members[username];
      persist();
      return org;
    },
  };
}
