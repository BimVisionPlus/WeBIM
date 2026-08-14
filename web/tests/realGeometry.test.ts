// web-ifc chạy được cả trong node, nên chi tiết dễ sai nhất — phép đổi trục
// Y-up → Z-up — kiểm được bằng một bức tường biết trước kích thước.
import { describe, expect, it } from "vitest";
import { parseRealGeometry } from "../src/ifc/realGeometry";

const WALL_IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'');
FILE_NAME('t','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#2=IFCAXIS2PLACEMENT3D(#1,$,$);
#3=IFCLOCALPLACEMENT($,#2);
#10=IFCPOLYLINE((#11,#12,#13,#14));
#11=IFCCARTESIANPOINT((0.,0.));
#12=IFCCARTESIANPOINT((4.,0.));
#13=IFCCARTESIANPOINT((4.,0.2));
#14=IFCCARTESIANPOINT((0.,0.2));
#15=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#10);
#16=IFCDIRECTION((0.,0.,1.));
#17=IFCEXTRUDEDAREASOLID(#15,#2,#16,3.);
#18=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#17));
#19=IFCPRODUCTDEFINITIONSHAPE($,$,(#18));
#20=IFCWALL('0GUIDA0000000000000000','','Tuong KC',$,$,#3,#19,$,$);
ENDSEC;
END-ISO-10303-21;
`;

describe("hình học thật qua web-ifc", () => {
  it("dựng mesh và trả AABB đã đổi về Z-up khớp kích thước tường", async () => {
    const real = await parseRealGeometry(WALL_IFC);
    expect(real.meshes.length).toBeGreaterThan(0);
    expect(real.elements).toHaveLength(1);

    const wall = real.elements[0];
    expect(wall.globalId).toBe("0GUIDA0000000000000000");
    expect(wall.name).toBe("Tuong KC");
    expect(wall.ifcType).toBe("IFCWALL");
    // Tường IFC: x 0→4, y 0→0.2 (dày), z 0→3 (cao) — hệ Z-up của cảnh.
    // web-ifc trả Y-up; nếu phép đổi trục sai thì dày/cao đổi chỗ cho nhau.
    expect(wall.min[0]).toBeCloseTo(0, 3);
    expect(wall.max[0]).toBeCloseTo(4, 3);
    expect(wall.min[1]).toBeCloseTo(0, 3);
    expect(wall.max[1]).toBeCloseTo(0.2, 3);
    expect(wall.min[2]).toBeCloseTo(0, 3);
    expect(wall.max[2]).toBeCloseTo(3, 3);
  });

  it("mesh mang đủ đỉnh, pháp tuyến, chỉ số và ma trận 4×4", async () => {
    const real = await parseRealGeometry(WALL_IFC);
    const mesh = real.meshes[0];
    expect(mesh.positions.length % 3).toBe(0);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.matrix).toHaveLength(16);
  });
});
