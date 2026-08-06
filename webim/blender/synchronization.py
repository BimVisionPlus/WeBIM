from __future__ import annotations

from collections import defaultdict

import bpy
from bpy.app.handlers import persistent
from mathutils import Vector

from .state import SESSION

_SYNCING = False
_PREVIEW_AXIS_IDS: set[str] = set()
_EPSILON = 1.0e-7


def begin_grid_preview(axis_id: str) -> None:
    _PREVIEW_AXIS_IDS.add(axis_id)


def end_grid_preview(axis_id: str) -> None:
    _PREVIEW_AXIS_IDS.discard(axis_id)


def _world_endpoints(obj) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    spline = obj.data.splines[0]
    start = obj.matrix_world @ Vector(spline.points[0].co[:3])
    end = obj.matrix_world @ Vector(spline.points[1].co[:3])
    return tuple(start), tuple(end)


def _points_differ(left, right) -> bool:
    return any(abs(a - b) > _EPSILON for a, b in zip(left, right))


def _canonical_grid_object(objects, axis) -> object:
    expected_name = f"Grid {axis.name}"
    return min(objects, key=lambda obj: (obj.name != expected_name, obj.name))


def _adopt_duplicate_grid(obj, source_axis, project) -> None:
    from .tools.grid.renderer import update_grid_head_annotation

    if obj.data.users > 1:
        obj.data = obj.data.copy()
    start, end = _world_endpoints(obj)
    duplicated_axis = project.add_grid_axis(
        start,
        end,
        system_name=source_axis.system_name,
        head_type=source_axis.head_type,
        head_scale=source_axis.head_scale,
    )
    obj["webim_id"] = duplicated_axis.id
    obj["grid_name"] = duplicated_axis.name
    obj["grid_system"] = duplicated_axis.system_name
    obj["grid_head_type"] = duplicated_axis.head_type
    obj["grid_head_scale"] = duplicated_axis.head_scale
    obj.name = f"Grid {duplicated_axis.name}"
    obj.data.name = f"Grid {duplicated_axis.name}"
    update_grid_head_annotation(obj, duplicated_axis)


@persistent
def synchronize_blender_grid_edits(_scene=None, _depsgraph=None) -> None:
    """Adopt Blender duplicates and synchronize object transforms to native Grids."""
    global _SYNCING
    project = SESSION.native_project
    if _SYNCING or project is None:
        return

    _SYNCING = True
    try:
        from .tools.grid.renderer import update_grid_head_positions

        axes = {axis.id: axis for axis in project.grid_axes}
        grouped = defaultdict(list)
        for obj in bpy.data.objects:
            if obj.get("webim_class") == "GridDatum" and obj.type == "CURVE":
                grouped[obj.get("webim_id", "")].append(obj)

        for axis_id, objects in grouped.items():
            source_axis = axes.get(axis_id)
            if source_axis is None or len(objects) < 2:
                continue
            canonical = _canonical_grid_object(objects, source_axis)
            for duplicate in objects:
                if duplicate != canonical:
                    _adopt_duplicate_grid(duplicate, source_axis, project)

        axes = {axis.id: axis for axis in project.grid_axes}
        for obj in bpy.data.objects:
            if obj.get("webim_class") != "GridDatum" or obj.type != "CURVE":
                continue
            axis_id = obj.get("webim_id", "")
            if axis_id in _PREVIEW_AXIS_IDS:
                continue
            axis = axes.get(axis_id)
            if axis is None or not obj.data.splines:
                continue
            start, end = _world_endpoints(obj)
            if not (
                _points_differ(start, axis.start)
                or _points_differ(end, axis.end)
            ):
                continue
            updated = project.update_grid_axis(axis_id, start=start, end=end)
            update_grid_head_positions(updated)
            SESSION.is_dirty = True
    finally:
        _SYNCING = False


def register() -> None:
    handler = bpy.app.handlers.depsgraph_update_post
    if synchronize_blender_grid_edits not in handler:
        handler.append(synchronize_blender_grid_edits)


def unregister() -> None:
    handler = bpy.app.handlers.depsgraph_update_post
    if synchronize_blender_grid_edits in handler:
        handler.remove(synchronize_blender_grid_edits)
    _PREVIEW_AXIS_IDS.clear()
