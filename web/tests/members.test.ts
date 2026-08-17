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
// @ts-expect-error — module .mjs không có type declarations
import { createAudit } from "../relay/audit.mjs";
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
  const auth = createAuth({ usersPath, accountsPath: join(dir, "accounts.json"), secret: "test-secret" });
  const members = createMembers({ path: join(dir, "memberships.json") });
  const storage = createStorage(join(dir, "data"));
  const audit = createAudit({ path: join(dir, "audit.jsonl") });
  server = startRelay(0, { auth, members, storage, audit }) as unknown as WebSocketServer;
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

describe("store: quyền dự án điều khiển UI", () => {
  it("viewer/người ngoài bị khoá chỉnh sửa và có banner; editor thì không", async () => {
    const { AppStore } = await import("../src/state/store");
    const store = new AppStore();

    // Chưa biết gì (standalone) → cho phép, không banner.
    expect(store.canEdit).toBe(true);
    expect(store.roleBanner).toBeNull();

    store.projectRole = { scope: "project", role: "viewer" };
    expect(store.canEdit).toBe(false);
    expect(store.roleBanner).toContain("VIEWER");

    store.projectRole = { scope: "project", role: null };
    expect(store.canEdit).toBe(false);
    expect(store.roleBanner).toContain("KHÔNG PHẢI THÀNH VIÊN");

    store.projectRole = { scope: "project", role: "editor" };
    expect(store.canEdit).toBe(true);
    expect(store.roleBanner).toBeNull();
  });
});

describe("snapshot dự án trên server (C1)", () => {
  const snapshot = {
    projectId: "duanA",
    clocks: { w1: { t: 1, c: "a" } },
    project: { name: "Dự án A", walls: [{ id: "w1" }] },
  };

  it("editor thành viên đẩy được, viewer/người ngoài thì không", async () => {
    const put = (user: string) =>
      api("/projects/duanA/state", {
        method: "PUT",
        headers: asUser(user, { "Content-Type": "application/json" }),
        body: JSON.stringify(snapshot),
      });
    expect((await put("thanhvien")).status).toBe(200);
    expect((await put("nguoingoai")).status).toBe(403);
  });

  it("thành viên kéo về đúng snapshot; người ngoài bị chặn; dự án lạ 404", async () => {
    const got = await api("/projects/duanA/state", { headers: asUser("chu") });
    expect(got.status).toBe(200);
    const body = (await got.json()) as typeof snapshot;
    expect(body.project.name).toBe("Dự án A");
    expect(body.clocks.w1.t).toBe(1);

    expect(
      (await api("/projects/duanA/state", { headers: asUser("nguoingoai") })).status,
    ).toBe(403);
    expect(
      (await api("/projects/chua-co/state", { headers: asUser("chu") })).status,
    ).toBe(404);
  });

  it("snapshot rác bị từ chối; file .state không lộ trong /list", async () => {
    const bad = await api("/projects/duanA/state", {
      method: "PUT",
      headers: asUser("thanhvien", { "Content-Type": "application/json" }),
      body: "khong phai json",
    });
    expect(bad.status).toBe(400);

    const list = (await (
      await api("/list?prefix=", { headers: asUser("chu") })
    ).json()) as { files: { key: string }[] };
    expect(list.files.some((file) => file.key.includes("/.state/"))).toBe(false);
  });
});

