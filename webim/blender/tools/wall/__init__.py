"""Blender viewport representation of WeBIM Web native walls.

Builds, per native wall: a mesh object from the shared plan-geometry
port (webim.domain.wall_geometry) — mitered/butt/T joins and openings
produce exactly the solids WeBIM Web renders — plus an editable 2-point
axis curve (grab its endpoints to move the wall axis; synchronization
writes the edit back to the domain) and a plan swing symbol per door.

Object tags: webim_class = "NativeWall" (solid), "NativeWallAxis"
(editable axis curve), "NativeDoorSwing" (symbol). All live in the
"Native BIM/Walls" collection.
"""

from __future__ import annotations

import bpy

from webim.domain.project import NativeBimProject
from webim.domain.wall_geometry import door_swing, wall_pieces

_COLLECTION_NAME = "Native BIM/Walls"
_NATIVE_CLASSES = ("NativeWall", "NativeWallAxis", "NativeDoorSwing")


def _get_or_create_collection(name: str):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _remove_native_wall_objects() -> None:
    stale = [
        obj
        for obj in bpy.data.objects
        if obj.get("webim_class") in _NATIVE_CLASSES
    ]
    for obj in stale:
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is None or data.users != 0:
            continue
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)


def _piece_prism(piece, base_z: float):
    """Vertices and faces of one extruded footprint piece."""
    corners = piece.corners
    bottom = [(x, y, base_z + piece.z_bottom) for x, y in corners]
    top = [(x, y, base_z + piece.z_top) for x, y in corners]
    vertices = bottom + top
    count = len(corners)
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, 2 * count))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    return vertices, faces


def create_native_wall_object(wall, walls):
    """Create one Blender mesh object for a native wall."""
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, ...]] = []
    base_z = wall.start[2]
    for piece in wall_pieces(wall, walls):
        offset = len(vertices)
        piece_vertices, piece_faces = _piece_prism(piece, base_z)
        vertices.extend(piece_vertices)
        faces.extend(tuple(i + offset for i in face) for face in piece_faces)
    mesh = bpy.data.meshes.new(f"Wall {wall.name}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(f"Wall {wall.name}", mesh)
    obj["webim_id"] = wall.id
    obj["webim_class"] = "NativeWall"
    obj["wall_name"] = wall.name
    if wall.level_id is not None:
        obj["wall_level_id"] = wall.level_id
    _get_or_create_collection(_COLLECTION_NAME).objects.link(obj)
    return obj


def _add_poly_spline(curve, points) -> None:
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for spline_point, (x, y, z) in zip(spline.points, points):
        spline_point.co = (x, y, z, 1.0)


def create_native_wall_axis(wall):
    """Editable 2-point axis curve; endpoint edits sync back to the domain."""
    curve = bpy.data.curves.new(f"Wall {wall.name} Axis", type="CURVE")
    curve.dimensions = "3D"
    _add_poly_spline(curve, [tuple(wall.start), tuple(wall.end)])
    obj = bpy.data.objects.new(f"Wall {wall.name} Axis", curve)
    obj["webim_id"] = wall.id
    obj["webim_class"] = "NativeWallAxis"
    obj.show_in_front = True
    _get_or_create_collection(_COLLECTION_NAME).objects.link(obj)
    return obj


def create_door_swing_object(wall, opening):
    """Plan swing symbol for one door: open leaf plus quarter arc."""
    swing = door_swing(wall, opening)
    if swing is None:
        return None
    z = wall.start[2] + 0.01
    curve = bpy.data.curves.new(f"Swing {opening.name}", type="CURVE")
    curve.dimensions = "3D"
    _add_poly_spline(
        curve,
        [(swing.hinge[0], swing.hinge[1], z), (swing.leaf_end[0], swing.leaf_end[1], z)],
    )
    _add_poly_spline(curve, [(x, y, z) for x, y in swing.arc])
    obj = bpy.data.objects.new(f"Swing {opening.name}", curve)
    obj["webim_class"] = "NativeDoorSwing"
    obj["webim_wall_id"] = wall.id
    obj["webim_opening_id"] = opening.id
    obj.hide_select = True
    obj.show_in_front = True
    _get_or_create_collection(_COLLECTION_NAME).objects.link(obj)
    return obj


def rebuild_native_walls(project: NativeBimProject) -> int:
    """Replace all native-wall viewport objects from the domain model."""
    _remove_native_wall_objects()
    for wall in project.walls:
        create_native_wall_object(wall, project.walls)
        create_native_wall_axis(wall)
        for opening in wall.openings:
            create_door_swing_object(wall, opening)
    return len(project.walls)
