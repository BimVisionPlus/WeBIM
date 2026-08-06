from typing import ClassVar

import bpy
from bpy.props import StringProperty

from webim.core.wall import WallInput

from .mesh import create_object_from_product
from .state import SESSION, ensure_project


class WEBIM_OT_create_wall(bpy.types.Operator):
    bl_idname = "webim.create_wall"
    bl_label = "Create IFC Wall"
    bl_description = "Create an IfcWall and tessellate it into Blender"
    bl_options: ClassVar[set[str]] = {"REGISTER", "UNDO"}

    def execute(self, context):
        props = context.scene.webim
        try:
            ensure_project(context.scene)
            wall = SESSION.add_wall(
                WallInput(
                    name=props.wall_name,
                    start=(props.wall_start_x, props.wall_start_y),
                    end=(props.wall_end_x, props.wall_end_y),
                    elevation=props.wall_elevation,
                    height=props.wall_height,
                    thickness=props.wall_thickness,
                )
            )
            obj = create_object_from_product(wall)
        except (RuntimeError, ValueError) as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}

        context.view_layer.objects.active = obj
        obj.select_set(True)
        self.report({"INFO"}, f"Created IfcWall #{wall.id()}")
        return {"FINISHED"}


class WEBIM_OT_save_ifc(bpy.types.Operator):
    bl_idname = "webim.save_ifc"
    bl_label = "Export IFC"
    bl_description = "Export the native BIM project to an IFC exchange file"

    filepath: StringProperty(name="IFC file", subtype="FILE_PATH")
    filter_glob: StringProperty(default="*.ifc", options={"HIDDEN"})

    def execute(self, context):
        try:
            target = SESSION.export_ifc(self.filepath)
        except (RuntimeError, ValueError) as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Exported IFC: {target}")
        return {"FINISHED"}

    def invoke(self, context, event):
        if not self.filepath:
            self.filepath = "webim-project.ifc"
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}
