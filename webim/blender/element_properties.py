from __future__ import annotations

from typing import ClassVar

import bpy

from .state import SESSION
from .views import _active_native_view


class WEBIM_PT_properties(bpy.types.Panel):
    """Revit-like semantic properties hosted in Blender's Properties Editor."""

    bl_label = "Properties"
    bl_idname = "WEBIM_PT_properties"
    bl_space_type = "PROPERTIES"
    bl_region_type = "WINDOW"
    bl_context = "scene"
    bl_parent_id = "WEBIM_PT_scene_root"
    bl_order = 10
    bl_options: ClassVar[set[str]] = {"HIDE_HEADER"}

    @classmethod
    def poll(cls, context):
        from .editor_host import active_scene_panel

        return active_scene_panel(context) == "PROPERTIES"

    def draw(self, context):
        layout = self.layout
        obj = context.active_object

        if obj is not None and obj.get("webim_class") == "GridDatum":
            self._draw_grid(layout, context, obj)
            return
        if obj is not None and obj.type == "CAMERA" and obj.get("webim_class") == "TechnicalView":
            self._draw_view(layout, context, obj)
            return
        if obj is not None and obj.get("ifc_class") in {"IfcWall", "IfcWallStandardCase"}:
            self._draw_wall(layout, context, obj)
            return

        camera, native_view = _active_native_view(context)
        if camera is not None and native_view is not None:
            self._draw_view(layout, context, camera)
            return

        project = SESSION.native_project
        if project is None:
            layout.label(text="No WeBIM project loaded", icon="INFO")
            layout.label(text="Create the first BIM element or technical view")
            return

        box = layout.box()
        box.label(text="Project", icon="HOME")
        box.label(text=project.name)
        box.label(text=f"Site: {project.site_name}")
        box.label(text=f"Building: {project.building_name}")
        box.label(text=f"Storey: {project.storey_name}")
        layout.separator()
        layout.label(text="Select a Grid, Wall, or Technical View", icon="RESTRICT_SELECT_OFF")

    @staticmethod
    def _draw_grid(layout, context, obj):
        props = context.scene.webim_grid
        project = SESSION.native_project
        axis = None
        if project is not None:
            axis_id = obj.get("webim_id", "")
            axis = next((item for item in project.grid_axes if item.id == axis_id), None)

        header = layout.box()
        header.label(text=f"Grid {axis.name if axis else obj.get('grid_name', '')}", icon="GRID")
        if axis is not None:
            header.label(text=f"Stable ID: {axis.id[:8]}")

        identity = layout.box()
        identity.label(text="Identity Data")
        identity.prop(props, "name", text="Grid system")
        identity.prop(props, "elevation")

        graphics = layout.box()
        graphics.label(text="Annotation")
        graphics.prop(props, "head_type")
        graphics.prop(props, "head_scale")
        camera = context.scene.camera
        if camera is not None and camera.get("webim_class") == "TechnicalView":
            graphics.label(
                text=f"Active view scale: 1:{camera.get('webim_view_scale', 100)}",
                icon="VIEW_CAMERA",
            )

        constraints = layout.box()
        constraints.label(text="Drawing and Snapping")
        constraints.prop(props, "snap_increment")
        constraints.prop(props, "endpoint_snap_pixels")
        constraints.prop(props, "axis_snap_angle")

    @staticmethod
    def _draw_view(layout, context, camera):
        props = context.scene.webim_view
        project = SESSION.native_project
        view_id = camera.get("webim_view_id", "")
        view = None
        if project is not None:
            view = next((item for item in project.views if item.id == view_id), None)

        header = layout.box()
        header.label(text=view.name if view else camera.name, icon="VIEW_CAMERA")
        header.label(
            text=(view.view_type if view else camera.get("webim_view_type", "VIEW"))
            .replace("_", " ")
            .title()
        )

        identity = layout.box()
        identity.label(text="Identity Data")
        identity.prop(props, "name")
        identity.prop(props, "view_type")

        extents = layout.box()
        extents.label(text="Graphics and Extents")
        extents.prop(props, "scale")
        extents.prop(props, "ortho_scale")
        extents.label(text="Projection: Orthographic", icon="VIEW_ORTHO")
        extents.label(text="3D rotation: Locked", icon="LOCKED")

    @staticmethod
    def _draw_wall(layout, context, obj):
        props = context.scene.webim
        header = layout.box()
        header.label(text=props.wall_name or obj.name, icon="MESH_CUBE")
        header.label(text="Wall")

        identity = layout.box()
        identity.label(text="Identity Data")
        identity.prop(props, "wall_name")

        constraints = layout.box()
        constraints.label(text="Constraints")
        row = constraints.row(align=True)
        row.prop(props, "wall_start_x")
        row.prop(props, "wall_start_y")
        row = constraints.row(align=True)
        row.prop(props, "wall_end_x")
        row.prop(props, "wall_end_y")
        constraints.prop(props, "wall_elevation")

        dimensions = layout.box()
        dimensions.label(text="Dimensions")
        dimensions.prop(props, "wall_height")
        dimensions.prop(props, "wall_thickness")


_CLASSES = (WEBIM_PT_properties,)


def register() -> None:
    for cls in _CLASSES:
        bpy.utils.register_class(cls)


def unregister() -> None:
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
