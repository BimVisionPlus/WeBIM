from typing import ClassVar

import bpy


class WEBIM_PT_grid(bpy.types.Panel):
    bl_label = "Grid Properties"
    bl_idname = "WEBIM_PT_grid"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WeBIM"
    bl_options: ClassVar[set[str]] = {"DEFAULT_CLOSED"}

    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and obj.get("webim_class") == "GridDatum"

    def draw(self, context):
        layout = self.layout
        props = context.scene.webim_grid

        layout.prop(props, "name", text="Grid system")
        layout.prop(props, "elevation")
        layout.prop(props, "snap_increment")
        layout.prop(props, "endpoint_snap_pixels")
        layout.prop(props, "axis_snap_angle")
        layout.separator()
        layout.prop(props, "head_type")
        layout.prop(props, "head_scale")
        layout.separator()
        layout.label(text="Graphics", icon="GREASEPENCIL")
        layout.prop(props, "line_pattern")
        layout.prop(props, "line_weight")
