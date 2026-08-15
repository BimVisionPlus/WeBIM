// Phân quyền theo dự án — kiểm CƯỠNG CHẾ ở máy chủ: HTTP file, danh sách,
// WebSocket sync. Bất biến: dự án đã đăng ký thì người ngoài không đọc,
// không ghi, không nhận frame — dù họ là editor toàn cục.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRelay } from "../relay/server.mjs";
import { createAuth, hashEntry } from "../relay/auth.mjs";
import { createMembers } from "../relay/members.mjs";
import { createStorage } from "../relay/storage.mjs";
import type { WebSocketServer } from "ws";

let server: WebSocketServer;
let port: number;
let dir: string;
let tokens: Record<string, string>;

const api = (path: string, init?: RequestInit) =>
  fetch(`http://127.0.0.1:${port}${path}`, init);

const asUser = (user: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${tokens[user]}`,
  ...extra,
});

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "webim-members-"));
  const usersPath = join(dir, "users.json");
  writeFileSync(
    usersPath,
    JSON.stringify({
      users: [
        hashEntry("pw", { username: "chu", role: "editor" }),
        hashEntry("pw", { username: "thanhvien", role: "editor" }),
        hashEntry("pw", { username: "nguoingoai", role: "editor" }),
        hashEntry("pw", { username: "xem", role: "viewer" }),
      ],
    }),
  );
  const auth = createAuth({ usersPath, secret: "test-secret" });
  const members = createMembers({ path: join(dir, "memberships.json") });
  const storage = createStorage(join(dir, "data"));
  server = startRelay(0, { auth, members, storage }) as unknown as WebSocketServer;
  const httpServer = (server as unknown as { httpServer: import("node:http").Server })
    .httpServer;
  if (!httpServer.listening) {
    await new Promise((resolve) => httpServer.once("listening", resolve));
  }
  port = (httpServer.address() as { port: number }).port;

  tokens = {};
  for (const user of ["chu", "thanhvien", "nguoingoai", "xem"]) {
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

describe("đăng ký và quản lý thành viên", () => {
  it("claim tạo chủ dự án; claim lần hai bị từ chối", async () => {
    const first = await api("/projects/duanA/claim", {
      method: "POST",
      headers: asUser("chu"),
    });
    expect(first.status).toBe(200);
    const second = await api("/projects/duanA/claim", {
      method: "POST",
      headers: asUser("nguoingoai"),
    });
    expect(second.status).toBe(409);
  });

  it("chỉ chủ dự án mời được thành viên; tài khoản phải tồn tại", async () => {
    const byOutsider = await api("/projects/duanA/members", {
      method: "PUT",
      headers: asUser("nguoingoai", { "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "thanhvien", role: "editor" }),
    });
    expect(byOutsider.status).toBe(403);

    const ghost = await api("/projects/duanA/members", {
      method: "PUT",
      headers: asUser("chu", { "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "khongco", role: "editor" }),
    });
    expect(ghost.status).toBe(400);

    const ok = await api("/projects/duanA/members", {
      method: "PUT",
      headers: asUser("chu", { "Content-Type": "application/json" }),
      body: JSON.stringify({ username: "thanhvien", role: "editor" }),
    });
    expect(ok.status).toBe(200);

    const info = (await (
      await api("/projects/duanA/members", { headers: asUser("chu") })
    ).json()) as { owner: string; members: Record<string, string>; you: { role: string } };
    expect(info.owner).toBe("chu");
    expect(info.members.thanhvien).toBe("editor");
    expect(info.you.role).toBe("owner");
  });
});

describe("file theo dự án", () => {
  it("người ngoài không ghi/đọc được file dự án đã đăng ký; thành viên thì được", async () => {
    const put = (user: string, key: string) =>
      api(`/files/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: asUser(user),
        body: "noi dung",
      });

    expect((await put("thanhvien", "duanA/doc1/v1.pdf")).status).toBe(200);
    expect((await put("nguoingoai", "duanA/doc1/hack.pdf")).status).toBe(403);

    const read = (user: string) =>
      api(`/files/${encodeURIComponent("duanA/doc1/v1.pdf")}`, {
        headers: asUser(user),
      });
    expect((await read("chu")).status).toBe(200);
    expect((await read("nguoingoai")).status).toBe(403);
  });

  it("dự án chưa đăng ký giữ chế độ mở (role toàn cục)", async () => {
    const put = await api(`/files/${encodeURIComponent("duanMo/doc/v1.pdf")}`, {
      method: "PUT",
      headers: asUser("nguoingoai"),
      body: "x",
    });
    expect(put.status).toBe(200);
    // viewer toàn cục vẫn không ghi được vào dự án mở
    const viewerPut = await api(`/files/${encodeURIComponent("duanMo/doc/v2.pdf")}`, {
      method: "PUT",
      headers: asUser("xem"),
      body: "x",
    });
    expect(viewerPut.status).toBe(403);
  });

  it("/list không lộ tên file dự án riêng cho người ngoài", async () => {
    const mine = (await (
      await api("/list?prefix=", { headers: asUser("thanhvien") })
    ).json()) as { files: { key: string }[] };
    expect(mine.files.some((file) => file.key.startsWith("duanA/"))).toBe(true);

    const theirs = (await (
      await api("/list?prefix=", { headers: asUser("nguoingoai") })
    ).json()) as { files: { key: string }[] };
    expect(theirs.files.some((file) => file.key.startsWith("duanA/"))).toBe(false);
    expect(theirs.files.some((file) => file.key.startsWith("duanMo/"))).toBe(true);
  });
});

describe("WebSocket theo dự án", () => {
  const connect = (user: string) =>
    new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${tokens[user]}`);
      socket.on("open", () => resolve(socket));
      socket.on("error", reject);
    });

  it("frame của dự án đã đăng ký chỉ tới thành viên", async () => {
    const sender = await connect("thanhvien");
    const memberPeer = await connect("chu");
    const outsider = await connect("nguoingoai");

    const received: string[] = [];
    const leaked: string[] = [];
    memberPeer.on("message", (data) => received.push(data.toString()));
    outsider.on("message", (data) => leaked.push(data.toString()));

    sender.send(
      JSON.stringify({ type: "sync", projectId: "duanA", clientId: "c1", payload: 1 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received.length).toBe(1);
    expect(leaked.length).toBe(0);

    for (const socket of [sender, memberPeer, outsider]) socket.close();
  });

  it("người ngoài gửi frame vào dự án đã đăng ký thì frame bị nuốt", async () => {
    const outsider = await connect("nguoingoai");
    const member = await connect("chu");
    const received: string[] = [];
    member.on("message", (data) => received.push(data.toString()));

    outsider.send(
      JSON.stringify({ type: "sync", projectId: "duanA", clientId: "c2", payload: 2 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received.length).toBe(0);

    outsider.close();
    member.close();
  });
});
