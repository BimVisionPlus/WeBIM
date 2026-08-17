// Organization/workspace — quyền lan từ org xuống dự án, per-project thắng.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRelay } from "../relay/server.mjs";
import { createAuth, hashEntry } from "../relay/auth.mjs";
import { createMembers } from "../relay/members.mjs";
import { createOrgs } from "../relay/orgs.mjs";
import { createStorage } from "../relay/storage.mjs";
// @ts-expect-error — module .mjs không có type declarations
import { createAudit } from "../relay/audit.mjs";
import type { WebSocketServer } from "ws";

let server: WebSocketServer;
let port: number;
let dir: string;
let tokens: Record<string, string> = {};
let orgId: string;

const api = (path: string, init?: RequestInit) =>
  fetch(`http://127.0.0.1:${port}${path}`, init);
const asUser = (user: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${tokens[user]}`,
  ...extra,
});

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "webim-orgs-"));
  writeFileSync(
    join(dir, "users.json"),
    JSON.stringify({
      users: [
        hashEntry("pw", { username: "giam.doc", role: "editor" }),
        hashEntry("pw", { username: "ky.su", role: "editor" }),
        hashEntry("pw", { username: "ky.su.2", role: "editor" }),
        hashEntry("pw", { username: "ngoai", role: "editor" }),
      ],
    }),
  );
  const auth = createAuth({
    usersPath: join(dir, "users.json"),
    accountsPath: join(dir, "accounts.json"),
    secret: "test-secret",
  });
  const orgs = createOrgs({ path: join(dir, "orgs.json") });
  const members = createMembers({ path: join(dir, "memberships.json"), orgs });
  const storage = createStorage(join(dir, "data"));
  const audit = createAudit({ path: join(dir, "audit.jsonl") });
  // giam.doc cần Team: test này claim 2 dự án riêng (hạn mức free = 1).
  auth.setPlan("giam.doc", "team", 12);
  server = startRelay(0, { auth, members, orgs, storage, audit }) as unknown as WebSocketServer;
  const httpServer = (server as unknown as { httpServer: import("node:http").Server })
    .httpServer;
  if (!httpServer.listening) {
    await new Promise((resolve) => httpServer.once("listening", resolve));
  }
  port = (httpServer.address() as { port: number }).port;
  for (const user of ["giam.doc", "ky.su", "ky.su.2", "ngoai"]) {
    const response = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: user, password: "pw" }),
    });
    tokens[user] = ((await response.json()) as { token: string }).token;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

describe("vòng đời tổ chức", () => {
  it("tạo org, mời thành viên, danh sách org của tôi", async () => {
    const created = await api("/orgs", {
      method: "POST",
      headers: asUser("giam.doc", { "Content-Type": "application/json" }),
      body: JSON.stringify({ name: "Cty Kiến trúc ABC" }),
    });
    expect(created.status).toBe(200);
    orgId = ((await created.json()) as { id: string }).id;

    for (const [user, role] of [["ky.su", "member"], ["ky.su.2", "member"]] as const) {
      const invited = await api(`/orgs/${orgId}/members`, {
        method: "PUT",
        headers: asUser("giam.doc", { "Content-Type": "application/json" }),
        body: JSON.stringify({ username: user, role }),
      });
      expect(invited.status).toBe(200);
    }

    const mine = (await (
      await api("/orgs", { headers: asUser("ky.su") })
    ).json()) as { orgs: { id: string; role: string }[] };
    expect(mine.orgs).toHaveLength(1);
    expect(mine.orgs[0].role).toBe("member");
  });

  it("member thường không mời được người; người ngoài không xem được org", async () => {
    const denied = await api(`/orgs/${orgId}/members`, {
      method: "PUT",
      headers: asUser("ky.su", { "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "ngoai", role: "member" }),
    });
    expect(denied.status).toBe(403);
    expect((await api(`/orgs/${orgId}/members`, { headers: asUser("ngoai") })).status).toBe(403);
  });
});

describe("quyền lan từ org xuống dự án", () => {
  it("claim dự án vào org → member org sửa được KHÔNG cần mời riêng", async () => {
    const claim = await api("/projects/duan-org/claim", {
      method: "POST",
      headers: asUser("giam.doc", { "Content-Type": "application/json" }),
      body: JSON.stringify({ orgId }),
    });
    expect(claim.status).toBe(200);

    // ky.su chưa từng được mời per-project — nhưng là member org
    const put = await api(`/files/${encodeURIComponent("duan-org/tl/v1.pdf")}`, {
      method: "PUT",
      headers: asUser("ky.su"),
      body: "x",
    });
    expect(put.status).toBe(200);

    // người ngoài org vẫn chặn
    const outsider = await api(`/files/${encodeURIComponent("duan-org/tl/hack.pdf")}`, {
      method: "PUT",
      headers: asUser("ngoai"),
      body: "x",
    });
    expect(outsider.status).toBe(403);
  });

  it("per-project viewer THẮNG org-default editor cho đúng người đó", async () => {
    const demote = await api("/projects/duan-org/members", {
      method: "PUT",
      headers: asUser("giam.doc", { "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "ky.su.2", role: "viewer" }),
    });
    expect(demote.status).toBe(200);

    const denied = await api(`/files/${encodeURIComponent("duan-org/tl/v2.pdf")}`, {
      method: "PUT",
      headers: asUser("ky.su.2"),
      body: "x",
    });
    expect(denied.status).toBe(403);
    // nhưng vẫn ĐỌC được (viewer)
    const read = await api(`/files/${encodeURIComponent("duan-org/tl/v1.pdf")}`, {
      headers: asUser("ky.su.2"),
    });
    expect(read.status).toBe(200);
    // và ky.su (member không bị hạ) vẫn editor
    const still = await api(`/files/${encodeURIComponent("duan-org/tl/v3.pdf")}`, {
      method: "PUT",
      headers: asUser("ky.su"),
      body: "x",
    });
    expect(still.status).toBe(200);
  });

  it("gắn dự án có sẵn vào org bằng PUT /projects/:id/org", async () => {
    await api("/projects/duan-le/claim", {
      method: "POST",
      headers: asUser("giam.doc"),
    });
    const assign = await api("/projects/duan-le/org", {
      method: "PUT",
      headers: asUser("giam.doc", { "Content-Type": "application/json" }),
      body: JSON.stringify({ orgId }),
    });
    expect(assign.status).toBe(200);
    const info = (await (
      await api("/projects/duan-le/members", { headers: asUser("ky.su") })
    ).json()) as { org?: { name: string }; you: { role: string } };
    expect(info.org?.name).toBe("Cty Kiến trúc ABC");
    expect(info.you.role).toBe("editor");
  });
});
