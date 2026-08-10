import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { exportProjectToIfc } from "../src/export/ifcGrid";
import { parseIfc } from "../src/ifc/parseIfc";
import { externalClashes } from "../src/application/clash";
import { ganttChart, weekTicks } from "../src/application/gantt";

function buildProject() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  project.addLevel("Level 1", 0);
  project.addWall([0, 0, 0], [6, 0, 0], { thickness: 0.2, height: 3 });
  project.addSlab("FLOOR", [[0, 0], [6, 0], [6, 4], [0, 4]], {
    levelId: project.levels[0].id,
    thickness: 0.2,
  });
  return project;
}

describe("linked IFC round-trip", () => {
  it("parses our own IFC export back into world AABBs", () => {
    const parsed = parseIfc(exportProjectToIfc(buildProject()));
    expect(parsed.skipped).toBe(0);
    const wall = parsed.elements.find((element) => element.ifcType === "IFCWALL")!;
    expect(wall.min[0]).toBeCloseTo(0, 4);
    expect(wall.max[0]).toBeCloseTo(6, 4);
    expect(wall.min[1]).toBeCloseTo(-0.1, 4);
    expect(wall.max[1]).toBeCloseTo(0.1, 4);
    expect(wall.min[2]).toBeCloseTo(0, 4);
    expect(wall.max[2]).toBeCloseTo(3, 4);
    const slab = parsed.elements.find((element) => element.ifcType === "IFCSLAB")!;
    expect(slab.max[1]).toBeCloseTo(4, 4);
    expect(slab.max[2] - slab.min[2]).toBeCloseTo(0.2, 4);
  });

  it("reads rectangle profiles and rotated placements", () => {
    const step = `ISO-10303-21;
HEADER;ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((10.,0.,0.));
#2=IFCDIRECTION((0.,1.,0.));
#3=IFCAXIS2PLACEMENT3D(#1,$,#2);
#4=IFCLOCALPLACEMENT($,#3);
#5=IFCRECTANGLEPROFILEDEF(.AREA.,$,$,4.,2.);
#6=IFCCARTESIANPOINT((0.,0.,0.));
#7=IFCAXIS2PLACEMENT3D(#6,$,$);
#8=IFCDIRECTION((0.,0.,1.));
#9=IFCEXTRUDEDAREASOLID(#5,#7,#8,3.);
#10=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#9));
#11=IFCPRODUCTDEFINITIONSHAPE($,$,(#10));
#12=IFCCOLUMN('g',$,'C1',$,$,#4,#11,$,$);
ENDSEC;
END-ISO-10303-21;`;
    const parsed = parseIfc(step);
    expect(parsed.elements).toHaveLength(1);
    const column = parsed.elements[0];
    // 4×2 rectangle rotated 90° about origin, translated to (10,0):
    // world footprint = x ∈ [9,11], y ∈ [-2,2].
    expect(column.min[0]).toBeCloseTo(9, 4);
    expect(column.max[0]).toBeCloseTo(11, 4);
    expect(column.min[1]).toBeCloseTo(-2, 4);
    expect(column.max[1]).toBeCloseTo(2, 4);
    expect(column.max[2]).toBeCloseTo(3, 4);
  });

  it("finds native-vs-linked clashes and ignores disjoint models", () => {
    const project = buildProject();
    const overlapping = parseIfc(exportProjectToIfc(buildProject())).elements;
    expect(externalClashes(project, overlapping).length).toBeGreaterThan(0);
    const shifted = overlapping.map((element) => ({
      ...element,
      min: [element.min[0] + 100, element.min[1], element.min[2]] as [number, number, number],
      max: [element.max[0] + 100, element.max[1], element.max[2]] as [number, number, number],
    }));
    expect(externalClashes(project, shifted)).toHaveLength(0);
  });
});

describe("gantt layout", () => {
  it("lays out bars, links, violations and week ticks", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const foundation = project.addTask("Móng", "Kết cấu", "2026-08-03", "2026-08-14");
    const frame = project.addTask("Khung", "Kết cấu", "2026-08-17", "2026-08-28");
    const rush = project.addTask("Hoàn thiện sớm", "HT", "2026-08-10", "2026-08-20");
    project.updateTask(frame.id, { dependsOn: [foundation.id] });
    project.updateTask(rush.id, { dependsOn: [foundation.id] });
    project.updateTask(foundation.id, { progress: 50 });

    const chart = ganttChart(project, "2026-08-18")!;
    expect(chart.startDate).toBe("2026-08-03");
    expect(chart.totalDays).toBe(26);
    expect(chart.todayDay).toBe(15);
    expect(chart.bars[0].startDay).toBe(0);
    expect(chart.bars[0].endDay).toBe(12); // inclusive end
    expect(chart.links).toHaveLength(2);
    const frameLink = chart.links.find((link) => link.toRow === 1)!;
    expect(frameLink.violated).toBe(false);
    const rushLink = chart.links.find((link) => link.toRow === 2)!;
    expect(rushLink.violated).toBe(true); // starts before Móng ends
    expect(weekTicks(chart)[0].day).toBe(0);
  });

  it("rejects self-dependencies and unknown ids, cleans up on remove", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const a = project.addTask("A", "", "2026-01-01", "2026-01-05");
    const b = project.addTask("B", "", "2026-01-06", "2026-01-09");
    expect(() => project.updateTask(a.id, { dependsOn: [a.id] })).toThrow("itself");
    expect(() => project.updateTask(a.id, { dependsOn: ["nope"] })).toThrow("Unknown");
    project.updateTask(b.id, { dependsOn: [a.id] });
    project.removeTask(a.id);
    expect(project.tasks[0].dependsOn).toEqual([]);
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.tasks[0].dependsOn).toEqual([]);
  });
});
