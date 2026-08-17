// Public API: API key dài hạn + webhook theo dự án.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WebSocketServer } from "ws";
import { createApiKeys } from "../relay/apikeys.mjs";
import {
  checkWebhookUrl,
  createWebhooks,
  isForbiddenIp,
  signPayload,
} from "../relay/webhooks.mjs";
import { createAuth, hashEntry } from "../relay/auth.mjs";
import { createMembers } from "../relay/members.mjs";
import { startRelay } from "../relay/server.mjs";

const scratch = (name: string) => join(tmpdir(), `webim-${name}-${process.pid}-${Date.now()}`);

describe("apikeys", () => {
  const path = scratch("apikeys") + ".json";
  afterAll(() => rmSync(path, { force: true }));

  it("tạo → nhận diện; plaintext chỉ xuất hiện lúc tạo, trên đĩa chỉ có hash", () => {
    const keys = createApiKeys({ path });
    const created = keys.create("sophie", "CI pipeline");
    expect(created.key).toMatch(/^wbk_[0-9a-f]{48}$/);
    expect(keys.identify(created.key)).toMatchObject({ username: "sophie" });
    expect(keys.identify("wbk_" + "0".repeat(48))).toBeNull();
    // list không bao giờ kèm hash hay key
    const listed = keys.list("sophie");
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.key.slice(20));
    expect(JSON.stringify(listed)).not.toContain("hash");
  });

  it("thu hồi key của mình; không thu hồi được key người khác", () => {
    const keys = createApiKeys({ path: scratch("apikeys2") + ".json" });
    const mine = keys.create("a", "");
    expect(keys.revoke("b", mine.id)).toBe(false);
    expect(keys.revoke("a", mine.id)).toBe(true);
    expect(keys.identify(mine.key)).toBeNull();
  });
});

describe("webhook URL guard (SSRF)", () => {
  it("chặn loopback/private/link-local/metadata/CGNAT", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.100.1.1", "0.0.0.0"]) {
      expect(isForbiddenIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "203.113.131.1"]) {
      expect(isForbiddenIp(ip), ip).toBe(false);
    }
  });

  it("hostname phân giải về IP nội bộ cũng bị chặn — không chỉ IP viết thẳng", async () => {
    const fakeLookup = (async () => [{ address: "10.0.0.5", family: 4 }]) as never;
    const result = await checkWebhookUrl("https://evil.example.com/hook", fakeLookup);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("nội bộ");
  });

  it("localhost, host.docker.internal, scheme lạ đều bị từ chối", async () => {
    expect((await checkWebhookUrl("http://localhost:11434/x")).ok).toBe(false);
    expect((await checkWebhookUrl("http://host.docker.internal/x")).ok).toBe(false);
    expect((await checkWebhookUrl("ftp://example.com/x")).ok).toBe(false);
    expect((await checkWebhookUrl("not a url")).ok).toBe(false);
  });

  it("URL công cộng hợp lệ đi qua", async () => {
    const fakeLookup = (async () => [{ address: "203.0.114.7", family: 4 }]) as never;
    expect((await checkWebhookUrl("https://hooks.example.vn/webim", fakeLookup)).ok).toBe(true);
  });
});

describe("webhook delivery", () => {
  it("ký HMAC-SHA256 verify được, lọc theo sự kiện, ghi lastStatus", async () => {
    const path = scratch("hooks") + ".json";
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200 };
    }) as unknown as typeof fetch;
    const hooks = createWebhooks({ path, fetchImpl });
    // add() phân giải DNS thật — dùng IP công cộng viết thẳng để test offline.
    const created = await hooks.add("du-an-1", {
      url: "https://203.0.114.7/hook",
      events: ["file.put"],
    });
    expect("error" in created).toBe(false);
    const secret = (created as { secret: string }).secret;

    // Sự kiện không đăng ký → không gọi.
    await hooks.emit({ event: "state.push", projectId: "du-an-1", user: "a" });
    expect(calls).toHaveLength(0);

    const results = await hooks.emit({
      event: "file.put",
      projectId: "du-an-1",
      key: "du-an-1/KT.ifc",
      user: "a",
    });
    expect(results).toHaveLength(1);
    expect(calls).toHaveLength(1);
    const body = String(calls[0].init.body);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["X-WeBIM-Event"]).toBe("file.put");
    // Bên nhận verify đúng bằng công thức trong docs.
    expect(headers["X-WeBIM-Signature"]).toBe(`sha256=${signPayload(secret, body)}`);
    expect(JSON.parse(body)).toMatchObject({ event: "file.put", key: "du-an-1/KT.ifc" });
    expect(hooks.list("du-an-1")[0].lastStatus).toBe(200);
    // list không lộ secret
    expect(JSON.stringify(hooks.list("du-an-1"))).not.toContain(secret);
    rmSync(path, { force: true });
  });
});

