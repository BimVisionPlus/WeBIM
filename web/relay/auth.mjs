// Authentication + role-based authorization for the platform server.
//
// Tài khoản sống ở HAI tầng (quyết định C3, docs/KIEN-TRUC.md):
//   - relay/users.json (ro, gitignored) — seed do quản trị viên đặt tay.
//   - relay/users/accounts.json (volume GHI ĐƯỢC) — nguồn sự thật sống:
//     đăng ký mới, đổi mật khẩu, đổi role đều ghi vào đây (tmp+rename).
//     Lần đầu chạy, accounts.json được nhân giống từ users.json.
// Generate a seed entry with:  node relay/auth.mjs hash <password>
//
// Không có file nào tồn tại = OPEN mode (dev): mọi request là anonymous
// editor, có cảnh báo. Roles: admin ≥ editor ≥ viewer — cưỡng chế phía
// server, không phải chỉ ẩn nút.

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2 };
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function createAuth({ usersPath, accountsPath, secret } = {}) {
  const seedPath =
    usersPath ?? join(dirname(fileURLToPath(import.meta.url)), "users.json");
  const livePath =
    accountsPath ??
    join(dirname(fileURLToPath(import.meta.url)), "users", "accounts.json");

  // accounts.json (ghi được) là nguồn sự thật; users.json chỉ là seed —
  // lần đầu chạy thì nhân giống, các lần sau seed không đè lên thay đổi
  // sống (đổi mật khẩu, tài khoản mới) nữa.
  let users = [];
  if (existsSync(livePath)) {
    users = JSON.parse(readFileSync(livePath, "utf8")).users ?? [];
  } else if (existsSync(seedPath)) {
    users = JSON.parse(readFileSync(seedPath, "utf8")).users ?? [];
  }
  const enabled = users.length > 0;

  const persist = () => {
    mkdirSync(dirname(livePath), { recursive: true });
    const tmp = `${livePath}.tmp`;
    writeFileSync(tmp, JSON.stringify({ users }, null, 2));
    renameSync(tmp, livePath);
  };
  // Chạy với seed lần đầu thì ghi ngay bản sống — từ đây accounts.json là chủ.
  if (enabled && !existsSync(livePath)) persist();
  const signingSecret =
    secret ?? process.env.WEBIM_SECRET ?? randomBytes(32).toString("hex");

  const sign = (payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const mac = createHmac("sha256", signingSecret).update(body).digest("base64url");
    return `${body}.${mac}`;
  };

  return {
    enabled,

    /** Máy chủ có biết username này không — để mời thành viên khỏi gõ nhầm. */
    userExists(username) {
      if (!enabled) return true;
      return users.some((candidate) => candidate.username === username);
    },

    /**
     * Tự đăng ký. Tài khoản mới là EDITOR toàn cục — đủ để tạo và đăng ký
     * dự án riêng tư của mình; dự án của người khác vẫn chặn theo thành
     * viên. Lỗi trả về là chuỗi tiếng Việt cho UI dùng thẳng.
     */
    register(username, password) {
      if (!USERNAME_RE.test(username ?? "")) {
        throw new Error(
          "Tên đăng nhập: 3–32 ký tự thường a-z, số, dấu chấm/gạch, bắt đầu bằng chữ hoặc số.",
        );
      }
      if ((password ?? "").length < 8) {
        throw new Error("Mật khẩu cần ít nhất 8 ký tự.");
      }
      if (users.some((candidate) => candidate.username === username)) {
        throw new Error("Tên đăng nhập đã có người dùng.");
      }
      users.push(hashEntry(password, { username, role: "editor" }));
      persist();
      return this.login(username, password);
    },

    /** Đổi mật khẩu — phải chứng minh biết mật khẩu cũ, kể cả khi đã có token. */
    changePassword(username, oldPassword, newPassword) {
      if (!this.login(username, oldPassword)) {
        throw new Error("Mật khẩu hiện tại không đúng.");
      }
      if ((newPassword ?? "").length < 8) {
        throw new Error("Mật khẩu mới cần ít nhất 8 ký tự.");
      }
      const index = users.findIndex((candidate) => candidate.username === username);
      const fresh = hashEntry(newPassword, {
        username,
        role: users[index].role,
      });
      users[index] = fresh;
      persist();
    },

    /** Admin đổi role người khác. Không tự hạ admin cuối cùng. */
    setRole(username, role) {
      if (!(role in ROLE_RANK)) throw new Error("Role không hợp lệ.");
      const user = users.find((candidate) => candidate.username === username);
      if (!user) throw new Error(`Không có tài khoản "${username}".`);
      const adminCount = users.filter((candidate) => candidate.role === "admin").length;
      if (user.role === "admin" && role !== "admin" && adminCount <= 1) {
        throw new Error("Không thể hạ quyền admin cuối cùng.");
      }
      user.role = role;
      persist();
    },

    login(username, password) {
      const user = users.find((candidate) => candidate.username === username);
      if (!user) return null;
      const hash = scryptSync(password, Buffer.from(user.salt, "hex"), 32);
      const stored = Buffer.from(user.hash, "hex");
      if (hash.length !== stored.length || !timingSafeEqual(hash, stored)) {
        return null;
      }
      return {
        token: sign({ u: user.username, r: user.role, e: Date.now() + TOKEN_TTL_MS }),
        username: user.username,
        role: user.role,
      };
    },

    /** Returns {username, role} or null. Open mode: anonymous editor. */
    verify(token) {
      if (!enabled) return { username: "anonymous", role: "editor" };
      if (!token) return null;
      const [body, mac] = token.split(".");
      if (!body || !mac) return null;
      const expected = createHmac("sha256", signingSecret)
        .update(body)
        .digest("base64url");
      const macBuffer = Buffer.from(mac);
      const expectedBuffer = Buffer.from(expected);
      if (
        macBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(macBuffer, expectedBuffer)
      ) {
        return null;
      }
      try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString());
        if (payload.e < Date.now()) return null;
        return { username: payload.u, role: payload.r };
      } catch {
        return null;
      }
    },

    allows(identity, requiredRole) {
      if (!identity) return false;
      return (ROLE_RANK[identity.role] ?? -1) >= ROLE_RANK[requiredRole];
    },
  };
}

/**
 * Một mục users.json cho mật khẩu này. Tách ra khỏi khối CLI vì test cần
 * dựng người dùng thật — băm lại bằng tay trong test là băm bằng một cách
 * khác với cách server đọc, và cái sai đó sẽ không lộ ra ở đâu cả.
 */
export function hashEntry(password, { username = "CHANGE_ME", role = "editor" } = {}) {
  const salt = randomBytes(16);
  return {
    username,
    role,
    salt: salt.toString("hex"),
    hash: scryptSync(password, salt, 32).toString("hex"),
  };
}

/** Build a users.json entry: node relay/auth.mjs hash <password> */
const isMain =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain && process.argv[2] === "hash") {
  const password = process.argv[3];
  if (!password) {
    console.error("usage: node relay/auth.mjs hash <password>");
    process.exit(1);
  }
  console.log(JSON.stringify(hashEntry(password), null, 2));
}
