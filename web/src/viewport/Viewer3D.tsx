// Online 3D BIM viewer (mục 1) — Autodesk-Viewer-style orbit view of
// the native model plus linked IFC models.
//
// Native walls reuse the exact wallPieces the 2D viewport extrudes
// (openings already cut), slabs extrude their outlines, and linked IFC
// elements render as translucent boxes from their parsed AABBs. Z is
// up, matching the modelling convention.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NativeBimProject } from "../domain/project";
import { store, type LinkedModel } from "../state/store";
import type { RealMesh } from "../ifc/realGeometry";
import { wallPieces } from "../application/wallGeometry";

const LEVEL_COLORS = [0x8a94a8, 0xa89a7c, 0x7ca8a0, 0xa87c94];

/** Overall model bounds — used to frame the camera. Exported for tests. */
export function sceneBounds(
  project: NativeBimProject,
  linked: readonly LinkedModel[],
): { min: [number, number, number]; max: [number, number, number] } | null {
  const points: [number, number, number][] = [];
  for (const wall of project.walls) {
    for (const piece of wallPieces(wall, project.walls)) {
      for (const [x, y] of piece.corners) {
        points.push([x, y, piece.zBottom], [x, y, piece.zTop]);
      }
    }
  }
  for (const slab of project.slabs) {
    const top = project.slabTopZ(slab);
    for (const [x, y] of slab.outline) {
      points.push([x, y, top - slab.thickness], [x, y, top]);
    }
  }
  for (const model of linked) {
    for (const element of model.elements) {
      points.push(element.min, element.max);
    }
  }
  if (points.length === 0) return null;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}

function buildModel(
  project: NativeBimProject,
  linked: readonly LinkedModel[],
  meshLookup?: (name: string) => RealMesh[] | undefined,
): THREE.Group {
  const group = new THREE.Group();
  const levelIndex = new Map(project.levels.map((level, index) => [level.id, index]));

  for (const wall of project.walls) {
    const color =
      LEVEL_COLORS[(levelIndex.get(wall.levelId) ?? 0) % LEVEL_COLORS.length];
    const material = new THREE.MeshLambertMaterial({ color });
    for (const piece of wallPieces(wall, project.walls)) {
      const shape = new THREE.Shape(
        piece.corners.map(([x, y]) => new THREE.Vector2(x, y)),
      );
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: piece.zTop - piece.zBottom,
        bevelEnabled: false,
      });
      geometry.translate(0, 0, piece.zBottom);
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      group.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: 0x1c1e24 }),
        ),
      );
    }
  }

  // Khối nghiên cứu: nửa trong suốt và viền nhạt, để không bao giờ bị nhìn
  // nhầm là cấu kiện đã thiết kế đứng cạnh tường thật.
  for (const mass of project.masses) {
    const shape = new THREE.Shape(
      mass.outline.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: mass.height,
      bevelEnabled: false,
    });
    const level = project.levelById(mass.levelId);
    geometry.translate(0, 0, (level?.elevation ?? 0) + mass.zOffset);
    group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshLambertMaterial({
          color: 0x4b6f9c,
          transparent: true,
          opacity: 0.35,
        }),
      ),
    );
    group.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x7fa5d4 }),
      ),
    );
  }

  for (const slab of project.slabs) {
    const shape = new THREE.Shape(
      slab.outline.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: slab.thickness,
      bevelEnabled: false,
    });
    geometry.translate(0, 0, project.slabTopZ(slab) - slab.thickness);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({
        color: slab.kind === "ROOF" ? 0x9c8468 : 0x6f7686,
        transparent: slab.kind === "ROOF",
        opacity: slab.kind === "ROOF" ? 0.55 : 1,
      }),
    );
    group.add(mesh);
    group.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x1c1e24 }),
      ),
    );
  }

  for (const model of linked) {
    // Có mesh thật từ web-ifc (trong phiên) thì vẽ hình học thật; không thì
    // hộp bao từ AABB đã lưu — reload là rơi về hộp cho tới khi link lại.
    const realMeshes = meshLookup?.(model.name);
    if (realMeshes && realMeshes.length > 0) {
      // web-ifc trả toạ độ Y-up; cảnh này Z-up → cả cụm xoay X +90°.
      const yUpGroup = new THREE.Group();
      yUpGroup.rotation.x = Math.PI / 2;
      for (const real of realMeshes) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(real.positions, 3));
        geometry.setAttribute("normal", new THREE.BufferAttribute(real.normals, 3));
        geometry.setIndex(new THREE.BufferAttribute(real.indices, 1));
        const material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(real.color.r, real.color.g, real.color.b),
          transparent: real.color.a < 1,
          opacity: real.color.a,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.fromArray(real.matrix);
        yUpGroup.add(mesh);
      }
      group.add(yUpGroup);
      continue;
    }

    const material = new THREE.MeshLambertMaterial({
      color: 0xd96c5f,
      transparent: true,
      opacity: 0.45,
    });
    for (const element of model.elements) {
      const size = [
        element.max[0] - element.min[0],
        element.max[1] - element.min[1],
        element.max[2] - element.min[2],
      ];
      const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        element.min[0] + size[0] / 2,
        element.min[1] + size[1] / 2,
        element.min[2] + size[2] / 2,
      );
      group.add(mesh);
    }
  }

  return group;
}

export interface Viewer3DProps {
  project: NativeBimProject;
  linked: readonly LinkedModel[];
  version: number;
  /** Receives a screenshot callback once the canvas is live. */
  onReady?: (capture: () => string) => void;
}

export function Viewer3D({ project, linked, version, onReady }: Viewer3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model: THREE.Group | null;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      // Keep the buffer so "Render concept AI" can capture a screenshot.
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171a21);
    scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x33363d, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(18, -14, 26);
    scene.add(sun);
    const ground = new THREE.GridHelper(80, 80, 0x2b2f38, 0x22252d);
    ground.rotation.x = Math.PI / 2;
    scene.add(ground);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    stateRef.current = { renderer, scene, camera, controls, model: null };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let disposed = false;
    const animate = () => {
      if (disposed) return;
      requestAnimationFrame(animate);
      try {
        controls.update();
        renderer.render(scene, camera);
      } catch {
        // never let the loop die silently
      }
    };
    animate();

    onReady?.(() => renderer.domElement.toDataURL("image/png"));

    return () => {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.model) {
      state.scene.remove(state.model);
    }
    const model = buildModel(project, linked, (name) => store.meshCache.get(name));
    state.scene.add(model);
    state.model = model;

    const bounds = sceneBounds(project, linked);
    if (bounds) {
      const center = new THREE.Vector3(
        (bounds.min[0] + bounds.max[0]) / 2,
        (bounds.min[1] + bounds.max[1]) / 2,
        (bounds.min[2] + bounds.max[2]) / 2,
      );
      const radius = Math.max(
        4,
        Math.hypot(
          bounds.max[0] - bounds.min[0],
          bounds.max[1] - bounds.min[1],
          bounds.max[2] - bounds.min[2],
        ) / 2,
      );
      // Only reframe when the target moved meaningfully — keep the
      // user's orbit while they edit.
      if (state.controls.target.distanceTo(center) > radius * 0.75) {
        state.controls.target.copy(center);
        state.camera.position.set(
          center.x + radius * 1.6,
          center.y - radius * 1.8,
          center.z + radius * 1.2,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, project, linked]);

  return <div ref={hostRef} className="viewer3d-host" />;
}