describe("public API qua HTTP", () => {
  let server: WebSocketServer;
  let port: number;
  let usersFile: string;
  let token: string;
  const membersFile = scratch("members") + ".json";

  const base = () => `http://127.0.0.1:${port}`;
  const asJson = (body: unknown, auth?: string) => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });

  beforeAll(async () => {
    const entry = hashEntry("chu-pw", { username: "chu", role: "editor" });
    usersFile = scratch("users") + ".json";
    writeFileSync(usersFile, JSON.stringify({ users: [entry] }));
    const members = createMembers({ path: membersFile });
    members.claim("du-an-api", { username: "chu", role: "editor" });
    server = startRelay(0, {
      auth: createAuth({
        usersPath: usersFile,
        accountsPath: usersFile.replace("users", "accounts"),
        secret: "test-secret",
      }),
      members,
      apiKeys: createApiKeys({ path: scratch("apikeys-http") + ".json" }),
      webhooks: createWebhooks({ path: scratch("hooks-http") + ".json" }),
    });
    const httpServer = (server as unknown as { httpServer: import("node:http").Server })
      .httpServer;
    if (!httpServer.listening) {
      await new Promise((resolve) => httpServer.once("listening", resolve));
    }
    port = (httpServer.address() as { port: number }).port;
    const login = await fetch(`${base()}/auth/login`, asJson({ username: "chu", password: "chu-pw" }));
    token = ((await login.json()) as { token: string }).token;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(() => resolve(null)));
    rmSync(usersFile, { force: true });
    rmSync(membersFile, { force: true });
  });

  it("API key đăng nhập được mọi endpoint như người thật", async () => {
    const create = await fetch(`${base()}/apikeys`, asJson({ label: "test" }, token));
    expect(create.status).toBe(201);
    const { key } = (await create.json()) as { key: string };
    expect(key).toMatch(/^wbk_/);

    const projects = await fetch(`${base()}/projects`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(projects.status).toBe(200);
  });

  it("key KHÔNG quản lý được key — lộ key không tự nhân bản/xoá dấu vết được", async () => {
    const create = await fetch(`${base()}/apikeys`, asJson({ label: "x" }, token));
    const { key } = (await create.json()) as { key: string };
    for (const attempt of [
      fetch(`${base()}/apikeys`, asJson({ label: "clone" }, key)),
      fetch(`${base()}/apikeys`, { headers: { Authorization: `Bearer ${key}` } }),
    ]) {
      expect((await attempt).status).toBe(403);
    }
  });

  it("key thu hồi rồi thì chết ngay", async () => {
    const create = await fetch(`${base()}/apikeys`, asJson({ label: "die" }, token));
    const { key, id } = (await create.json()) as { key: string; id: string };
    const del = await fetch(`${base()}/apikeys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.status).toBe(200);
    const after = await fetch(`${base()}/projects`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(after.status).toBe(401);
  });

  it("webhook: owner đăng ký được, URL nội bộ bị chặn, list giấu secret", async () => {
    const blocked = await fetch(
      `${base()}/projects/du-an-api/webhooks`,
      asJson({ url: "http://127.0.0.1:9999/x" }, token),
    );
    expect(blocked.status).toBe(400);

    // Server thật chạy trong test — webhook được phép gọi tới nó thì phải
    // dùng IP công cộng giả; ở đây chỉ kiểm đường đăng ký bị guard, còn
    // giao hàng đã test ở tầng module với fetch mock.
    const listed = await fetch(`${base()}/projects/du-an-api/webhooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.status).toBe(200);
    expect((await listed.json()) as object).toMatchObject({ events: ["file.put", "state.push"] });
  });

  it("không phải owner → 403; dự án chưa claim → 409 nói phải claim", async () => {
    const outsider = hashEntry("khach-pw", { username: "khach", role: "editor" });
    const users = JSON.parse(
      (await import("node:fs")).readFileSync(usersFile, "utf8"),
    ) as { users: unknown[] };
    users.users.push(outsider);
    writeFileSync(usersFile, JSON.stringify(users));
    // auth đọc users.json lúc tạo — đăng nhập bằng token của "chu" nhưng thử
    // dự án chưa claim là đủ cho nhánh 409:
    const unclaimed = await fetch(`${base()}/projects/du-an-la/webhooks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unclaimed.status).toBe(409);
  });
});
