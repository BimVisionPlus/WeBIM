import { describe, expect, it } from "vitest";
import {
  openingScheduleRows,
  outlineArea,
  slabScheduleRows,
  wallScheduleRows,
} from "../src/application/schedules";
import { NativeBimProject } from "../src/domain/project";

function sampleProject() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  const ground = project.addLevel("Level 1", 0);
  const upper = project.addLevel("Level 2", 3);
  const wallA = project.addWall([0, 0, 0], [8, 0, 0], { levelId: ground.id });
  project.addWall([0, 0, 0], [0, 6, 0], { levelId: upper.id });
  project.addOpening(wallA.id, "DOOR", 2);
  project.addOpening(wallA.id, "WINDOW", 5);
  project.addSlab("FLOOR", [[0, 0], [8, 0], [8, 5], [0, 5]], { levelId: ground.id });
  return project;
}

describe("schedules", () => {
  it("computes wall rows with lengths, levels and opening counts", () => {
    const rows = wallScheduleRows(sampleProject());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "W1", level: "Level 1", openings: 2 });
    expect(rows[0].length).toBeCloseTo(8);
    expect(rows[1]).toMatchObject({ name: "W2", level: "Level 2", openings: 0 });
    expect(rows[1].length).toBeCloseTo(6);
  });

  it("computes opening rows with host wall and level", () => {
    const rows = openingScheduleRows(sampleProject());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "D1", kind: "Door", wall: "W1", level: "Level 1" });
    expect(rows[1]).toMatchObject({ name: "WN1", kind: "Window", sillHeight: 0.9 });
  });

  it("computes slab areas via the shoelace formula", () => {
    expect(outlineArea([[0, 0], [8, 0], [8, 5], [0, 5]])).toBeCloseTo(40);
    expect(outlineArea([[0, 0], [4, 0], [0, 3]])).toBeCloseTo(6);
    const rows = slabScheduleRows(sampleProject());
    expect(rows[0]).toMatchObject({ name: "F1", kind: "Floor", level: "Level 1" });
    expect(rows[0].area).toBeCloseTo(40);
    expect(rows[0].topElevation).toBe(0);
  });

  it("round-trips schedule definitions through JSON", () => {
    const project = sampleProject();
    const schedule = project.addSchedule("OPENING");
    expect(schedule.name).toBe("Door/Window Schedule");
    project.updateSchedule(schedule.id, { name: "Openings — Ground" });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.schedules).toHaveLength(1);
    expect(restored.schedules[0].name).toBe("Openings — Ground");
    expect(restored.schedules[0].kind).toBe("OPENING");
  });
});
