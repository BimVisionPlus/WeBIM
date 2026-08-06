from typing import ClassVar

import bpy
import gpu
from bpy_extras import view3d_utils
from gpu_extras.batch import batch_for_shader
from mathutils import Vector
from mathutils.geometry import intersect_line_plane

from webim.application.grid_snapping import snap_grid_point

from ...state import SESSION, ensure_project
from .renderer import create_grid_axis_object

Point3D = tuple[float, float, float]


class WEBIM_OT_create_grid(bpy.types.Operator):
    bl_idname = "webim.create_grid"
    bl_label = "Draw Native Grid Axes"
    bl_description = "Create one independent native GridDatum after every two clicks"
    bl_options: ClassVar[set[str]] = {"REGISTER", "UNDO", "BLOCKING"}

    _draw_handle = None
    _start: Point3D | None = None
    _hover: Point3D | None = None
    _elevation = 0.0
    _snap_increment = 0.1
    _endpoint_snap_pixels = 14.0
    _axis_snap_angle = 5.0
    _snap_kind = "INCREMENT"
    _created_count = 0

    @classmethod
    def poll(cls, context):
        return context.area is not None and context.area.type == "VIEW_3D"

    def invoke(self, context, event):
        props = context.scene.webim_grid
        self._start = None
        self._created_count = 0
        self._elevation = props.elevation
        self._snap_increment = props.snap_increment
        self._endpoint_snap_pixels = props.endpoint_snap_pixels
        self._axis_snap_angle = props.axis_snap_angle
        self._hover = self._mouse_to_plane(context, event)
        self._draw_handle = bpy.types.SpaceView3D.draw_handler_add(
            self._draw_preview, (), "WINDOW", "POST_VIEW"
        )
        context.window_manager.modal_handler_add(self)
        context.workspace.status_text_set(
            "Native Grid: LMB start/end | Esc clears/exits | Enter/RMB exits"
        )
        context.area.tag_redraw()
        return {"RUNNING_MODAL"}

    def modal(self, context, event):
        if event.type == "MOUSEMOVE":
            self._hover = self._mouse_to_plane(context, event)
            self._update_status(context)
            context.area.tag_redraw()
            return {"RUNNING_MODAL"}

        if event.type == "LEFTMOUSE" and event.value == "PRESS":
            point = self._mouse_to_plane(context, event)
            if point is None:
                self.report({"WARNING"}, "Cannot project cursor onto drawing elevation")
                return {"RUNNING_MODAL"}
            if self._start is None:
                self._start = point
            elif point != self._start:
                if not self._create_axis(context, self._start, point):
                    return {"RUNNING_MODAL"}
                self._start = None
            context.area.tag_redraw()
            return {"RUNNING_MODAL"}

        if event.type in {"RET", "NUMPAD_ENTER", "RIGHTMOUSE"} and event.value == "PRESS":
            return self._exit(context)

        if event.type == "ESC" and event.value == "PRESS":
            if self._start is not None:
                self._start = None
                context.area.tag_redraw()
                return {"RUNNING_MODAL"}
            return self._exit(context)

        return {"RUNNING_MODAL"}

    def _create_axis(self, context, start: Point3D, end: Point3D) -> bool:
        props = context.scene.webim_grid
        axis = None
        try:
            ensure_project(context.scene)
            axis = SESSION.add_grid_axis(
                start,
                end,
                system_name=props.name,
                head_type=props.head_type,
                head_scale=props.head_scale,
                line_pattern=props.line_pattern,
                line_weight_mm=float(props.line_weight),
            )
            obj = create_grid_axis_object(axis)
        except (RuntimeError, ValueError) as exc:
            if axis is not None and SESSION.native_project is not None:
                SESSION.native_project.remove_grid_axis(axis.id)
            self.report({"ERROR"}, f"Could not create Grid: {exc}")
            return False

        self._created_count += 1
        context.view_layer.objects.active = obj
        obj.select_set(True)
        self.report({"INFO"}, f"Created native GridDatum {axis.name}")
        return True

    def _exit(self, context):
        self._cleanup(context)
        if self._created_count:
            self.report({"INFO"}, f"Created {self._created_count} native grid axis/axes")
            return {"FINISHED"}
        return {"CANCELLED"}

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
        raw = (point.x, point.y, self._elevation)
        endpoint = self._nearest_endpoint(context, coordinate)
        result = snap_grid_point(
            raw,
            start=self._start,
            endpoint=endpoint,
            increment=self._snap_increment,
            axis_angle_degrees=self._axis_snap_angle,
        )
        self._snap_kind = result.kind
        return result.point

    def _nearest_endpoint(self, context, coordinate) -> Point3D | None:
        project = SESSION.native_project
        if project is None:
            return None
        nearest = None
        nearest_distance_squared = self._endpoint_snap_pixels**2
        for axis in project.grid_axes:
            for endpoint in (axis.start, axis.end):
                if abs(endpoint[2] - self._elevation) > 1e-6:
                    continue
                screen = view3d_utils.location_3d_to_region_2d(
                    context.region,
                    context.region_data,
                    Vector(endpoint),
                )
                if screen is None:
                    continue
                distance_squared = (
                    (screen.x - coordinate[0]) ** 2
                    + (screen.y - coordinate[1]) ** 2
                )
                if distance_squared <= nearest_distance_squared:
                    nearest = endpoint
                    nearest_distance_squared = distance_squared
        return nearest

    def _update_status(self, context):
        labels = {
            "ENDPOINT": "Endpoint",
            "AXIS_X": "X axis",
            "AXIS_Y": "Y axis",
            "INCREMENT": "Increment",
        }
        snap = labels.get(self._snap_kind, "None")
        context.workspace.status_text_set(
            f"Native Grid | Snap: {snap} | LMB start/end | Esc clear/exit | Enter/RMB exit"
        )

    def _draw_preview(self):
        if self._hover is None:
            return
        shader = gpu.shader.from_builtin("UNIFORM_COLOR")
        gpu.state.blend_set("ALPHA")
        shader.bind()

        if self._start is not None:
            if self._snap_kind == "AXIS_X":
                guide = (
                    (self._start[0] - 10000.0, self._start[1], self._start[2]),
                    (self._start[0] + 10000.0, self._start[1], self._start[2]),
                )
                self._draw_line(shader, guide, (0.2, 1.0, 0.4, 0.35), 1.0)
            elif self._snap_kind == "AXIS_Y":
                guide = (
                    (self._start[0], self._start[1] - 10000.0, self._start[2]),
                    (self._start[0], self._start[1] + 10000.0, self._start[2]),
                )
                self._draw_line(shader, guide, (0.2, 1.0, 0.4, 0.35), 1.0)
            self._draw_line(
                shader,
                (self._start, self._hover),
                (0.1, 0.8, 1.0, 1.0),
                2.0,
            )

        if self._snap_kind in {"ENDPOINT", "AXIS_X", "AXIS_Y"}:
            marker = batch_for_shader(shader, "POINTS", {"pos": (self._hover,)})
            gpu.state.point_size_set(9.0)
            shader.uniform_float("color", (1.0, 0.75, 0.1, 1.0))
            marker.draw(shader)
            gpu.state.point_size_set(1.0)

        gpu.state.line_width_set(1.0)
        gpu.state.blend_set("NONE")

    @staticmethod
    def _draw_line(shader, points, color, width):
        batch = batch_for_shader(shader, "LINES", {"pos": points})
        gpu.state.line_width_set(width)
        shader.uniform_float("color", color)
        batch.draw(shader)

    def _cleanup(self, context):
        if self._draw_handle is not None:
            bpy.types.SpaceView3D.draw_handler_remove(self._draw_handle, "WINDOW")
            self._draw_handle = None
        context.workspace.status_text_set(None)
        if context.area is not None:
            context.area.tag_redraw()
