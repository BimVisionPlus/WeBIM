import math
from dataclasses import replace
from typing import ClassVar

import bpy
from bpy.props import StringProperty
from bpy_extras import view3d_utils
from mathutils import Matrix, Vector
from mathutils.geometry import intersect_line_plane

from webim.application.grid_snapping import snap_grid_point

from ...state import SESSION
from ...synchronization import begin_grid_preview, end_grid_preview
from .renderer import ensure_grid_head_annotation, update_grid_axis_object

Point3D = tuple[float, float, float]

_NUMBER_KEYS = {
    "ZERO": "0",
    "ONE": "1",
    "TWO": "2",
    "THREE": "3",
    "FOUR": "4",
    "FIVE": "5",
    "SIX": "6",
    "SEVEN": "7",
    "EIGHT": "8",
    "NINE": "9",
    "NUMPAD_0": "0",
    "NUMPAD_1": "1",
    "NUMPAD_2": "2",
    "NUMPAD_3": "3",
    "NUMPAD_4": "4",
    "NUMPAD_5": "5",
    "NUMPAD_6": "6",
    "NUMPAD_7": "7",
    "NUMPAD_8": "8",
    "NUMPAD_9": "9",
    "PERIOD": ".",
    "NUMPAD_PERIOD": ".",
    "MINUS": "-",
    "NUMPAD_MINUS": "-",
}


def _active_grid_object(context):
    obj = context.active_object
    if (
        context.mode != "OBJECT"
        or obj is None
        or not obj.select_get()
        or obj.get("webim_class") != "GridDatum"
    ):
        return None
    return obj


def _find_axis(axis_id: str):
    project = SESSION.native_project
    if project is None:
        return None
    return next((axis for axis in project.grid_axes if axis.id == axis_id), None)


class WEBIM_OT_drag_grid_endpoint(bpy.types.Operator):
    bl_idname = "webim.drag_grid_endpoint"
    bl_label = "Drag Grid Endpoint"
    bl_description = "Drag this anchor to resize the selected native GridDatum"
    bl_options: ClassVar[set[str]] = {"REGISTER", "UNDO", "BLOCKING"}

    axis_id: StringProperty()
    endpoint: StringProperty()

    _obj = None
    _original_start: Point3D | None = None
    _original_end: Point3D | None = None
    _preview_point: Point3D | None = None
    _numeric_input = ""
    _elevation = 0.0

    def invoke(self, context, event):
        obj = _active_grid_object(context)
        axis = _find_axis(self.axis_id)
        if obj is None or axis is None:
            return {"CANCELLED"}
        ensure_grid_head_annotation(obj, axis)
        begin_grid_preview(axis.id)
        self._obj = obj
        self._original_start = axis.start
        self._original_end = axis.end
        self._preview_point = axis.start if self.endpoint == "START" else axis.end
        self._numeric_input = ""
        self._elevation = (
            axis.start[2] if self.endpoint == "START" else axis.end[2]
        )
        context.window_manager.modal_handler_add(self)
        context.workspace.status_text_set(
            "Grid endpoint: hover new position, then LMB confirm | Type +/- delta + Enter | Esc/RMB cancel"
        )
        return {"RUNNING_MODAL"}

    def modal(self, context, event):
        if event.type == "MOUSEMOVE" and not self._numeric_input:
            point = self._mouse_to_plane(context, event)
            if point is not None:
                self._show_preview(context, point)
            return {"RUNNING_MODAL"}

        if event.value == "PRESS" and event.type in _NUMBER_KEYS:
            self._append_numeric_input(context, _NUMBER_KEYS[event.type])
            return {"RUNNING_MODAL"}

        if event.type == "BACK_SPACE" and event.value == "PRESS":
            self._numeric_input = self._numeric_input[:-1]
            self._update_numeric_preview(context)
            return {"RUNNING_MODAL"}

        if event.type == "LEFTMOUSE" and event.value == "PRESS":
            return self._confirm(context)

        if event.type in {"RET", "NUMPAD_ENTER"} and event.value == "PRESS":
            return self._confirm(context)

        if event.type in {"ESC", "RIGHTMOUSE"} and event.value == "PRESS":
            self._restore_visual(context)
            self._finish(context)
            return {"CANCELLED"}

        return {"RUNNING_MODAL"}

    def _mouse_to_plane(self, context, event) -> Point3D | None:
        coordinate = (event.mouse_region_x, event.mouse_region_y)
        origin = view3d_utils.region_2d_to_origin_3d(
            context.region, context.region_data, coordinate
        )
        direction = view3d_utils.region_2d_to_vector_3d(
            context.region, context.region_data, coordinate
        )
        point = intersect_line_plane(
            origin,
            origin + direction * 100000.0,
            Vector((0.0, 0.0, self._elevation)),
            Vector((0.0, 0.0, 1.0)),
            False,
        )
        if point is None:
            return None

        axis = _find_axis(self.axis_id)
        if axis is None:
            return None
        opposite = axis.end if self.endpoint == "START" else axis.start
        props = context.scene.webim_grid
        result = snap_grid_point(
            (point.x, point.y, self._elevation),
            start=opposite,
            increment=props.snap_increment,
            axis_angle_degrees=props.axis_snap_angle,
        )
        return result.point

    def _show_preview(self, context, point: Point3D) -> None:
        axis = _find_axis(self.axis_id)
        if axis is None or self._obj is None:
            return
        preview = replace(
            axis,
            start=point if self.endpoint == "START" else axis.start,
            end=point if self.endpoint == "END" else axis.end,
        )
        if preview.start == preview.end:
            return
        self._preview_point = point
        update_grid_axis_object(self._obj, preview)
        context.area.tag_redraw()

    def _append_numeric_input(self, context, character: str) -> None:
        if character == "-" and self._numeric_input:
            return
        if character == "." and "." in self._numeric_input:
            return
        self._numeric_input += character
        self._update_numeric_preview(context)

    def _update_numeric_preview(self, context) -> None:
        if not self._numeric_input or self._numeric_input in {"-", ".", "-."}:
            context.workspace.status_text_set(
                "Grid endpoint: type signed delta in metres | Enter confirm | Backspace edit"
            )
            return
        try:
            distance = float(self._numeric_input)
        except ValueError:
            return
        point = self._point_from_delta(distance)
        if point is not None:
            self._show_preview(context, point)
        context.workspace.status_text_set(
            f"Grid endpoint delta: {self._numeric_input} m | Enter/LMB confirm | Esc cancel"
        )

    def _point_from_delta(self, distance: float) -> Point3D | None:
        if self._original_start is None or self._original_end is None:
            return None
        if self.endpoint == "START":
            base = self._original_start
            opposite = self._original_end
        else:
            base = self._original_end
            opposite = self._original_start
        direction = (
            base[0] - opposite[0],
            base[1] - opposite[1],
            base[2] - opposite[2],
        )
        length = math.sqrt(sum(component * component for component in direction))
        if length == 0.0:
            return None
        return tuple(
            base[index] + direction[index] / length * distance
            for index in range(3)
        )

    def _confirm(self, context):
        project = SESSION.native_project
        if (
            project is None
            or self._obj is None
            or self._preview_point is None
        ):
            self._finish(context)
            return {"CANCELLED"}
        try:
            if self.endpoint == "START":
                axis = project.update_grid_axis(
                    self.axis_id, start=self._preview_point
                )
            else:
                axis = project.update_grid_axis(
                    self.axis_id, end=self._preview_point
                )
        except (KeyError, ValueError):
            self._restore_visual(context)
            self._finish(context)
            return {"CANCELLED"}
        update_grid_axis_object(self._obj, axis)
        SESSION.is_dirty = True
        self._finish(context)
        return {"FINISHED"}

    def _restore_visual(self, context) -> None:
        axis = _find_axis(self.axis_id)
        if axis is not None and self._obj is not None:
            update_grid_axis_object(self._obj, axis)
            context.area.tag_redraw()

    def _finish(self, context) -> None:
        end_grid_preview(self.axis_id)
        context.workspace.status_text_set(None)
        if context.area is not None:
            context.area.tag_redraw()


