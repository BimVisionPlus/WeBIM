// Relay routing tests with real WebSocket connections.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { startRelay } from "../relay/server.mjs";
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
  await new Promise((resolve) => server.once("listening", resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(() => {
  server.close();
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
