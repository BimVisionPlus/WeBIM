"""Blender viewport representation of WeBIM Web native walls.

Builds one mesh object per native wall from the shared plan-geometry
port (webim.domain.wall_geometry): mitered/butt/T joins and openings
produce exactly the solids WeBIM Web renders. Objects are tagged with
webim_id / webim_class = "NativeWall" and live in the
"Native BIM/Walls" collection.
"""

from __future__ import annotations

import bpy

from webim.domain.project import NativeBimProject
from webim.domain.wall_geometry import wall_pieces

_COLLECTION_NAME = "Native BIM/Walls"


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
        if obj.get("webim_class") == "NativeWall"
    ]
    for obj in stale:
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh is not None and mesh.users == 0:
            bpy.data.meshes.remove(mesh)


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


def rebuild_native_walls(project: NativeBimProject) -> int:
    """Replace all native-wall viewport objects from the domain model."""
    _remove_native_wall_objects()
    for wall in project.walls:
        create_native_wall_object(wall, project.walls)
    return len(project.walls)