class WEBIM_GGT_grid_endpoints(bpy.types.GizmoGroup):
    bl_idname = "WEBIM_GGT_grid_endpoints"
    bl_label = "Native Grid Endpoint Anchors"
    bl_space_type = "VIEW_3D"
    bl_region_type = "WINDOW"
    bl_options: ClassVar[set[str]] = {"3D", "PERSISTENT"}

    @classmethod
    def poll(cls, context):
        return _active_grid_object(context) is not None

    def setup(self, context):
        self._start_anchor, self._start_operator = self._create_anchor("START")
        self._end_anchor, self._end_operator = self._create_anchor("END")

    def refresh(self, context):
        obj = _active_grid_object(context)
        if obj is None:
            return
        axis_id = obj.get("webim_id", "")
        axis = _find_axis(axis_id)
        if axis is None:
            return

        self._start_anchor.matrix_basis = Matrix.Translation(Vector(axis.start))
        self._end_anchor.matrix_basis = Matrix.Translation(Vector(axis.end))
        self._start_operator.axis_id = axis.id
        self._end_operator.axis_id = axis.id

    def _create_anchor(self, endpoint: str):
        anchor = self.gizmos.new("GIZMO_GT_button_2d")
        anchor.color = (0.65, 0.65, 0.65)
        anchor.alpha = 0.35
        anchor.color_highlight = (1.0, 1.0, 1.0)
        anchor.alpha_highlight = 0.8
        anchor.draw_options = {"BACKDROP", "OUTLINE"}
        # A 2D button inside a 3D GizmoGroup keeps a stable screen-space size,
        # so both circular anchors remain legible while the viewport zoom changes.
        anchor.scale_basis = 0.13
        anchor.use_draw_modal = True
        operator = anchor.target_set_operator(
            WEBIM_OT_drag_grid_endpoint.bl_idname
        )
        operator.endpoint = endpoint
        return anchor, operator
