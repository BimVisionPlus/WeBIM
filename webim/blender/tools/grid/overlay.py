from __future__ import annotations

import math

import bpy
import gpu
from gpu_extras.batch import batch_for_shader

from webim.domain.graphics.line_styles import LINE_PATTERNS, dash_spans
from webim.domain.project import GridDatum

from ...state import SESSION

_DRAW_HANDLE = None
_SCREEN_DPI = 96.0
_MM_PER_INCH = 25.4


def lineweight_pixels(weight_mm: float) -> float:
    """Convert a printed line width to a stable viewport width."""
    return max(weight_mm * _SCREEN_DPI / _MM_PER_INCH, 1.0)


def grid_overlay_segments(
    axis: GridDatum,
    view_scale: int,
) -> tuple[tuple[tuple[float, float, float], tuple[float, float, float]], ...]:
    """Build visible world-space GPU segments without creating Blender geometry."""
    dx = axis.end[0] - axis.start[0]
    dy = axis.end[1] - axis.start[1]
    dz = axis.end[2] - axis.start[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length == 0.0:
        return ()
    direction = (dx / length, dy / length, dz / length)
    return tuple(
        (
            tuple(axis.start[index] + direction[index] * span_start for index in range(3)),
            tuple(axis.start[index] + direction[index] * span_end for index in range(3)),
        )
        for span_start, span_end in dash_spans(
            length,
            LINE_PATTERNS[axis.line_pattern],
            view_scale,
        )
    )


def _active_view_scale() -> int:
    camera = bpy.context.scene.camera
    if camera is None or camera.get("webim_class") != "TechnicalView":
        return 100
    return max(int(camera.get("webim_view_scale", 100)), 1)


def _draw_grid_overlay() -> None:
    project = SESSION.native_project
    if project is None:
        return
    shader = gpu.shader.from_builtin("UNIFORM_COLOR")
    view_scale = _active_view_scale()
    visible_ids = {
        obj.get("webim_id")
        for obj in bpy.context.visible_objects
        if obj.get("webim_class") == "GridDatum"
    }
    gpu.state.blend_set("ALPHA")
    gpu.state.depth_test_set("LESS_EQUAL")
    try:
        for axis in project.grid_axes:
            if axis.id not in visible_ids:
                continue
            segments = grid_overlay_segments(axis, view_scale)
            if not segments:
                continue
            coordinates = [point for segment in segments for point in segment]
            batch = batch_for_shader(shader, "LINES", {"pos": coordinates})
            gpu.state.line_width_set(lineweight_pixels(axis.line_weight_mm))
            shader.bind()
            shader.uniform_float("color", (0.0, 0.0, 0.0, 1.0))
            batch.draw(shader)
    finally:
        gpu.state.line_width_set(1.0)
        gpu.state.depth_test_set("NONE")
        gpu.state.blend_set("NONE")


def register() -> None:
    global _DRAW_HANDLE
    if _DRAW_HANDLE is None and not bpy.app.background:
        _DRAW_HANDLE = bpy.types.SpaceView3D.draw_handler_add(
            _draw_grid_overlay,
            (),
            "WINDOW",
            "POST_VIEW",
        )


def unregister() -> None:
    global _DRAW_HANDLE
    if _DRAW_HANDLE is not None:
        bpy.types.SpaceView3D.draw_handler_remove(_DRAW_HANDLE, "WINDOW")
        _DRAW_HANDLE = None


def is_registered() -> bool:
    return _DRAW_HANDLE is not None or bpy.app.background
