import { describe, expect, it } from "vitest";
import {
  changedElementIds,
  collectElements,
  mergeRemote,
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
