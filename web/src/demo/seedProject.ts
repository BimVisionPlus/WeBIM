// The demo project, built through the domain API rather than shipped as JSON.
//
// A checked-in .webim.json is a snapshot of a schema, and schemas move: the
// old demo file had no `openings` at all, so it quietly stopped matching what
// the README said it contained. Building it from the same constructors the
// tools use means it cannot drift — if a signature changes, this stops
// compiling instead of loading a project with holes in it.
//
// It is loaded on first run, when there is nothing in localStorage yet, so
// the app opens on a building instead of an empty grid.

import { NativeBimProject, type TaskStatus } from "../domain/project";

/** Nhà phố 12×8 m, hai tầng — small enough to read, complete enough to show. */
export function buildDemoProject(): NativeBimProject {
  const project = NativeBimProject.create(
    "Nhà phố demo 12×8",
    "Khu dân cư Demo",
    "Nhà A",
    "Tầng 1",
  );

  // ── Levels ───────────────────────────────────────────────────────────────
  const ground = project.addLevel("Tầng 1", 0);
  const first = project.addLevel("Tầng 2", 3.3);

  // ── Wall types ───────────────────────────────────────────────────────────
  const brick = project.addWallType("Gạch 220 + trát", [
    { name: "Trát ngoài", material: "Vữa", thickness: 0.015 },
    { name: "Lõi", material: "Gạch", thickness: 0.22 },
    { name: "Trát trong", material: "Vữa", thickness: 0.015 },
  ]);
  const partition = project.addWallType("Tường ngăn 110", [
    { name: "Lõi", material: "Gạch", thickness: 0.11 },
  ]);

  // ── Grids ────────────────────────────────────────────────────────────────
  // Two families so the IFC export takes the RECTANGULAR IfcGrid path.
  for (const x of [0, 4, 8, 12]) {
    project.addGridAxis([x, -1.5, 0], [x, 9.5, 0]);
  }
  for (const y of [0, 4, 8]) {
    project.addGridAxis([-1.5, y, 0], [13.5, y, 0]);
  }

  // ── Ground floor: envelope, an internal partition, openings ──────────────
  const south = project.addWall([0, 0, 0], [12, 0, 0], { typeId: brick.id });
  const east = project.addWall([12, 0, 0], [12, 8, 0], { typeId: brick.id });
  const north = project.addWall([12, 8, 0], [0, 8, 0], { typeId: brick.id });
  const west = project.addWall([0, 8, 0], [0, 0, 0], { typeId: brick.id });
  project.addWall([8, 0, 0], [8, 8, 0], { typeId: partition.id, thickness: 0.11 });

  // Front door plus windows on the two long façades — enough for the opening
  // schedule, the QTO deduction and the door-swing symbols to have something
  // to say.
  project.addOpening(south.id, "DOOR", 2.0, { width: 1.2, height: 2.2 });
  project.addOpening(south.id, "WINDOW", 6.0, { width: 1.8, height: 1.5 });
  project.addOpening(south.id, "WINDOW", 9.5, { width: 1.8, height: 1.5 });
  project.addOpening(north.id, "WINDOW", 3.0, { width: 1.8, height: 1.5 });
  project.addOpening(north.id, "WINDOW", 8.0, { width: 1.8, height: 1.5 });
  project.addOpening(east.id, "WINDOW", 4.0, { width: 1.2, height: 1.5 });
  project.addOpening(west.id, "DOOR", 6.0, { width: 0.9, height: 2.2 });

  // ── First floor ──────────────────────────────────────────────────────────
  for (const [start, end] of [
    [[0, 0, 0], [12, 0, 0]],
    [[12, 0, 0], [12, 8, 0]],
    [[12, 8, 0], [0, 8, 0]],
    [[0, 8, 0], [0, 0, 0]],
  ] as Array<[number[], number[]]>) {
    project.addWall(start as [number, number, number], end as [number, number, number], {
      typeId: brick.id,
      levelId: first.id,
    });
  }

  // ── Slabs ────────────────────────────────────────────────────────────────
  const footprint: [number, number][] = [
    [0, 0],
    [12, 0],
    [12, 8],
    [0, 8],
  ];
  project.addSlab("FLOOR", footprint, { levelId: ground.id });
  project.addSlab("FLOOR", footprint, { levelId: first.id });
  project.addSlab("ROOF", footprint, { levelId: first.id });

  // ── Views ────────────────────────────────────────────────────────────────
  const groundPlan = project.addView("Tầng 1", "FLOOR_PLAN", 100, 40, ground.id);
  project.addView("Tầng 2", "FLOOR_PLAN", 100, 40, first.id);
  project.addView("Mặt cắt A-A", "SECTION", 50, 20);
  project.addView("Mặt đứng trục 1", "ELEVATION", 100, 40);

  // ── Dimension ────────────────────────────────────────────────────────────
  // Overall width along the front façade, dimensioned on the ground plan.
  project.addDimension(groundPlan.id, [0, 0], [12, 0], -1.2);

  // ── Sheet ────────────────────────────────────────────────────────────────
  project.addSheet("Mặt bằng tầng 1");

  // ── Schedules ────────────────────────────────────────────────────────────
  // One of each kind: the last two compute rather than list, so they exercise
  // the geometry (openings deducted) and the clash pass.
  project.addSchedule("WALL");
  project.addSchedule("OPENING");
  project.addSchedule("QTO");
  project.addSchedule("CLASH");

  // ── CDE ──────────────────────────────────────────────────────────────────
  // Notes carry an author and a timestamp; both are fixed so the demo reads
  // the same on every machine and every day.
  const drawing = project.addDocument("WBM-DEMO-00-GF-DR-A-0001", "Mặt bằng tầng 1");
  project.addDocumentNote(
    drawing.id,
    "Bản phát hành cho CĐT xem xét.",
    "KTS Demo",
    "2026-09-01T09:00:00.000Z",
  );
  const spec = project.addDocument("WBM-DEMO-XX-XX-SP-A-0001", "Chỉ dẫn kỹ thuật kiến trúc");
  project.addDocumentNote(
    spec.id,
    "Trích QCVN 06:2022/BXD cho phần thoát nạn.",
    "KS Demo",
    "2026-09-02T09:00:00.000Z",
  );

  // ── Plan ─────────────────────────────────────────────────────────────────
  // Dates are fixed, not relative to today: a demo that reads "trễ 400 ngày"
  // six months from now is worse than one that is plainly a sample.
  // Statuses and progress are set too: a plan where everything is "chưa bắt
  // đầu" at 0% leaves the dashboard with nothing to show, and a demo that
  // demonstrates an empty chart is not a demo.
  const tasks: Array<[string, string, string, string, TaskStatus, number]> = [
    ["Chuẩn bị mặt bằng", "Hạ tầng", "2026-09-01", "2026-09-07", "DONE", 100],
    ["Móng + đài cọc", "Kết cấu", "2026-09-08", "2026-09-28", "DONE", 100],
    ["Kết cấu thân tầng 1", "Kết cấu", "2026-09-29", "2026-10-20", "IN_PROGRESS", 60],
    ["Xây bao che", "Kiến trúc", "2026-10-21", "2026-11-10", "BLOCKED", 15],
    ["Hoàn thiện + MEP", "Hoàn thiện", "2026-11-11", "2026-12-15", "NOT_STARTED", 0],
  ];
  for (const [name, category, start, end, status, progress] of tasks) {
    const task = project.addTask(name, category, start, end);
    task.status = status;
    task.progress = progress;
  }

  // A document that has been issued, so the CDE chart is not one bar.
  spec.status = "SHARED";
  drawing.status = "PUBLISHED";

  return project;
}
