// Auth/roles + S3 adapter + AI endpoint gating, all over real HTTP.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { startRelay } from "../relay/server.mjs";
import { createAuth } from "../relay/auth.mjs";
import { createS3Storage } from "../relay/storage.mjs";
import { WebSocket, type WebSocketServer } from "ws";

function hashEntry(username: string, role: string, password: string) {
  const output = execFileSync("node", ["relay/auth.mjs", "hash", password]).toString();
  return { ...JSON.parse(output), username, role };
}

let server: WebSocketServer;
let port: number;
let editorToken: string;
let viewerToken: string;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "webim-auth-"));
  const usersPath = join(dir, "users.json");
  writeFileSync(
    usersPath,
    JSON.stringify({
      users: [
        hashEntry("ed", "editor", "editor-pw"),
        hashEntry("vi", "viewer", "viewer-pw"),
      ],
    }),
  );
  const auth = createAuth({ usersPath, secret: "test-secret" });
  server = startRelay(0, { auth });
  const httpServer = (server as unknown as { httpServer: import("node:http").Server })
    .httpServer;
  if (!httpServer.listening) {
    await new Promise((resolve) => httpServer.once("listening", resolve));
  }
  port = (httpServer.address() as { port: number }).port;

  const login = async (username: string, password: string) => {
    const response = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as { token: string }).token;
  };
  editorToken = await login("ed", "editor-pw");
  viewerToken = await login("vi", "viewer-pw");
});

afterAll(async () => {
  await new Promise((resolve) => server.close(() => resolve(null)));
});

