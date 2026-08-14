// Hình học IFC đầy đủ, qua web-ifc (WASM).
//
// Bộ đọc thường (parseIfc.ts) chỉ dựng được thân SweptSolid — đủ cho hộp bao
// và bảng thuộc tính, nhưng "View mô hình BIM online" mà chỉ thấy hộp thì
// chưa phải xem mô hình. web-ifc là engine hình học STEP hoàn chỉnh: BRep,
// Boolean, mặt cong… đều ra tam giác. Một lần tích hợp trả ba món của bảng
// nhu cầu: viewer thật (B1), AABB chính xác cho MỌI phần tử để dò va chạm
// (B7), và import không còn "bỏ qua thân không hỗ trợ".
//
// Hai điều cần biết khi đọc code này:
//
// 1. web-ifc trả toạ độ Y-UP (quy ước three.js). Toàn bộ cảnh của WeBIM là
//    Z-up. Mesh được giữ nguyên Y-up và người vẽ phải xoay X +90°; còn AABB
//    thì đổi trục ngay tại đây — (x, y, z)ᵧ → (x, −z, y)ᵤ — vì AABB đi vào
//    dữ liệu lưu bền và mọi phép so va chạm đều ở Z-up.
//
// 2. Mesh KHÔNG lưu bền. Một model vừa phải đã là hàng chục MB Float32Array;
//    localStorage chết ở 5 MB. AABB (vài số mỗi phần tử) được lưu; mesh sống
//    trong phiên — reload thì viewer rơi về hộp bao cho tới khi link lại
//    file, và UI nói rõ điều đó thay vì để cảnh lặng lẽ xấu đi.

import type { IfcAPI as IfcApiType } from "web-ifc";

export interface RealMesh {
  expressId: number;
  /** Vị trí đỉnh, Y-up, đã ở toạ độ thế giới cục bộ của geometry. */
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Ma trận đặt chỗ 4×4 column-major (glm) — khớp Matrix4.fromArray của three. */
  matrix: number[];
  color: { r: number; g: number; b: number; a: number };
}

export interface RealElement {
  expressId: number;
  globalId: string;
  name: string;
  ifcType: string;
  /** AABB đã đổi về Z-up — cùng hệ với model native và bộ dò va chạm. */
  min: [number, number, number];
  max: [number, number, number];
}

export interface RealGeometry {
  meshes: RealMesh[];
  elements: RealElement[];
}

/**
 * Một IfcAPI cho cả app — Init tải ~1,3 MB WASM, làm lại mỗi lần link là phí.
 * Trong trình duyệt WASM nằm ở /wasm/ (copy từ node_modules vào public/);
 * trong node (vitest) web-ifc tự tìm bản node cạnh package.
 */
let apiPromise: Promise<IfcApiType> | null = null;

async function ifcApi(): Promise<IfcApiType> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const { IfcAPI } = await import("web-ifc");
      const api = new IfcAPI();
      if (typeof window !== "undefined") {
        api.SetWasmPath("/wasm/", true);
      }
      await api.Init();
      return api;
    })();
  }
  return apiPromise;
}

/** (x,y,z) Y-up → Z-up. Dùng cho AABB; mesh xoay bằng ma trận khi vẽ. */
function toZUp(x: number, y: number, z: number): [number, number, number] {
  return [x, -z, y];
}

export async function parseRealGeometry(text: string): Promise<RealGeometry> {
  const api = await ifcApi();
  const modelID = api.OpenModel(new TextEncoder().encode(text));
  const meshes: RealMesh[] = [];
  const boundsByElement = new Map<
    number,
    { min: [number, number, number]; max: [number, number, number] }
  >();

  try {
    api.StreamAllMeshes(modelID, (mesh) => {
      const geometries = mesh.geometries;
      for (let i = 0; i < geometries.size(); i += 1) {
        const placed = geometries.get(i);
        const geometry = api.GetGeometry(modelID, placed.geometryExpressID);
        const interleaved = api.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        );
        const indices = api.GetIndexArray(
          geometry.GetIndexData(),
          geometry.GetIndexDataSize(),
        );
        const count = interleaved.length / 6;
        const positions = new Float32Array(count * 3);
        const normals = new Float32Array(count * 3);
        const m = placed.flatTransformation;

        let bounds = boundsByElement.get(mesh.expressID);
        if (!bounds) {
          bounds = {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
          };
          boundsByElement.set(mesh.expressID, bounds);
        }

        for (let v = 0; v < count; v += 1) {
          const x = interleaved[v * 6];
          const y = interleaved[v * 6 + 1];
          const z = interleaved[v * 6 + 2];
          positions[v * 3] = x;
          positions[v * 3 + 1] = y;
          positions[v * 3 + 2] = z;
          normals[v * 3] = interleaved[v * 6 + 3];
          normals[v * 3 + 1] = interleaved[v * 6 + 4];
          normals[v * 3 + 2] = interleaved[v * 6 + 5];

          // AABB tính trên đỉnh ĐÃ áp ma trận (column-major), rồi đổi Z-up.
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
          const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          const [zx, zy, zz] = toZUp(wx, wy, wz);
          bounds.min[0] = Math.min(bounds.min[0], zx);
          bounds.min[1] = Math.min(bounds.min[1], zy);
          bounds.min[2] = Math.min(bounds.min[2], zz);
          bounds.max[0] = Math.max(bounds.max[0], zx);
          bounds.max[1] = Math.max(bounds.max[1], zy);
          bounds.max[2] = Math.max(bounds.max[2], zz);
        }

        meshes.push({
          expressId: mesh.expressID,
          positions,
          normals,
          indices: new Uint32Array(indices),
          matrix: [...m],
          color: {
            r: placed.color.x,
            g: placed.color.y,
            b: placed.color.z,
            a: placed.color.w,
          },
        });
      }
    });

    const elements: RealElement[] = [];
    for (const [expressId, bounds] of boundsByElement) {
      // GetLine cho GlobalId/Name/loại — cái móc duy nhất nối về công cụ gốc
      // và về phần tử mà parseIfc.ts đã đọc thuộc tính.
      let globalId = "";
      let name = "";
      let ifcType = "IFCPRODUCT";
      try {
        const line = api.GetLine(modelID, expressId) as {
          GlobalId?: { value?: string };
          Name?: { value?: string };
          type: number;
        };
        globalId = line.GlobalId?.value ?? "";
        name = line.Name?.value ?? "";
        ifcType = api.GetNameFromTypeCode(line.type).toUpperCase();
      } catch {
        // Phần tử không đọc được dòng vẫn giữ hình học — thà thiếu tên còn
        // hơn thiếu khối trong cảnh.
      }
      elements.push({
        expressId,
        globalId,
        name: name || ifcType,
        ifcType,
        min: bounds.min,
        max: bounds.max,
      });
    }

    return { meshes, elements };
  } finally {
    api.CloseModel(modelID);
  }
}
