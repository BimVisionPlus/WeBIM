// Va chạm MỨC TAM GIÁC — pass 2 sau sàng lọc AABB.
//
// AABB nói "hai hộp bao chồng nhau"; hai phần tử chéo góc có thể chồng hộp
// mà không hề chạm — false positive làm người phối hợp mất niềm tin vào
// báo cáo. Khi mesh thật có trong phiên (web-ifc đã dựng), từng cặp
// AABB-hit được kiểm lại bằng giao tam giác-tam giác (Möller 1997, bản
// interval trên đường giao hai mặt phẳng): CÓ tam giác giao nhau mới là
// va chạm thật.
//
// Trung thực về giới hạn: mesh chỉ sống trong phiên (localStorage không
// chứa nổi) — reload chưa link lại file thì pass 2 không chạy được, và
// báo cáo phải NÓI dòng nào đã kiểm mesh, dòng nào mới ở mức AABB.

type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const EPS = 1e-9;

/** Khoảng [min,max] hình chiếu của tam giác lên trục đường giao. */
function interval(
  distances: [number, number, number],
  projections: [number, number, number],
): [number, number] | null {
  // Đỉnh nằm hai phía mặt phẳng kia mới cho đoạn giao.
  const points: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const j = (i + 1) % 3;
    const di = distances[i];
    const dj = distances[j];
    if ((di > EPS && dj < -EPS) || (di < -EPS && dj > EPS)) {
      const t = di / (di - dj);
      points.push(projections[i] + t * (projections[j] - projections[i]));
    } else if (Math.abs(di) <= EPS) {
      points.push(projections[i]);
    }
  }
  if (points.length < 2) return null;
  return [Math.min(...points), Math.max(...points)];
}

/** Möller: hai tam giác trong không gian có giao nhau không. */
export function trianglesIntersect(a: [Vec3, Vec3, Vec3], b: [Vec3, Vec3, Vec3]): boolean {
  const normalB = cross(sub(b[1], b[0]), sub(b[2], b[0]));
  const dB = -dot(normalB, b[0]);
  const distA = a.map((v) => dot(normalB, v) + dB) as [number, number, number];
  if (distA.every((d) => d > EPS) || distA.every((d) => d < -EPS)) return false;

  const normalA = cross(sub(a[1], a[0]), sub(a[2], a[0]));
  const dA = -dot(normalA, a[0]);
  const distB = b.map((v) => dot(normalA, v) + dA) as [number, number, number];
  if (distB.every((d) => d > EPS) || distB.every((d) => d < -EPS)) return false;

  // Trục đường giao hai mặt phẳng; chiếu lên trục lớn nhất của nó.
  const direction = cross(normalA, normalB);
  const axis = [Math.abs(direction[0]), Math.abs(direction[1]), Math.abs(direction[2])];
  const largest = axis.indexOf(Math.max(...axis));
  const projA = a.map((v) => v[largest]) as [number, number, number];
  const projB = b.map((v) => v[largest]) as [number, number, number];

  const intervalA = interval(distA, projA);
  const intervalB = interval(distB, projB);
  if (!intervalA || !intervalB) {
    // Hai tam giác đồng phẳng — hiếm trong mô hình thật; coi AABB-hit là đủ
    // (giữ dương tính, không lặng lẽ bỏ) thay vì thêm cả bài toán 2D.
    return true;
  }
  return intervalA[0] <= intervalB[1] + EPS && intervalB[0] <= intervalA[1] + EPS;
}

export interface ClashMesh {
  positions: Float32Array;
  indices: Uint32Array;
  /** Ma trận 4×4 column-major đặt mesh vào toạ độ model. */
  matrix: number[];
}

function worldTriangles(mesh: ClashMesh): [Vec3, Vec3, Vec3][] {
  const m = mesh.matrix;
  const apply = (i: number): Vec3 => {
    const x = mesh.positions[i * 3];
    const y = mesh.positions[i * 3 + 1];
    const z = mesh.positions[i * 3 + 2];
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  };
  const triangles: [Vec3, Vec3, Vec3][] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    triangles.push([
      apply(mesh.indices[i]),
      apply(mesh.indices[i + 1]),
      apply(mesh.indices[i + 2]),
    ]);
  }
  return triangles;
}

function triangleBox(t: [Vec3, Vec3, Vec3]): [Vec3, Vec3] {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of t) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], v[axis]);
      max[axis] = Math.max(max[axis], v[axis]);
    }
  }
  return [min, max];
}

function boxesOverlap(a: [Vec3, Vec3], b: [Vec3, Vec3]): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    if (a[0][axis] > b[1][axis] + EPS || b[0][axis] > a[1][axis] + EPS) return false;
  }
  return true;
}

/**
 * Hai tập mesh (một phần tử = nhiều mesh) có giao nhau thật không.
 * AABB per-triangle làm prefilter; thoát sớm ở giao ĐẦU TIÊN.
 */
export function elementsIntersect(a: ClashMesh[], b: ClashMesh[]): boolean {
  const trianglesA = a.flatMap(worldTriangles);
  const trianglesB = b.flatMap(worldTriangles);
  const boxesB = trianglesB.map(triangleBox);
  for (const ta of trianglesA) {
    const boxA = triangleBox(ta);
    for (let i = 0; i < trianglesB.length; i += 1) {
      if (!boxesOverlap(boxA, boxesB[i])) continue;
      if (trianglesIntersect(ta, trianglesB[i])) return true;
    }
  }
  return false;
}
