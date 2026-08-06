import bpy
from bpy.props import EnumProperty, FloatProperty, StringProperty

from webim.domain.graphics.line_styles import LINE_PATTERNS, LINE_WEIGHTS_MM

_LINE_PATTERN_ITEMS = tuple(
    (identifier, pattern.name, f"{pattern.name} paper-space line pattern")
    for identifier, pattern in LINE_PATTERNS.items()
)
_LINE_WEIGHT_ITEMS = tuple(
    (str(weight), f"{weight:g} mm", f"Printed line width of {weight:g} mm")
    for weight in LINE_WEIGHTS_MM
)


def _update_selected_grid_head(self, context) -> None:
    obj = context.active_object
    if obj is None or obj.get("webim_class") != "GridDatum":
        return
    from ...state import SESSION
    from .renderer import update_grid_head_annotation

    project = SESSION.native_project
    if project is None:
        return
    try:
        axis = project.update_grid_axis(
            obj.get("webim_id", ""),
            head_type=self.head_type,
            head_scale=self.head_scale,
        )
    except (KeyError, ValueError):
        return
    update_grid_head_annotation(obj, axis)
    SESSION.is_dirty = True


def _update_selected_grid_style(self, context) -> None:
    obj = context.active_object
    if obj is None or obj.get("webim_class") != "GridDatum":
        return
    from ...state import SESSION
    from .renderer import update_grid_axis_object

    project = SESSION.native_project
    if project is None:
        return
    try:
        axis = project.update_grid_axis(
            obj.get("webim_id", ""),
            line_pattern=self.line_pattern,
            line_weight_mm=float(self.line_weight),
        )
    except (KeyError, ValueError):
        return
    update_grid_axis_object(obj, axis)
    SESSION.is_dirty = True


class WEBIMGridProperties(bpy.types.PropertyGroup):
    name: StringProperty(name="Grid name", default="Structural Grid")
    elevation: FloatProperty(name="Drawing elevation", default=0.0, unit="LENGTH")
    snap_increment: FloatProperty(
        name="Snap increment",
        default=0.1,
        min=0.001,
        unit="LENGTH",
        description="Round clicked points to this increment",
    )
    endpoint_snap_pixels: FloatProperty(
        name="Endpoint snap radius",
        default=14.0,
        min=2.0,
        max=64.0,
        description="Screen distance in pixels for snapping to existing grid endpoints",
    )
    axis_snap_angle: FloatProperty(
        name="Axis snap angle",
        default=5.0,
        min=0.1,
        max=20.0,
        description="Angular tolerance in degrees for automatic X/Y axis locking",
    )
    head_type: EnumProperty(
        name="Grid head type",
        items=(
            ("CIRCLE", "Circle + Name", "Circular bubble containing the grid name"),
            ("HEXAGON", "Hexagon + Name", "Hexagonal bubble containing the grid name"),
            ("NONE", "None", "Hide the grid head annotation"),
        ),
        default="CIRCLE",
        update=_update_selected_grid_head,
    )
    head_scale: FloatProperty(
        name="Annotation scale",
        default=1.0,
        min=0.1,
        max=10.0,
        description="Scale applied to the grid head symbol and text",
        update=_update_selected_grid_head,
    )
    line_pattern: EnumProperty(
        name="Line pattern",
        items=_LINE_PATTERN_ITEMS,
        default="CENTER",
        update=_update_selected_grid_style,
    )
    line_weight: EnumProperty(
        name="Line weight",
        items=_LINE_WEIGHT_ITEMS,
        default="0.25",
        update=_update_selected_grid_style,
    )
