import bpy


class WEBIM_PT_authoring(bpy.types.Panel):
    bl_label = "Wall Properties"
    bl_idname = "WEBIM_PT_authoring"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WeBIM"

    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and obj.get("ifc_class") in {"IfcWall", "IfcWallStandardCase"}

    def draw(self, context):
        layout = self.layout
        props = context.scene.webim

        layout.prop(props, "wall_name")
        row = layout.row(align=True)
        row.prop(props, "wall_start_x")
        row.prop(props, "wall_start_y")
        row = layout.row(align=True)
        row.prop(props, "wall_end_x")
        row.prop(props, "wall_end_y")
        layout.prop(props, "wall_elevation")
        layout.prop(props, "wall_height")
        layout.prop(props, "wall_thickness")
