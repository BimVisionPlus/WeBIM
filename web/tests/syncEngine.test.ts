import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changedElementIds,
  collectElements,
  mergeRemote,
  WebSocketTransport,
  type ElementClocks,
} from "../src/sync/syncEngine";
import { NativeBimProject } from "../src/domain/project";

function projectPair() {
  const base = NativeBimProject.create("P", "S", "B", "L1");
  base.addLevel("Level 1", 0);
  const baseDict = JSON.stringify(base.toDict());
  const local = NativeBimProject.fromJson(baseDict);
  const remote = NativeBimProject.fromJson(baseDict);
  return { local, remote };
}

describe("sync merge", () => {
  it("detects changed elements by id", () => {
    const { local } = projectPair();
    const before = collectElements(local.toDict());
    const wall = local.addWall([0, 0, 0], [4, 0, 0]);
    const after = collectElements(local.toDict());
    expect(changedElementIds(before, after)).toEqual([wall.id]);
  });

  it("keeps concurrent edits to different elements from both peers", () => {
    const { local, remote } = projectPair();
    const localWall = local.addWall([0, 0, 0], [4, 0, 0]);
    const remoteWall = remote.addWall([0, 5, 0], [4, 5, 0]);
    const localClocks: ElementClocks = { [localWall.id]: { t: 1, c: "a" } };
    const remoteClocks: ElementClocks = { [remoteWall.id]: { t: 1, c: "b" } };
    const result = mergeRemote(local.toDict(), localClocks, remote.toDict(), remoteClocks);
    const walls = result.project.walls as { id: string }[];
    expect(walls.map((wall) => wall.id).sort()).toEqual(
      [localWall.id, remoteWall.id].sort(),
    );
    expect(result.changed).toBe(true);
  });

  it("resolves same-element conflicts by newest clock", () => {
    const { local, remote } = projectPair();
    const wall = local.addWall([0, 0, 0], [4, 0, 0]);
    remote.walls.push({ ...wall, thickness: 0.4 });
    const localClocks: ElementClocks = { [wall.id]: { t: 2, c: "a" } };
    const remoteClocks: ElementClocks = { [wall.id]: { t: 3, c: "b" } };
    const result = mergeRemote(local.toDict(), localClocks, remote.toDict(), remoteClocks);
    const walls = result.project.walls as { thickness: number }[];
    expect(walls[0].thickness).toBeCloseTo(0.4);

    // Older remote clock loses: local version survives untouched.
    const stale = mergeRemote(local.toDict(), { [wall.id]: { t: 5, c: "a" } }, remote.toDict(), remoteClocks);
    expect((stale.project.walls as { thickness: number }[])[0].thickness).toBeCloseTo(0.2);
    expect(stale.changed).toBe(false);
  });

  it("applies remote deletions carried by a newer clock", () => {
    const { local, remote } = projectPair();
    const wall = local.addWall([0, 0, 0], [4, 0, 0]);
    // Remote never has the wall but knows about its deletion (newer clock).
    const result = mergeRemote(
      local.toDict(),
      { [wall.id]: { t: 1, c: "a" } },
      remote.toDict(),
      { [wall.id]: { t: 2, c: "b" } },
    );
    expect((result.project.walls as unknown[]).length).toBe(0);
    expect(result.changed).toBe(true);
  });

  it("merges project meta fields by clock too", () => {
    const { local, remote } = projectPair();
    remote.name = "Renamed by peer";
    const result = mergeRemote(
      local.toDict(),
      {},
      remote.toDict(),
      { __meta__: { t: 1, c: "b" } },
    );
    expect(result.project.name).toBe("Renamed by peer");
  });
});

describe("presence helpers", () => {
  it("assigns deterministic peer colors", async () => {
    const { colorForClient } = await import("../src/sync/syncEngine");
    expect(colorForClient("abc")).toBe(colorForClient("abc"));
    expect(colorForClient("abc")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("prunes stale peers", async () => {
    const { prunePeers } = await import("../src/sync/syncEngine");
    const peers = new Map([
      ["fresh", { clientId: "fresh", name: "", color: "", selection: null, tool: "", lastSeen: 1000 }],
      ["stale", { clientId: "stale", name: "", color: "", selection: null, tool: "", lastSeen: 0 }],
    ]);
    const changed = prunePeers(peers, 26000, 25000);
    expect(changed).toBe(true);
    expect([...peers.keys()]).toEqual(["fresh"]);
  });
});

/**
 * A socket that never opens, driven by hand. The relay's retry policy is the
 * difference between a static demo that looks broken (a console full of red,
 * forever) and one that quietly says it is standalone.
 */
class DeadSocket {
  static instances: DeadSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 0;
  constructor(public url: string) {
    DeadSocket.instances.push(this);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  send() {}
  /** Simulate the server accepting the connection. */
  accept() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe("relay retry policy", () => {
  beforeEach(() => {
    DeadSocket.instances = [];
    vi.stubGlobal("WebSocket", DeadSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function connect(onStandalone = () => {}) {
    return new WebSocketTransport(
      "ws://nowhere/api",
      () => {},
      () => {},
      () => {},
      onStandalone,
    );
  }

  it("gives up into standalone after three failures, and stops dialling", () => {
    let standalone = false;
    const transport = connect(() => {
      standalone = true;
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      DeadSocket.instances.at(-1)!.close();
      vi.advanceTimersByTime(60_000);
    }

    expect(standalone).toBe(true);
    expect(transport.standalone).toBe(true);
    const dialled = DeadSocket.instances.length;
    vi.advanceTimersByTime(600_000);
    expect(DeadSocket.instances).toHaveLength(dialled);
  });

  it("keeps retrying forever once a relay has answered — a restart is not standalone", () => {
    let standalone = false;
    connect(() => {
      standalone = true;
    });

    DeadSocket.instances[0].accept();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      DeadSocket.instances.at(-1)!.close();
      vi.advanceTimersByTime(60_000);
    }

    expect(standalone).toBe(false);
    expect(DeadSocket.instances.length).toBeGreaterThan(6);
  });

  it("backs off between attempts instead of hammering", () => {
    connect();
    DeadSocket.instances[0].close();
    expect(DeadSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(DeadSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(DeadSocket.instances).toHaveLength(2);
  });
});