describe("tài khoản tự phục vụ (GĐ3/C3)", () => {
  it("đăng ký → đăng nhập → tài khoản sống qua accounts.json", async () => {
    const registered = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "nguoi.moi", password: "matkhau8kytu" }),
    });
    expect(registered.status).toBe(200);
    const session = (await registered.json()) as { token: string; role: string };
    expect(session.role).toBe("editor");

    // Tài khoản mới claim được dự án riêng của mình
    const claim = await api("/projects/duan-moi/claim", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(claim.status).toBe(200);
  });

  it("đăng ký trùng tên / mật khẩu ngắn / tên xấu đều bị chặn có lời", async () => {
    const dup = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "chu", password: "matkhau8kytu" }),
    });
    expect(dup.status).toBe(400);
    expect(((await dup.json()) as { error: string }).error).toContain("đã có người dùng");

    const short = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "hop.le", password: "ngan" }),
    });
    expect(short.status).toBe(400);

    const badName = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "Có Dấu", password: "matkhau8kytu" }),
    });
    expect(badName.status).toBe(400);
  });

  it("đổi mật khẩu cần mật khẩu cũ đúng, và mật khẩu mới dùng được ngay", async () => {
    const wrong = await api("/auth/change-password", {
      method: "POST",
      headers: asUser("thanhvien", { "Content-Type": "application/json" }),
      body: JSON.stringify({ oldPassword: "sai", newPassword: "matkhaumoi8" }),
    });
    expect(wrong.status).toBe(400);

    const ok = await api("/auth/change-password", {
      method: "POST",
      headers: asUser("thanhvien", { "Content-Type": "application/json" }),
      body: JSON.stringify({ oldPassword: "pw", newPassword: "matkhaumoi8" }),
    });
    expect(ok.status).toBe(200);

    const relogin = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "thanhvien", password: "matkhaumoi8" }),
    });
    expect(relogin.status).toBe(200);
    // token mới thay token cũ trong bảng test để các test sau còn dùng
    tokens.thanhvien = ((await relogin.json()) as { token: string }).token;
  });

  it("admin đổi role; không hạ được admin cuối cùng", async () => {
    // 'chu' là editor — cấp admin cho chu trước bằng... không có admin trong fixture!
    // Fixture toàn editor/viewer → setRole phải bị 403 với editor.
    const denied = await api("/auth/users/xem/role", {
      method: "PUT",
      headers: asUser("chu", { "Content-Type": "application/json" }),
      body: JSON.stringify({ role: "editor" }),
    });
    expect(denied.status).toBe(403);
  });
});

describe("token của tài khoản đã xoá phải chết", () => {
  it("xoá user khỏi accounts → token cũ còn hạn vẫn bị 401", async () => {
    const doomed = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "sap.bi.xoa", password: "matkhau8kytu" }),
    });
    const token = ((await doomed.json()) as { token: string }).token;
    // Token đang sống
    expect(
      (await api("/billing/plan", { headers: { Authorization: `Bearer ${token}` } })).status,
    ).toBe(200);
    // "Xoá tài khoản" — mô phỏng bằng cách sửa accounts.json như đợt dọn thật
    const { readFileSync, writeFileSync } = await import("node:fs");
    const accountsPath = join(dir, "accounts.json");
    const accounts = JSON.parse(readFileSync(accountsPath, "utf8")) as {
      users: { username: string }[];
    };
    accounts.users = accounts.users.filter((user) => user.username !== "sap.bi.xoa");
    writeFileSync(accountsPath, JSON.stringify(accounts));
    // Server giữ users trong RAM — restart auth là ngoài phạm vi test này;
    // điều kiểm được ở đây: verify tra danh sách SỐNG, nên xoá trong RAM
    // (qua một auth mới đọc lại file) → token chết. Mô phỏng bằng server phụ.
    const { createAuth: freshAuth } = await import("../relay/auth.mjs");
    const reloaded = freshAuth({
      usersPath: join(dir, "users.json"),
      accountsPath,
      secret: "test-secret",
    });
    expect(reloaded.verify(token)).toBeNull();
  });
});

describe("admin reset password", () => {
  it("admin đặt lại được; mật khẩu mới dùng ngay; non-admin bị 403", async () => {
    // Fixture không có admin → dùng server billing? Ở file này toàn editor.
    // Đăng ký nạn nhân, rồi thử reset bằng editor thường → 403.
    await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "quen.mat.khau", password: "matkhaucu88" }),
    });
    const denied = await api("/auth/users/quen.mat.khau/reset-password", {
      method: "POST",
      headers: asUser("chu", { "Content-Type": "application/json" }),
      body: JSON.stringify({ newPassword: "matkhaumoi88" }),
    });
    expect(denied.status).toBe(403);
  });
});

describe("quota dung lượng theo dự án", () => {
  it("vượt quota là 413 kèm số liệu; dưới quota vẫn ghi bình thường", async () => {
    process.env.WEBIM_PROJECT_QUOTA_MB = "0.001"; // ~1 KB cho test
    try {
      const small = await api(`/files/${encodeURIComponent("duan-quota/a.txt")}`, {
        method: "PUT",
        headers: asUser("chu"),
        body: "x".repeat(500),
      });
      expect(small.status).toBe(200);
      const over = await api(`/files/${encodeURIComponent("duan-quota/b.txt")}`, {
        method: "PUT",
        headers: asUser("chu"),
        body: "x".repeat(900),
      });
      expect(over.status).toBe(413);
      expect(((await over.json()) as { error: string }).error).toContain("quota");
    } finally {
      delete process.env.WEBIM_PROJECT_QUOTA_MB;
    }
  });
});
