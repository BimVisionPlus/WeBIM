// Authentication + role-based authorization for the platform server.
//
// Users live in relay/users.json (gitignored):
//   { "users": [{ "username": "sophie", "role": "admin",
//                 "salt": "<hex>", "hash": "<scrypt hex>" }] }
// Generate an entry with:  node relay/auth.mjs hash <password>
//
// When users.json is absent the server runs in OPEN mode (dev): every
// request is treated as an anonymous editor and a warning is logged.
// Roles: admin ≥ editor ≥ viewer. Viewers can read files and receive
// sync, but their file writes and model-sync frames are rejected —
// enforced server-side, not just in the UI.

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROLE_RANK = { viewer: 0, editor: 1, admin: 2 };
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function createAuth({ usersPath, secret } = {}) {
  const resolvedPath =
    usersPath ?? join(dirname(fileURLToPath(import.meta.url)), "users.json");
  const enabled = existsSync(resolvedPath);
  const users = enabled
    ? JSON.parse(readFileSync(resolvedPath, "utf8")).users
    : [];
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
