// Relay routing tests with real WebSocket connections.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startRelay } from "../relay/server.mjs";
import { createAuth, hashEntry } from "../relay/auth.mjs";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WebSocketServer } from "ws";

let server: WebSocketServer;
let port: number;

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.on("open", () => resolve(socket));
    socket.on("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString())));
  });
}

beforeAll(async () => {
  server = startRelay(0);
  const httpServer = (server as unknown as { httpServer: import("node:http").Server })
    .httpServer;
  if (!httpServer.listening) {
    await new Promise((resolve) => httpServer.once("listening", resolve));
  }
  port = (httpServer.address() as { port: number }).port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(() => resolve(null)));
});

describe("sync relay", () => {
  it("fans frames out to every other client, never the sender", async () => {
    const alice = await connect();
    const bob = await connect();
    const carol = await connect();
    const bobGot = nextMessage(bob);
    const carolGot = nextMessage(carol);
    let aliceEcho = false;
    alice.on("message", () => {
      aliceEcho = true;
    });
    alice.send(JSON.stringify({ type: "sync", clientId: "alice", projectId: "p1" }));
    expect(await bobGot).toMatchObject({ type: "sync", clientId: "alice" });
    expect(await carolGot).toMatchObject({ type: "sync", clientId: "alice" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(aliceEcho).toBe(false);
    alice.close();
    bob.close();
    carol.close();
  });

  it("broadcasts a synthetic leave when a client disconnects", async () => {
    const alice = await connect();
    const bob = await connect();
    // Register alice's clientId with her first frame.
    const bobFirst = nextMessage(bob);
    alice.send(JSON.stringify({ type: "presence", clientId: "alice", projectId: "p1" }));
    await bobFirst;
    const bobLeave = nextMessage(bob);
    alice.close();
    expect(await bobLeave).toEqual({ type: "leave", clientId: "alice" });
    bob.close();
  });

  it("drops malformed frames without crashing", async () => {
    const alice = await connect();
    const bob = await connect();
    const bobGot = nextMessage(bob);
    alice.send("not json{{{");
    alice.send(JSON.stringify({ type: "sync", clientId: "alice" }));
    expect(await bobGot).toMatchObject({ clientId: "alice" });
    alice.close();
    bob.close();
  });
});


describe("file storage API", () => {
  it("stores, lists and returns blobs under safe keys", async () => {
    const key = encodeURIComponent(`proj1/doc1/${Date.now()}-test.txt`);
    const put = await fetch(`http://127.0.0.1:${port}/files/${key}`, {
      method: "PUT",
      body: "hello CDE",
    });
    expect(put.status).toBe(200);
    const get = await fetch(`http://127.0.0.1:${port}/files/${key}`);
    expect(await get.text()).toBe("hello CDE");
    const list = await fetch(`http://127.0.0.1:${port}/list?prefix=proj1`);
    const body = (await list.json()) as { files: { key: string }[] };
    expect(body.files.some((file) => file.key.includes("test.txt"))).toBe(true);
  });

  it("rejects path traversal keys", async () => {
    const put = await fetch(
      `http://127.0.0.1:${port}/files/${encodeURIComponent("../escape.txt")}`,
      { method: "PUT", body: "nope" },
    );
    expect(put.status).toBe(400);
  });

  it("404s for missing files and reports health", async () => {
    const missing = await fetch(`http://127.0.0.1:${port}/files/none/missing.bin`);
    expect(missing.status).toBe(404);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect((await health.json()).ok).toBe(true);
  });
});

/**
 * "editor role required" từng được trả cho cả người chưa đăng nhập. Họ đi
 * tìm ai cấp quyền cho mình, trong khi việc phải làm là bấm Đăng nhập. Mã
 * HTTP đã phân biệt hai trường hợp; câu chữ phải nói theo.
 */
describe("từ chối vì thiếu quyền nói đúng nguyên nhân", () => {
  const ROUTES = ["/ai/read-drawing", "/ai/render-concept"];
  let authServer: WebSocketServer;
  let authPort: number;
  let usersFile: string;

  beforeAll(async () => {
    // Một users.json thật, vì auth chỉ bật khi tệp đó tồn tại.
    const entry = hashEntry("viewer-pw", { username: "xem", role: "viewer" });
    usersFile = join(tmpdir(), `webim-users-${Date.now()}.json`);
    writeFileSync(usersFile, JSON.stringify({ users: [entry] }));

    authServer = startRelay(0, {
      auth: createAuth({ usersPath: usersFile, accountsPath: usersFile.replace("users", "accounts"), secret: "test-secret" }),
    });
    const httpServer = (authServer as unknown as { httpServer: import("node:http").Server })
      .httpServer;
    if (!httpServer.listening) {
      await new Promise((resolve) => httpServer.once("listening", resolve));
    }
    authPort = (httpServer.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => authServer.close(() => resolve(null)));
    rmSync(usersFile, { force: true });
  });

  const post = (path: string, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${authPort}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: "{}",
    });

  it("chưa đăng nhập → 401 và nói là cần đăng nhập, không nói thiếu quyền", async () => {
    for (const route of ROUTES) {
      const response = await post(route);
      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("đăng nhập");
      expect(body.error).not.toContain("editor");
    }
  });

  it("đăng nhập nhưng là viewer → 403 và nói rõ vai trò đang có", async () => {
    const login = await fetch(`http://127.0.0.1:${authPort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "xem", password: "viewer-pw" }),
    });
    const { token } = (await login.json()) as { token: string };
    expect(token).toBeTruthy();

    for (const route of ROUTES) {
      const response = await post(route, { Authorization: `Bearer ${token}` });
      expect(response.status).toBe(403);
      const body = (await response.json()) as { error: string };
      expect(body.error).toContain("editor");
      expect(body.error).toContain("viewer");
    }
  });
});