describe("auth + roles", () => {
  it("rejects bad credentials and unauthenticated file access", async () => {
    const bad = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username: "ed", password: "wrong" }),
    });
    expect(bad.status).toBe(401);
    const anonymous = await fetch(`http://127.0.0.1:${port}/files/x/y.txt`);
    expect(anonymous.status).toBe(401);
  });

  it("lets editors write, viewers read but not write", async () => {
    const put = await fetch(`http://127.0.0.1:${port}/files/auth/doc.txt`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${editorToken}` },
      body: "secret plan",
    });
    expect(put.status).toBe(200);

    const viewerRead = await fetch(`http://127.0.0.1:${port}/files/auth/doc.txt`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    expect(await viewerRead.text()).toBe("secret plan");

    const viewerWrite = await fetch(`http://127.0.0.1:${port}/files/auth/doc2.txt`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${viewerToken}` },
      body: "nope",
    });
    expect(viewerWrite.status).toBe(403);
  });

  it("gates the relay: no token -> closed; viewer sync dropped, presence passes", async () => {
    const rejected = new WebSocket(`ws://127.0.0.1:${port}`);
    const closeCode = await new Promise<number>((resolve) => {
      rejected.on("close", (code) => resolve(code));
    });
    expect(closeCode).toBe(4401);

    const editor = new WebSocket(`ws://127.0.0.1:${port}/?token=${editorToken}`);
    const viewer = new WebSocket(`ws://127.0.0.1:${port}/?token=${viewerToken}`);
    await Promise.all(
      [editor, viewer].map(
        (socket) => new Promise((resolve) => socket.on("open", resolve)),
      ),
    );
    const received: string[] = [];
    editor.on("message", (data) =>
      received.push((JSON.parse(data.toString()) as { type: string }).type),
    );
    viewer.send(JSON.stringify({ type: "sync", clientId: "v1" }));
    viewer.send(JSON.stringify({ type: "presence", clientId: "v1" }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toEqual(["presence"]);
    editor.close();
    viewer.close();
  });

  it("gates /ai/render-concept: 401 anonymous, 501 without key, 400 bad body", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    const anonymous = await fetch(`http://127.0.0.1:${port}/ai/render-concept`, {
      method: "POST",
      body: JSON.stringify({ image: "data:image/png;base64,AAAA", style: "x" }),
    });
    expect(anonymous.status).toBe(401);
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const noKey = await fetch(`http://127.0.0.1:${port}/ai/render-concept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${editorToken}` },
        body: JSON.stringify({ image: "data:image/png;base64,AAAA", style: "x" }),
      });
      expect(noKey.status).toBe(501);
      process.env.ANTHROPIC_API_KEY = "test-key-not-used";
      const badBody = await fetch(`http://127.0.0.1:${port}/ai/render-concept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${editorToken}` },
        body: JSON.stringify({ image: "not-a-data-url", style: "x" }),
      });
      expect(badBody.status).toBe(400);
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("returns 501 from /ai/read-drawing without an API key", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ai/read-drawing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${editorToken}` },
        body: JSON.stringify({ key: "auth/doc.txt", question: "gì đây?" }),
      });
      expect(response.status).toBe(501);
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
  });
});

describe("S3 storage adapter", () => {
  it("signs requests (SigV4) and round-trips blobs against a fake S3", async () => {
    const blobs = new Map<string, Buffer>();
    const fake = createServer(async (request, response) => {
      const authHeader = request.headers.authorization ?? "";
      if (
        !authHeader.startsWith("AWS4-HMAC-SHA256 Credential=AK/") ||
        !authHeader.includes("SignedHeaders=host;x-amz-content-sha256;x-amz-date") ||
        !request.headers["x-amz-date"] ||
        !request.headers["x-amz-content-sha256"]
      ) {
        response.writeHead(403);
        response.end("bad signature shape");
        return;
      }
      const url = new URL(request.url!, "http://localhost");
      if (request.method === "PUT") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        blobs.set(url.pathname, Buffer.concat(chunks));
        response.end();
      } else if (url.searchParams.get("list-type") === "2") {
        const items = [...blobs.entries()]
          .map(
            ([key, value]) =>
              `<Contents><Key>${key.replace("/bucket/", "")}</Key><Size>${value.length}</Size></Contents>`,
          )
          .join("");
        response.end(`<ListBucketResult>${items}</ListBucketResult>`);
      } else {
        const body = blobs.get(url.pathname);
        if (!body) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.end(body);
      }
    });
    await new Promise<void>((resolve) => fake.listen(0, resolve));
    const fakePort = (fake.address() as { port: number }).port;

    const storage = createS3Storage({
      endpoint: `http://127.0.0.1:${fakePort}`,
      bucket: "bucket",
      region: "ap-southeast-1",
      accessKey: "AK",
      secretKey: "SK",
    });
    await storage.put("proj/dr/plan.pdf", Buffer.from("pdf-bytes"));
    expect((await storage.get("proj/dr/plan.pdf")).toString()).toBe("pdf-bytes");
    const listed = await storage.list("proj");
    expect(listed).toEqual([{ key: "proj/dr/plan.pdf", size: 9 }]);
    fake.close();
  });
});

describe("standards corpus merge", () => {
  it("merges corpus entries with conflicts and applies verified supersessions", async () => {
    const { STANDARDS_CATALOG } = await import("../src/standards/catalog");
    const fire = STANDARDS_CATALOG.find((entry) => entry.code === "QCVN 06:2022/BXD")!;
    expect(fire.source).toBe("corpus");
    expect(fire.conflicts.length).toBeGreaterThan(0);
    expect(fire.editionVerified).toBe(false);

    // Corpus says 07:2016 in force, but the web-verified supersession
    // (QCVN 07:2023/BXD, effective 2024-07-01) overrides it.
    const infra2016 = STANDARDS_CATALOG.find((entry) => entry.code === "QCVN 07:2016/BXD")!;
    expect(infra2016.status).toBe("HET_HIEU_LUC");
    const infra2023 = STANDARDS_CATALOG.find((entry) => entry.code === "QCVN 07:2023/BXD")!;
    expect(infra2023.status).toBe("HIEN_HANH");
    expect(infra2023.replaces).toBe("QCVN 07:2016/BXD");

    const steel = STANDARDS_CATALOG.find((entry) => entry.code === "TCVN 5575:2024")!;
    expect(steel.replaces).toBe("TCVN 5575:2012");

    // No duplicate codes after the merge.
    const codes = STANDARDS_CATALOG.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
